import { API } from '#types/api'
import { REG, tuning } from '#types/registry'
import { timeoutMicrosecondsToMclks } from '@utils/calcs'
import { _debug } from '@utils/debug'
import { encodeTimeout, encodeVcselPeriod } from '@utils/encode-decode'
import { BytesWritten } from 'i2c-bus'
import I2CCore from './I2C-core'

export default class VL53L0X extends I2CCore {
  private _timingBudget = -1

  constructor(bus: number, addr = 0x29) {
    super(bus, addr)
  }

  public async init(): Promise<void> {
    await this._setupProviderModule()
    _debug.info('DataInit')

    // "Set I2C standard mode"
    await this._writeReg(REG.I2C_STANDARD_MODE, REG.SYSRANGE_START)
    // disable SIGNAL_RATE_MSRC (bit 1) and SIGNAL_RATE_PRE_RANGE (bit 4) limit checks
    await this._writeReg(REG.MSRC_CONFIG_CONTROL, (await this._readReg(REG.MSRC_CONFIG_CONTROL)) | 0x12)
    // set final range signal rate limit to 0.25 MCPS (million counts per second)
    await this._setSignalRateLimit(0.25)
    await this._writeReg(REG.SYSTEM_SEQUENCE_CONFIG, 0xff)

    _debug.info('StaticInit')
    await this._writeReg(0xff, REG.SYSTEM_SEQUENCE_CONFIG)
    await this._writeReg(REG.DYNAMIC_SPAD_REF_EN_START_OFFSET, REG.SYSRANGE_START)
    await this._writeReg(REG.DYNAMIC_SPAD_NUM_REQUESTED_REF_SPAD, 0x2c)
    await this._writeReg(0xff, REG.SYSRANGE_START)
    await this._writeReg(REG.GLOBAL_CONFIG_REF_EN_START_SELECT, 0xb4)

    const spadInfo = await this._getSpadInfo()
    const spadMap = await this._readMulti(REG.GLOBAL_CONFIG_SPAD_ENABLES_REF_0, 6)
    const firstSpadToEnable = spadInfo.aperture ? 12 : 0 // 12 is the first aperture spad
    let spads_enabled = 0

    for (let i = 0; i < 48; i++) {
      if (i < firstSpadToEnable || spads_enabled === spadInfo.count) {
        spadMap[1 + Math.floor(i / 8)] &= ~(1 << i % 8)
      } else if (((spadMap[1 + Math.floor(i / 8)] >> i % 8) & 0x1) > 0) {
        spads_enabled++
      }
    }

    await this._writeMulti(REG.GLOBAL_CONFIG_SPAD_ENABLES_REF_0, spadMap)

    // VL53L0X_load_tuning_settings()
    for (let i = 0; i < tuning.length; i++) {
      await this._writeReg(tuning[i], tuning[++i])
    }

    // -- VL53L0X_SetGpioConfig() begin
    await this._writeReg(REG.SYSTEM_INTERRUPT_CONFIG_GPIO, REG.SYSTEM_INTERMEASUREMENT_PERIOD)
    await this._writeReg(REG.GPIO_HV_MUX_ACTIVE_HIGH, (await this._readReg(REG.GPIO_HV_MUX_ACTIVE_HIGH)[0]) & ~0x10) // active low
    await this._writeReg(REG.SYSTEM_INTERRUPT_CLEAR, REG.SYSTEM_SEQUENCE_CONFIG)

    this._timingBudget = await this._getMeasurementTimingBudget()
    _debug.verbose('existing budget %s', this._timingBudget)

    // "Disable MSRC and TCC by default"
    // MSRC = Minimum Signal Rate Check
    // TCC = Target CentreCheck
    await this._writeReg(REG.SYSTEM_SEQUENCE_CONFIG, 0xe8) //VL53L0X_SetSequenceStepEnable()
    // "Recalculate timing budget"
    await this._setMeasurementTimingBudget(this._timingBudget)
    // VL53L0X_perform_vhv_calibration()
    await this._writeReg(REG.SYSTEM_SEQUENCE_CONFIG, REG.SYSTEM_SEQUENCE_CONFIG)
    await this._performSingleRefCalibration(0x40)
    // VL53L0X_perform_phase_calibration()
    await this._writeReg(REG.SYSTEM_SEQUENCE_CONFIG, 0x02)
    await this._performSingleRefCalibration(REG.SYSRANGE_START)

    // "restore the previous Sequence Config"
    await this._writeReg(REG.SYSTEM_SEQUENCE_CONFIG, 0xe8)
  }

  private async _setMeasurementTimingBudget(budget_us: number): Promise<void> {
    if (budget_us < 20000) {
      throw new Error('budget below MinTimingBudget')
    }

    // 1320 + 960  : start & end overhead values
    const budget = await this._getBudget(1320 + 960)
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

      await this._writeReg(REG.FINAL_RANGE_CONFIG_TIMEOUT_MACROP_HI, encodeTimeout(final_range_timeout_mclks), true)

      this._timingBudget = budget_us // store for internal reuse
    }
  }

  private async _getMeasurementTimingBudget(): Promise<number> {
    // 1920 + 960 : start & end overhead values
    const budget = await this._getBudget(1920 + 960)

    if (budget.enables.final_range) {
      return budget.value + budget.timeouts.final_range_us + 550 //FinalRangeOverhead
    }

    return budget.value
  }

  private async _setSignalRateLimit(limit_Mcps: number): Promise<BytesWritten | void> {
    // Q9.7 fixed point format (9 integer bits, 7 fractional bits)
    if (limit_Mcps < 0 || limit_Mcps > 511.99) {
      return
    }

    return await this._writeReg(REG.FINAL_RANGE_CONFIG_MIN_COUNT_RATE_RTN_LIMIT, limit_Mcps * (1 << 7), true)
  }

  private async _getSignalRateLimit(): Promise<number> {
    return (await this._readReg(REG.FINAL_RANGE_CONFIG_MIN_COUNT_RATE_RTN_LIMIT, true)) / (1 << 7)
  }

  private async _getRangeMillimeters(): Promise<number> {
    // I guess we need to make sure the stop variable didn't change somehow...
    // await protectedWrite(0x91, 0x01, stop_variable)
    await this._writeReg(REG.SYSRANGE_START, REG.SYSTEM_SEQUENCE_CONFIG)
    // assumptions: Linearity Corrective Gain is 1000 (default);
    // fractional ranging is not enabled
    const range = await this._readReg(REG.RESULT_RANGE, true)
    await this._writeReg(REG.SYSTEM_INTERRUPT_CLEAR, REG.SYSTEM_SEQUENCE_CONFIG)

    return range
  }

  private async _performSingleRefCalibration(vhv_init_byte: number): Promise<void> {
    await this._writeReg(REG.SYSRANGE_START, REG.SYSTEM_SEQUENCE_CONFIG | vhv_init_byte) // VL53L0X_REG_SYSRANGE_MODE_START_STOP
    await this._writeReg(REG.SYSTEM_INTERRUPT_CLEAR, REG.SYSTEM_SEQUENCE_CONFIG)
    await this._writeReg(REG.SYSRANGE_START, REG.SYSRANGE_START)
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
  private async _setVcselPulsePeriod(type: 'pre' | 'final', period_pclks: 8 | 10 | 12 | 14 | 16 | 18): Promise<void> {
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

    if (!register[period_pclks]) {
      throw new Error('invalid period_pclks value')
    }

    const vcsel_period_reg = encodeVcselPeriod(period_pclks)
    const sequence = await this._getSequenceSteps()

    if (type === 'pre') {
      const new_pre_range_timeout_mclks = timeoutMicrosecondsToMclks(sequence.timeouts.pre_range_us, period_pclks) // set_sequence_step_timeout() - (SequenceStepId == VL53L0X_SEQUENCESTEP_PRE_RANGE)
      const new_msrc_timeout_mclks = timeoutMicrosecondsToMclks(sequence.timeouts.msrc_dss_tcc_us, period_pclks) // set_sequence_step_timeout() - (SequenceStepId == VL53L0X_SEQUENCESTEP_MSRC)
      await this._writeReg(register[period_pclks], 0x18)
      await this._writeReg(REG.PRE_RANGE_CONFIG_VALID_PHASE_LOW, 0x08)
      await this._writeReg(REG.PRE_RANGE_CONFIG_VCSEL_PERIOD, vcsel_period_reg) // apply new VCSEL period
      await this._writeReg(REG.PRE_RANGE_CONFIG_TIMEOUT_MACROP_HI, encodeTimeout(new_pre_range_timeout_mclks), true)
      await await this._writeReg(
        REG.MSRC_CONFIG_TIMEOUT_MACROP,
        new_msrc_timeout_mclks > 256 ? 255 : new_msrc_timeout_mclks - 1
      )
    }

    if (type === 'final') {
      const new_pre_range_timeout_mclks = timeoutMicrosecondsToMclks(sequence.timeouts.final_range_us, period_pclks)
      const pre_range = sequence.enables.pre_range ? sequence.timeouts.pre_range_mclks : 0
      const new_final_range_timeout_mclks = new_pre_range_timeout_mclks + pre_range // set_sequence_step_timeout() - (SequenceStepId == VL53L0X_SEQUENCESTEP_FINAL_RANGE)
      await this._writeReg(REG.FINAL_RANGE_CONFIG_VALID_PHASE_HIGH, args[period_pclks][0])
      await this._writeReg(REG.FINAL_RANGE_CONFIG_VALID_PHASE_LOW, 0x08)
      await this._writeReg(REG.GLOBAL_CONFIG_VCSEL_WIDTH, args[period_pclks][1])
      await this._writeReg(REG.ALGO_PHASECAL_CONFIG_TIMEOUT, args[period_pclks][2])
      await this._writeReg(0xff, 0x01)
      await this._writeReg(REG.ALGO_PHASECAL_LIM, args[period_pclks][3])
      await this._writeReg(0xff, 0x00)
      await this._writeReg(REG.FINAL_RANGE_CONFIG_VCSEL_PERIOD, vcsel_period_reg) // apply new VCSEL period
      await this._writeReg(REG.FINAL_RANGE_CONFIG_TIMEOUT_MACROP_HI, encodeTimeout(new_final_range_timeout_mclks), true)
    }

    // TODO: Not sure about this...
    await this._setMeasurementTimingBudget(this._timingBudget)

    const sequence_config = await this._readReg(REG.SYSTEM_SEQUENCE_CONFIG) // VL53L0X_perform_phase_calibration()
    await this._writeReg(REG.SYSTEM_SEQUENCE_CONFIG, 0x02)
    await this._performSingleRefCalibration(REG.SYSRANGE_START)
    await this._writeReg(REG.SYSTEM_SEQUENCE_CONFIG, sequence_config)
  }

  public get api(): API {
    return {
      measure: this._getRangeMillimeters.bind(this),
      setSignalRateLimit: this._setSignalRateLimit.bind(this),
      getSignalRateLimit: this._getSignalRateLimit.bind(this),
      getMeasurementTimingBudget: this._getMeasurementTimingBudget.bind(this),
      setMeasurementTimingBudget: this._setMeasurementTimingBudget.bind(this),
      getVcselPulsePeriod: this._getVcselPulsePeriod.bind(this),
      setVcselPulsePeriod: this._setVcselPulsePeriod.bind(this),
      performSingleRefCalibration: this._performSingleRefCalibration.bind(this),

      //expose to allow doing whatever you want
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
