import { API } from '#types/api'
import { OPTS } from '#types/options'
import { REG, tuning } from '#types/registry'
import { timeoutMicrosecondsToMclks } from '@utils/calcs'
import { encodeTimeout, encodeVcselPeriod } from '@utils/encode-decode'
import { BytesWritten } from 'i2c-bus'
import I2CCore from './I2C-core'

export default class VL53L0X extends I2CCore {
  constructor(address: number[][] | number = REG.I2C_DEFAULT_ADDR, bus = 1) {
    super(address, bus)
  }

  public async init(opts?: OPTS): Promise<void> {
    this._options = { ...this._options, ...opts }

    await this._setupProviderModule()

    for (const pin of Object.keys(this._addresses)) {
      if (this._addresses[pin].gpio) {
        await this._gpioWrite(this._addresses[pin].gpio, 1)
      }

      await this._setup(pin)
      await this._optionsSetup(pin)
    }
  }

  private async _optionsSetup(pin: number | string): Promise<void> {
    if (this._options.signalRateLimit) {
      await this._setSignalRateLimit(this._options.signalRateLimit, pin)
    }

    if (this._options.vcselPulsePeriod && this._options.vcselPulsePeriod.pre) {
      await this._setVcselPulsePeriod('pre', this._options.vcselPulsePeriod.pre, pin)
    }

    if (this._options.vcselPulsePeriod && this._options.vcselPulsePeriod.final) {
      await this._setVcselPulsePeriod('final', this._options.vcselPulsePeriod.final, pin)
    }

    if (this._options.measurementTimingBudget) {
      await this._setMeasurementTimingBudget(this._options.measurementTimingBudget, pin)
    }
  }

  private async _setup(pin: number | string): Promise<void> {
    await this._writeReg(REG.I2C_SLAVE_DEVICE_ADDRESS, this._addresses[pin].addr, REG.I2C_DEFAULT_ADDR)
    // "Set I2C standard mode"
    await this._writeReg(REG.I2C_STANDARD_MODE, REG.SYSRANGE_START, this._addresses[pin].addr)

    // disable SIGNAL_RATE_MSRC (bit 1) and SIGNAL_RATE_PRE_RANGE (bit 4) limit checks
    await this._writeReg(
      REG.MSRC_CONFIG_CONTROL,
      (await this._readReg(REG.MSRC_CONFIG_CONTROL, this._addresses[pin].addr)) | 0x12,
      this._addresses[pin].addr
    )
    // set final range signal rate limit to 0.25 MCPS (million counts per second)
    await this._setSignalRateLimit(0.25, pin)
    await this._writeReg(REG.SYSTEM_SEQUENCE_CONFIG, 0xff, this._addresses[pin].addr)
    await this._writeReg(0xff, REG.SYSTEM_SEQUENCE_CONFIG, this._addresses[pin].addr)
    await this._writeReg(REG.DYNAMIC_SPAD_REF_EN_START_OFFSET, REG.SYSRANGE_START, this._addresses[pin].addr)
    await this._writeReg(REG.DYNAMIC_SPAD_NUM_REQUESTED_REF_SPAD, 0x2c, this._addresses[pin].addr)
    await this._writeReg(0xff, REG.SYSRANGE_START, this._addresses[pin].addr)
    await this._writeReg(REG.GLOBAL_CONFIG_REF_EN_START_SELECT, 0xb4, this._addresses[pin].addr)

    const spadInfo = await this._getSpadInfo(pin)
    const spadMap = await this._readMulti(REG.GLOBAL_CONFIG_SPAD_ENABLES_REF_0, this._addresses[pin].addr, 6)
    const firstSpadToEnable = spadInfo.aperture ? 12 : 0 // 12 is the first aperture spad
    let spads_enabled = 0

    for (let i = 0; i < 48; i++) {
      if (i < firstSpadToEnable || spads_enabled === spadInfo.count) {
        spadMap[1 + Math.floor(i / 8)] &= ~(1 << i % 8)
      } else if (((spadMap[1 + Math.floor(i / 8)] >> i % 8) & 0x1) > 0) {
        spads_enabled++
      }
    }

    await this._writeMulti(REG.GLOBAL_CONFIG_SPAD_ENABLES_REF_0, spadMap, this._addresses[pin].addr)

    // VL53L0X_load_tuning_settings()
    for (let i = 0; i < tuning.length; i++) {
      await this._writeReg(tuning[i], tuning[++i], this._addresses[pin].addr)
    }

    // -- VL53L0X_SetGpioConfig() begin
    await this._writeReg(
      REG.SYSTEM_INTERRUPT_CONFIG_GPIO,
      REG.SYSTEM_INTERMEASUREMENT_PERIOD,
      this._addresses[pin].addr
    )
    await this._writeReg(
      REG.GPIO_HV_MUX_ACTIVE_HIGH,
      (await this._readReg(REG.GPIO_HV_MUX_ACTIVE_HIGH, this._addresses[pin].addr)[0]) & ~0x10,
      this._addresses[pin].addr
    ) // active low

    await this._writeReg(REG.SYSTEM_INTERRUPT_CLEAR, REG.SYSTEM_SEQUENCE_CONFIG, this._addresses[pin].addr)

    this._addresses[pin].timingBudget = await this._getMeasurementTimingBudgetInternal(pin)

    // "Disable MSRC and TCC by default"
    // MSRC = Minimum Signal Rate Check
    // TCC = Target CentreCheck
    await this._writeReg(REG.SYSTEM_SEQUENCE_CONFIG, 0xe8, this._addresses[pin].addr) //VL53L0X_SetSequenceStepEnable()
    // "Recalculate timing budget"
    await this._setMeasurementTimingBudget(this._addresses[pin].timingBudget, pin)
    // VL53L0X_perform_vhv_calibration()
    await this._writeReg(REG.SYSTEM_SEQUENCE_CONFIG, REG.SYSTEM_SEQUENCE_CONFIG, this._addresses[pin].addr)
    await this._performSingleRefCalibrationInternal(0x40, pin)
    // VL53L0X_perform_phase_calibration()
    await this._writeReg(REG.SYSTEM_SEQUENCE_CONFIG, 0x02, this._addresses[pin].addr)
    await this._performSingleRefCalibrationInternal(REG.SYSRANGE_START, pin)

    // "restore the previous Sequence Config"
    await this._writeReg(REG.SYSTEM_SEQUENCE_CONFIG, 0xe8, this._addresses[pin].addr)
  }

  private async _setMeasurementTimingBudget(budget_us: number, pin: number | string): Promise<void> {
    if (budget_us < 20000) {
      throw new Error('budget below MinTimingBudget')
    }

    if (pin) {
      // 1320 + 960  : start & end overhead values
      const budget = await this._getBudget(1320 + 960, pin)
      let used_budget_us = budget.value

      if (budget.enables.final_range) {
        used_budget_us += 550 // FinalRangeOverhead

        if (used_budget_us > budget_us) {
          throw new Error('Requested timeout too big.')
        }

        const final_range_timeout_us = budget_us - used_budget_us
        // set_sequence_step_timeout()
        let final_range_timeout_mclks = timeoutMicrosecondsToMclks(
          final_range_timeout_us,
          budget.timeouts.final_range_vcsel_period_pclks
        )

        if (budget.enables.pre_range) {
          final_range_timeout_mclks += budget.timeouts.pre_range_mclks
        }

        await this._writeReg(
          REG.FINAL_RANGE_CONFIG_TIMEOUT_MACROP_HI,
          encodeTimeout(final_range_timeout_mclks),
          this._addresses[pin].addr,
          true
        )

        this._addresses[pin].timingBudget = budget_us // store for internal reuse
      }
    } else {
      for (const p of Object.keys(this._addresses)) {
        // 1320 + 960  : start & end overhead values
        const budget = await this._getBudget(1320 + 960, p)
        let used_budget_us = budget.value

        if (budget.enables.final_range) {
          used_budget_us += 550 // FinalRangeOverhead

          if (used_budget_us > budget_us) {
            throw new Error('Requested timeout too big.')
          }

          const final_range_timeout_us = budget_us - used_budget_us
          // set_sequence_step_timeout()
          let final_range_timeout_mclks = timeoutMicrosecondsToMclks(
            final_range_timeout_us,
            budget.timeouts.final_range_vcsel_period_pclks
          )

          if (budget.enables.pre_range) {
            final_range_timeout_mclks += budget.timeouts.pre_range_mclks
          }

          await this._writeReg(
            REG.FINAL_RANGE_CONFIG_TIMEOUT_MACROP_HI,
            encodeTimeout(final_range_timeout_mclks),
            this._addresses[p].addr,
            true
          )

          this._addresses[p].timingBudget = budget_us // store for internal reuse
        }
      }
    }
  }

  private async _getMeasurementTimingBudgetInternal(pin: number | string): Promise<number> {
    // 1920 + 960 : start & end overhead values
    const budget = await this._getBudget(1920 + 960, pin)

    if (budget.enables.final_range) {
      return budget.value + budget.timeouts.final_range_us + 550 //FinalRangeOverhead
    }

    return budget.value
  }

  private async _getMeasurementTimingBudget(pin?: number | string): Promise<{ [key: string]: number } | number> {
    if (pin) {
      return await this._getMeasurementTimingBudgetInternal(pin)
    } else {
      const toReturn = {}

      for (const p of Object.keys(this._addresses)) {
        toReturn[p] = await this._getMeasurementTimingBudgetInternal(p)
      }

      return toReturn
    }
  }

  private async _setSignalRateLimit(
    limit_Mcps: number,
    pin?: number | string
  ): Promise<{ [key: string]: BytesWritten } | BytesWritten | void> {
    // Q9.7 fixed point format (9 integer bits, 7 fractional bits)
    if (limit_Mcps < 0 || limit_Mcps > 511.99) {
      return
    }

    if (pin) {
      return await this._writeReg(
        REG.FINAL_RANGE_CONFIG_MIN_COUNT_RATE_RTN_LIMIT,
        limit_Mcps * (1 << 7),
        this._addresses[pin].addr,
        true
      )
    } else {
      const toReturn = {}

      for (const p of Object.keys(this._addresses)) {
        toReturn[p] = await this._writeReg(
          REG.FINAL_RANGE_CONFIG_MIN_COUNT_RATE_RTN_LIMIT,
          limit_Mcps * (1 << 7),
          this._addresses[p].addr,
          true
        )
      }

      return toReturn
    }
  }

  private async _getSignalRateLimit(pin?: number | string): Promise<{ [key: string]: number } | number> {
    if (pin) {
      return (
        (await this._readReg(REG.FINAL_RANGE_CONFIG_MIN_COUNT_RATE_RTN_LIMIT, this._addresses[pin].addr, true)) /
        (1 << 7)
      )
    } else {
      const toReturn = {}

      for (const p of Object.keys(this._addresses)) {
        toReturn[p] =
          (await this._readReg(REG.FINAL_RANGE_CONFIG_MIN_COUNT_RATE_RTN_LIMIT, this._addresses[pin].addr, true)) /
          (1 << 7)
      }

      return toReturn
    }
  }

  private async _getRangeMillimeters(pin?: number | string): Promise<{ [key: string]: number } | number> {
    const toReturn = {}

    if (pin) {
      if (this._addresses[pin]) {
        // I guess we need to make sure the stop variable didn't change somehow...
        // await protectedWrite(0x91, 0x01, stop_variable)
        await this._writeReg(REG.SYSRANGE_START, REG.SYSTEM_SEQUENCE_CONFIG, this._addresses[pin].addr)
        // assumptions: Linearity Corrective Gain is 1000 (default);
        // fractional ranging is not enabled
        toReturn[pin] = await this._readReg(REG.RESULT_RANGE, this._addresses[pin].addr, true)
        await this._writeReg(REG.SYSTEM_INTERRUPT_CLEAR, REG.SYSTEM_SEQUENCE_CONFIG, this._addresses[pin].addr)

        return toReturn
      } else {
        throw new Error(
          `Invalid pin number. Available Pins: [${Object.keys(this._addresses).map((pin) => " '" + pin + "' ")}]`
        )
      }
    } else {
      for (const p of Object.keys(this._addresses)) {
        // I guess we need to make sure the stop variable didn't change somehow...
        // await protectedWrite(0x91, 0x01, stop_variable)
        await this._writeReg(REG.SYSRANGE_START, REG.SYSTEM_SEQUENCE_CONFIG, this._addresses[p].addr)
        // assumptions: Linearity Corrective Gain is 1000 (default);
        // fractional ranging is not enabled
        toReturn[p] = await this._readReg(REG.RESULT_RANGE, this._addresses[p].addr, true)
        await this._writeReg(REG.SYSTEM_INTERRUPT_CLEAR, REG.SYSTEM_SEQUENCE_CONFIG, this._addresses[p].addr)
      }
      return toReturn
    }
  }

  private async _performSingleRefCalibrationInternal(vhv_init_byte: number, pin: number | string): Promise<void> {
    await this._writeReg(REG.SYSRANGE_START, REG.SYSTEM_SEQUENCE_CONFIG | vhv_init_byte, this._addresses[pin].addr) // VL53L0X_REG_SYSRANGE_MODE_START_STOP
    await this._writeReg(REG.SYSTEM_INTERRUPT_CLEAR, REG.SYSTEM_SEQUENCE_CONFIG, this._addresses[pin].addr)
    await this._writeReg(REG.SYSRANGE_START, REG.SYSRANGE_START, this._addresses[pin].addr)
  }

  private async _performSingleRefCalibration(vhv_init_byte: number, pin?: number | string): Promise<void> {
    if (pin) {
      await this._performSingleRefCalibrationInternal(vhv_init_byte, pin)
    } else {
      for (const p of Object.keys(this._addresses)) {
        await this._performSingleRefCalibrationInternal(vhv_init_byte, p)
      }
    }
  }

  /**
   * Valid values are (even numbers only):
   * pre:  12 to 18 (initialized default: 14)
   * final: 8 to 14 (initialized default: 10)
   *
   * @param {('pre' | 'final')} type
   * @param {number} period_pclks
   * @return {*}  {Promise<void>}
   * @memberof VL53L0X
   */
  private async _setVcselPulsePeriod(
    type: 'pre' | 'final',
    period_pclks: 8 | 10 | 12 | 14 | 16 | 18,
    pin: number | string
  ): Promise<void> {
    const register = { 12: 0x18, 14: 0x30, 16: 0x40, 18: 0x50 }
    const args = {
      8: [0x10, 0x02, 0x0c, 0x30],
      10: [0x28, 0x03, 0x09, 0x20],
      12: [0x38, 0x03, 0x08, 0x20],
      14: [0x48, 0x03, 0x07, 0x20],
    }

    if ((type !== 'pre' && type !== 'final') || (type !== 'final' && type !== 'pre')) {
      throw new Error('Invlaid type')
    }

    if (type === 'pre' && !register[period_pclks]) {
      throw new Error('invalid PRE period_pclks value')
    }

    if (type === 'final' && !args[period_pclks]) {
      throw new Error('invalid FINAL period_pclks value')
    }

    const vcsel_period_reg = encodeVcselPeriod(period_pclks)

    if (pin) {
      const sequence = await this._getSequenceSteps(pin)

      if (type === 'pre') {
        const new_pre_range_timeout_mclks = timeoutMicrosecondsToMclks(sequence.timeouts.pre_range_us, period_pclks) // set_sequence_step_timeout() - (SequenceStepId == VL53L0X_SEQUENCESTEP_PRE_RANGE)
        const new_msrc_timeout_mclks = timeoutMicrosecondsToMclks(sequence.timeouts.msrc_dss_tcc_us, period_pclks) // set_sequence_step_timeout() - (SequenceStepId == VL53L0X_SEQUENCESTEP_MSRC)
        await this._writeReg(register[period_pclks], 0x18, this._addresses[pin].addr)
        await this._writeReg(REG.PRE_RANGE_CONFIG_VALID_PHASE_LOW, 0x08, this._addresses[pin].addr)
        await this._writeReg(REG.PRE_RANGE_CONFIG_VCSEL_PERIOD, vcsel_period_reg, this._addresses[pin].addr) // apply new VCSEL period
        await this._writeReg(
          REG.PRE_RANGE_CONFIG_TIMEOUT_MACROP_HI,
          encodeTimeout(new_pre_range_timeout_mclks),
          this._addresses[pin].addr,
          true
        )
        await await this._writeReg(
          REG.MSRC_CONFIG_TIMEOUT_MACROP,
          new_msrc_timeout_mclks > 256 ? 255 : new_msrc_timeout_mclks - 1,
          this._addresses[pin].addr
        )
      }

      if (type === 'final') {
        const new_pre_range_timeout_mclks = timeoutMicrosecondsToMclks(sequence.timeouts.final_range_us, period_pclks)
        const pre_range = sequence.enables.pre_range ? sequence.timeouts.pre_range_mclks : 0
        const new_final_range_timeout_mclks = new_pre_range_timeout_mclks + pre_range // set_sequence_step_timeout() - (SequenceStepId == VL53L0X_SEQUENCESTEP_FINAL_RANGE)
        await this._writeReg(REG.FINAL_RANGE_CONFIG_VALID_PHASE_HIGH, args[period_pclks][0], this._addresses[pin].addr)
        await this._writeReg(REG.FINAL_RANGE_CONFIG_VALID_PHASE_LOW, 0x08, this._addresses[pin].addr)
        await this._writeReg(REG.GLOBAL_CONFIG_VCSEL_WIDTH, args[period_pclks][1], this._addresses[pin].addr)
        await this._writeReg(REG.ALGO_PHASECAL_CONFIG_TIMEOUT, args[period_pclks][2], this._addresses[pin].addr)
        await this._writeReg(0xff, 0x01, this._addresses[pin].addr)
        await this._writeReg(REG.ALGO_PHASECAL_LIM, args[period_pclks][3], this._addresses[pin].addr)
        await this._writeReg(0xff, 0x00, this._addresses[pin].addr)
        await this._writeReg(REG.FINAL_RANGE_CONFIG_VCSEL_PERIOD, vcsel_period_reg, this._addresses[pin].addr) // apply new VCSEL period
        await this._writeReg(
          REG.FINAL_RANGE_CONFIG_TIMEOUT_MACROP_HI,
          encodeTimeout(new_final_range_timeout_mclks),
          this._addresses[pin].addr,
          true
        )
      }

      await this._setMeasurementTimingBudget(this._addresses[pin].timingBudget, pin)

      const sequence_config = await this._readReg(REG.SYSTEM_SEQUENCE_CONFIG, this._addresses[pin].addr) // VL53L0X_perform_phase_calibration()
      await this._writeReg(REG.SYSTEM_SEQUENCE_CONFIG, 0x02, this._addresses[pin].addr)
      await this._performSingleRefCalibrationInternal(REG.SYSRANGE_START, pin)
      await this._writeReg(REG.SYSTEM_SEQUENCE_CONFIG, sequence_config, this._addresses[pin].addr)
    } else {
      for (const p of Object.keys(this._addresses)) {
        const sequence = await this._getSequenceSteps(p)

        if (type === 'pre') {
          const new_pre_range_timeout_mclks = timeoutMicrosecondsToMclks(sequence.timeouts.pre_range_us, period_pclks) // set_sequence_step_timeout() - (SequenceStepId == VL53L0X_SEQUENCESTEP_PRE_RANGE)
          const new_msrc_timeout_mclks = timeoutMicrosecondsToMclks(sequence.timeouts.msrc_dss_tcc_us, period_pclks) // set_sequence_step_timeout() - (SequenceStepId == VL53L0X_SEQUENCESTEP_MSRC)
          await this._writeReg(register[period_pclks], 0x18, this._addresses[p].addr)
          await this._writeReg(REG.PRE_RANGE_CONFIG_VALID_PHASE_LOW, 0x08, this._addresses[p].addr)
          await this._writeReg(REG.PRE_RANGE_CONFIG_VCSEL_PERIOD, vcsel_period_reg, this._addresses[p].addr) // apply new VCSEL period
          await this._writeReg(
            REG.PRE_RANGE_CONFIG_TIMEOUT_MACROP_HI,
            encodeTimeout(new_pre_range_timeout_mclks),
            this._addresses[p].addr,
            true
          )
          await await this._writeReg(
            REG.MSRC_CONFIG_TIMEOUT_MACROP,
            new_msrc_timeout_mclks > 256 ? 255 : new_msrc_timeout_mclks - 1,
            this._addresses[p].addr
          )
        }

        if (type === 'final') {
          const new_pre_range_timeout_mclks = timeoutMicrosecondsToMclks(sequence.timeouts.final_range_us, period_pclks)
          const pre_range = sequence.enables.pre_range ? sequence.timeouts.pre_range_mclks : 0
          const new_final_range_timeout_mclks = new_pre_range_timeout_mclks + pre_range // set_sequence_step_timeout() - (SequenceStepId == VL53L0X_SEQUENCESTEP_FINAL_RANGE)
          await this._writeReg(REG.FINAL_RANGE_CONFIG_VALID_PHASE_HIGH, args[period_pclks][0], this._addresses[p].addr)
          await this._writeReg(REG.FINAL_RANGE_CONFIG_VALID_PHASE_LOW, 0x08, this._addresses[p].addr)
          await this._writeReg(REG.GLOBAL_CONFIG_VCSEL_WIDTH, args[period_pclks][1], this._addresses[p].addr)
          await this._writeReg(REG.ALGO_PHASECAL_CONFIG_TIMEOUT, args[period_pclks][2], this._addresses[p].addr)
          await this._writeReg(0xff, 0x01, this._addresses[p].addr)
          await this._writeReg(REG.ALGO_PHASECAL_LIM, args[period_pclks][3], this._addresses[p].addr)
          await this._writeReg(0xff, 0x00, this._addresses[p].addr)
          await this._writeReg(REG.FINAL_RANGE_CONFIG_VCSEL_PERIOD, vcsel_period_reg, this._addresses[p].addr) // apply new VCSEL period
          await this._writeReg(
            REG.FINAL_RANGE_CONFIG_TIMEOUT_MACROP_HI,
            encodeTimeout(new_final_range_timeout_mclks),
            this._addresses[p].addr,
            true
          )
        }

        await this._setMeasurementTimingBudget(this._addresses[p].timingBudget, p)

        const sequence_config = await this._readReg(REG.SYSTEM_SEQUENCE_CONFIG, this._addresses[p].addr) // VL53L0X_perform_phase_calibration()
        await this._writeReg(REG.SYSTEM_SEQUENCE_CONFIG, 0x02, this._addresses[p].addr)
        await this._performSingleRefCalibrationInternal(REG.SYSRANGE_START, p)
        await this._writeReg(REG.SYSTEM_SEQUENCE_CONFIG, sequence_config, this._addresses[p].addr)
      }
    }
  }

  private async _getVcselPulsePeriod(type: number, pin?: number | string): Promise<{ [key: string]: number } | number> {
    if (pin) {
      return ((await this._readReg(type, this._addresses[pin].addr)) + 1) << 1
    } else {
      const toReturn = {}

      for (const p of Object.keys(this._addresses)) {
        toReturn[p] = ((await this._readReg(type, this._addresses[p].addr)) + 1) << 1
      }

      return toReturn
    }
  }

  public get api(): API {
    return {
      measure: this._getRangeMillimeters.bind(this),
      setSignalRateLimit: this._setSignalRateLimit.bind(this),
      getSignalRateLimit: this._getSignalRateLimit.bind(this),
      getMeasurementTimingBudget: this._getMeasurementTimingBudget.bind(this),
      setMeasurementTimingBudget: this._setMeasurementTimingBudget.bind(this),
      setVcselPulsePeriod: this._setVcselPulsePeriod.bind(this),
      getVcselPulsePeriod: this._getVcselPulsePeriod.bind(this),
      performSingleRefCalibration: this._performSingleRefCalibration.bind(this),
      io: {
        write: this._write.bind(this),
        writeReg: this._writeReg.bind(this),
        writeMulti: this._writeMulti.bind(this),
        readReg: this._readReg.bind(this),
        readMulti: this._readMulti.bind(this),
      },
    }
  }
}
