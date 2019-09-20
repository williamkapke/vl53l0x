const _debug = require('debug')
const hex = (v) => v.toString(16).padStart(2, '0')
_debug.formatters.h = (v) => v.length ? Array.prototype.map.call(v, b => hex(b)).join(' ') : hex(v)
const debug = {
  info: _debug('VL53L0X_info'),
  verbose: _debug('VL53L0X_verbose')
}

const tuning = [0XFF, 0X01, 0X00, 0X00, 0XFF, 0X00, 0X09, 0X00, 0X10, 0X00, 0X11, 0X00, 0X24, 0X01, 0X25, 0XFF, 0X75, 0X00, 0XFF, 0X01, 0X4E, 0X2C, 0X48, 0X00, 0X30, 0X20, 0XFF, 0X00, 0X30, 0X09, 0X54, 0X00, 0X31, 0X04, 0X32, 0X03, 0X40, 0X83, 0X46, 0X25, 0X60, 0X00, 0X27, 0X00, 0X50, 0X06, 0X51, 0X00, 0X52, 0X96, 0X56, 0X08, 0X57, 0X30, 0X61, 0X00, 0X62, 0X00, 0X64, 0X00, 0X65, 0X00, 0X66, 0XA0, 0XFF, 0X01, 0X22, 0X32, 0X47, 0X14, 0X49, 0XFF, 0X4A, 0X00, 0XFF, 0X00, 0X7A, 0X0A, 0X7B, 0X00, 0X78, 0X21, 0XFF, 0X01, 0X23, 0X34, 0X42, 0X00, 0X44, 0XFF, 0X45, 0X26, 0X46, 0X05, 0X40, 0X40, 0X0E, 0X06, 0X20, 0X1A, 0X43, 0X40, 0XFF, 0X00, 0X34, 0X03, 0X35, 0X44, 0XFF, 0X01, 0X31, 0X04, 0X4B, 0X09, 0X4C, 0X05, 0X4D, 0X04, 0XFF, 0X00, 0X44, 0X00, 0X45, 0X20, 0X47, 0X08, 0X48, 0X28, 0X67, 0X00, 0X70, 0X04, 0X71, 0X01, 0X72, 0XFE, 0X76, 0X00, 0X77, 0X00, 0XFF, 0X01, 0X0D, 0X01, 0XFF, 0X00, 0X80, 0X01, 0X01, 0XF8, 0XFF, 0X01, 0X8E, 0X01, 0X00, 0X01, 0XFF, 0X00, 0X80, 0X00]
const REG = {
  SYSRANGE_START                              		: (0x000),
  SYSTEM_SEQUENCE_CONFIG                      		: (0x01),
  SYSTEM_INTERMEASUREMENT_PERIOD              		: (0x04),
  SYSTEM_RANGE_CONFIG                         		: (0x09),
  SYSTEM_INTERRUPT_CONFIG_GPIO                		: (0x0A),
  SYSTEM_INTERRUPT_CLEAR                      		: (0x0B),
  SYSTEM_THRESH_HIGH                          		: (0x0C),
  SYSTEM_THRESH_LOW                           		: (0x0E),
  RESULT_INTERRUPT_STATUS                     		: (0x13),
  RESULT_RANGE_STATUS                         		: (0x14),
  // RESULT_RANGE                                 : (0x1E), // 16 bits- so also includes 0x1F
  CROSSTALK_COMPENSATION_PEAK_RATE_MCPS       		: (0x20),
  PRE_RANGE_CONFIG_MIN_SNR                    		: (0x27),
  ALGO_PART_TO_PART_RANGE_OFFSET_MM           		: (0x28),
  ALGO_PHASECAL_LIM                           		: (0x30),/* 0x130 */
  ALGO_PHASECAL_CONFIG_TIMEOUT                		: (0x30),
  GLOBAL_CONFIG_VCSEL_WIDTH                   		: (0x032),
  HISTOGRAM_CONFIG_INITIAL_PHASE_SELECT       		: (0x33),
  FINAL_RANGE_CONFIG_MIN_COUNT_RATE_RTN_LIMIT 		: (0x44),
  MSRC_CONFIG_TIMEOUT_MACROP                  		: (0x46),
  FINAL_RANGE_CONFIG_VALID_PHASE_LOW          		: (0x47),
  FINAL_RANGE_CONFIG_VALID_PHASE_HIGH         		: (0x48),
  DYNAMIC_SPAD_NUM_REQUESTED_REF_SPAD         		: (0x4E),
  DYNAMIC_SPAD_REF_EN_START_OFFSET            		: (0x4F),
  PRE_RANGE_CONFIG_VCSEL_PERIOD               		: (0x50),
  PRE_RANGE_CONFIG_TIMEOUT_MACROP_HI          		: (0x51), // Section 3.2 reference register. Should be 0x0099
  PRE_RANGE_CONFIG_TIMEOUT_MACROP_LO          		: (0x52),
  HISTOGRAM_CONFIG_READOUT_CTRL               		: (0x55),
  PRE_RANGE_CONFIG_VALID_PHASE_LOW            		: (0x56),
  PRE_RANGE_CONFIG_VALID_PHASE_HIGH           		: (0x57),
  MSRC_CONFIG_CONTROL                         		: (0x60), // this is a bit mask- bit1=SIGNAL_RATE_MSRC, bit4=SIGNAL_RATE_PRE_RANGE
  PRE_RANGE_CONFIG_SIGMA_THRESH_HI            		: (0x61), // Section 3.2 reference register. Should be 0x0000
  PRE_RANGE_CONFIG_SIGMA_THRESH_LO            		: (0x62),
  PRE_RANGE_MIN_COUNT_RATE_RTN_LIMIT          		: (0x64),
  FINAL_RANGE_CONFIG_MIN_SNR                  		: (0x67),
  FINAL_RANGE_CONFIG_VCSEL_PERIOD             		: (0x70),
  FINAL_RANGE_CONFIG_TIMEOUT_MACROP_HI        		: (0x71),
  FINAL_RANGE_CONFIG_TIMEOUT_MACROP_LO        		: (0x72),
  POWER_MANAGEMENT_GO1_POWER_FORCE            		: (0x80),
  SYSTEM_HISTOGRAM_BIN                        		: (0x81),
  GPIO_HV_MUX_ACTIVE_HIGH                     		: (0x84),
  //"Set I2C standard mode"                       : (0x88), //https://github.com/pololu/vl53l0x-arduino/blob/fa1a33a03679985028f3512a3e2aa6c0e5029d5e/VL53L0X.cpp#L72
  VHV_CONFIG_PAD_SCL_SDA__EXTSUP_HV           		: (0x89), //bit0=2V8 mode
  I2C_SLAVE_DEVICE_ADDRESS                    		: (0x8A),
  //Revision?                                     : (0x90),
  //stop_variable                                 : (0x91), in collection 1 - https://github.com/pololu/vl53l0x-arduino/blob/fa1a33a03679985028f3512a3e2aa6c0e5029d5e/VL53L0X.cpp#L77
  GLOBAL_CONFIG_SPAD_ENABLES_REF_0            		: (0x0B0),
  GLOBAL_CONFIG_SPAD_ENABLES_REF_1            		: (0x0B1),
  GLOBAL_CONFIG_SPAD_ENABLES_REF_2            		: (0x0B2),
  GLOBAL_CONFIG_SPAD_ENABLES_REF_3            		: (0x0B3),
  GLOBAL_CONFIG_SPAD_ENABLES_REF_4            		: (0x0B4),
  GLOBAL_CONFIG_SPAD_ENABLES_REF_5            		: (0x0B5),
  RESULT_PEAK_SIGNAL_RATE_REF                 		: (0x00B6), //uses RdWord
  GLOBAL_CONFIG_REF_EN_START_SELECT           		: (0xB6), //uses WrByte
  RESULT_CORE_AMBIENT_WINDOW_EVENTS_RTN       		: (0xBC),
  SOFT_RESET_GO2_SOFT_RESET_N                 		: (0xBF),
  RESULT_CORE_RANGING_TOTAL_EVENTS_RTN        		: (0xC0),
  IDENTIFICATION_MODEL_ID                     		: (0xC0), // Section 3.2 reference register. Should be 0xEE
  //????????                                      : (0xC1), // Section 3.2 reference register. Should be 0xAA
  IDENTIFICATION_REVISION_ID                  		: (0xC2), // Section 3.2 reference register. Should be 0x10
  RESULT_CORE_AMBIENT_WINDOW_EVENTS_REF       		: (0xD0),
  RESULT_CORE_RANGING_TOTAL_EVENTS_REF        		: (0xD4),
  OSC_CALIBRATE_VAL                           		: (0xF8),
  VCSEL_PERIOD_PRE_RANGE                      		: (0),
  VCSEL_PERIOD_FINAL_RANGE                    		: (1)
}

const VL53L0X = (bus, addr=0x29) => {

  let timing_budget = -1;
  // let stop_variable;

  const write = (data) => {
    debug.verbose('write [%h]', data)
    return bus.i2cWrite(addr, data.length, data)
  }
  const writeReg = (register, value) => write(Buffer.from([ register, value ]))
  const writeReg16 = (register, value) => write(Buffer.from([ register, value >> 8, value & 0xFF ]))
  const writeMulti = (register, array) => {
    const buff = Buffer.alloc(array.length + 1, register)
    array.copy(buff, 1)
    return write(buff)
  }

  const readMulti = async (register, length = 1) => {
    await bus.i2cWrite(addr, 1, Buffer.alloc(1, register)) // tell it the read index
    const buff = await bus.i2cRead(addr, length)
    debug.verbose('read [%h] from 0x%h', buff, register)
    return buff
  }
  const readReg = async (register) => (await readMulti(register))[0]
  const readReg16 = async (register) => {
    const buff = await readMulti(register, 2)
    return (buff[0] << 8) | buff[1]
  }

  const init = async () => {

    debug.info('DataInit')
    {
      // "Set I2C standard mode"
      await writeReg(0x88, 0x00)

      // stop_variable = await protectedRead(0x91, 0x01)

      // disable SIGNAL_RATE_MSRC (bit 1) and SIGNAL_RATE_PRE_RANGE (bit 4) limit checks
      await writeReg(REG.MSRC_CONFIG_CONTROL, await readReg(REG.MSRC_CONFIG_CONTROL) | 0x12);

      // set final range signal rate limit to 0.25 MCPS (million counts per second)
      await setSignalRateLimit(0.25);

      await writeReg(REG.SYSTEM_SEQUENCE_CONFIG, 0xFF);
    }

    // setAddress
    // VL53L0X_GetDeviceInfo

    debug.info('StaticInit')
    {
      { // -- VL53L0X_set_reference_spads()
        const spadInfo = await getSpadInfo()
        const spadMap = await readMulti(REG.GLOBAL_CONFIG_SPAD_ENABLES_REF_0, 6);

        await writeReg(0xFF, 0x01);
        await writeReg(REG.DYNAMIC_SPAD_REF_EN_START_OFFSET, 0x00);
        await writeReg(REG.DYNAMIC_SPAD_NUM_REQUESTED_REF_SPAD, 0x2C);
        await writeReg(0xFF, 0x00);
        await writeReg(REG.GLOBAL_CONFIG_REF_EN_START_SELECT, 0xB4);

        const first_spad_to_enable = spadInfo.aperture ? 12 : 0; // 12 is the first aperture spad
        let spads_enabled = 0;

        for (let i = 0; i < 48; i++)
        {
          if (i < first_spad_to_enable || spads_enabled === spadInfo.count)
          {
            spadMap[1 + Math.floor(i / 8)] &= ~(1 << (i % 8))
          }
          else if (((spadMap[1 + Math.floor(i / 8)] >> (i % 8)) & 0x1) > 0)
          {
            spads_enabled++;
          }
        }

        await writeMulti(REG.GLOBAL_CONFIG_SPAD_ENABLES_REF_0, spadMap);
      }




      await tune() // VL53L0X_load_tuning_settings()

      { // -- VL53L0X_SetGpioConfig() begin
        await writeReg(REG.SYSTEM_INTERRUPT_CONFIG_GPIO, 0x04);
        await writeReg(REG.GPIO_HV_MUX_ACTIVE_HIGH, readReg(REG.GPIO_HV_MUX_ACTIVE_HIGH) & ~0x10); // active low
        await writeReg(REG.SYSTEM_INTERRUPT_CLEAR, 0x01);
      }

      timing_budget = await getMeasurementTimingBudget()
      debug.verbose('existing budget %s', timing_budget)

      // "Disable MSRC and TCC by default"
      // MSRC = Minimum Signal Rate Check
      // TCC = Target CentreCheck
      await writeReg(REG.SYSTEM_SEQUENCE_CONFIG, 0xE8) //VL53L0X_SetSequenceStepEnable()

      // "Recalculate timing budget"
      await setMeasurementTimingBudget(timing_budget)
    }

    {// VL53L0X_PerformRefCalibration()

      // VL53L0X_perform_vhv_calibration()
      await writeReg(REG.SYSTEM_SEQUENCE_CONFIG, 0x01);
      if (!(await performSingleRefCalibration(0x40))) {
        return Promise.reject();
      }

      // VL53L0X_perform_phase_calibration()
      await writeReg(REG.SYSTEM_SEQUENCE_CONFIG, 0x02);
      if (!(await performSingleRefCalibration(0x00))) {
        return Promise.reject();
      }

      // "restore the previous Sequence Config"
      await writeReg(REG.SYSTEM_SEQUENCE_CONFIG, 0xE8);
    }

    debug.info('init complete')
  }

  const tune = async () => {
    for(let i = 0; i < tuning.length; i++) {
      await writeReg(tuning[i], tuning[++i])
    }
  }

  const getSpadInfo = async () => {
    return protectedAccess(async () => {

      await writeReg(0xFF, 0x06);
      let x83 = await readReg(0x83);
      // return hex(x83)
      await writeReg(0x83,  x83 | 0x04);

      await writeReg(0xFF, 0x07);
      await writeReg(0x81, 0x01);
      await writeReg(0x80, 0x01);
      await writeReg(0x94, 0x6b);

      await writeReg(0x83, 0x00);
      while ((x83 = await readReg(0x83)) === 0x00) {
        console.log('not ready') //I haven't gotten here yet
      }
      // 0x83 seems to be 0x10 now

      await writeReg(0x83, 0x01);
      const tmp = await readReg(0x92);

      await writeReg(0x81, 0x00);
      await writeReg(0xFF, 0x06);
      await writeReg(0x83, await readReg(0x83)  & ~0x04);

      return {
        count: tmp & 0x7f,
        aperture: Boolean((tmp >> 7) & 0x01)
      };
    })
  }

  const setMeasurementTimingBudget = async (budget_us) => {
    if (budget_us < 20000) { //MinTimingBudget
      return Promise.reject(new Error('budget below MinTimingBudget'))
    }

    const enables = await getSequenceStepEnables()
    const timeouts = await getSequenceStepTimeouts(enables.pre_range)

    // 1320 + 960  : start & end overhead values
    let used_budget_us = calcCommonBudget(1320 + 960, enables, timeouts)

    if (enables.final_range) {
      used_budget_us += 550 // FinalRangeOverhead
      if (used_budget_us > budget_us) {
        return Promise.reject(new Error("Requested timeout too big."))
      }

      const final_range_timeout_us = budget_us - used_budget_us

      { // set_sequence_step_timeout()
        let final_range_timeout_mclks = timeoutMicrosecondsToMclks(final_range_timeout_us, timeouts.final_range_vcsel_period_pclks)

        if (enables.pre_range) {
          final_range_timeout_mclks += timeouts.pre_range_mclks
        }

        await writeReg16(REG.FINAL_RANGE_CONFIG_TIMEOUT_MACROP_HI, encodeTimeout(final_range_timeout_mclks))
      }

      timing_budget = budget_us // store for internal reuse
    }

    return true
  }
  const getMeasurementTimingBudget = async () => {
    const enables = await getSequenceStepEnables()
    const timeouts = await getSequenceStepTimeouts(enables.pre_range)

    // 1920 + 960 : start & end overhead values
    let budget_us = calcCommonBudget(1920 + 960, enables, timeouts)

    if (enables.final_range) {
      budget_us += (timeouts.final_range_us + 550) //FinalRangeOverhead
    }

    timing_budget = budget_us; // store for internal reuse
    return budget_us;
  }

  const getSequenceStepEnables = async () => {
    const sequence_config = await readReg(REG.SYSTEM_SEQUENCE_CONFIG)
    debug.verbose('sequence_config [%h]', sequence_config)
    return {
      msrc: (sequence_config >> 2) & 0x1,
      dss: (sequence_config >> 3) & 0x1,
      tcc: (sequence_config >> 4) & 0x1,
      pre_range: (sequence_config >> 6) & 0x1,
      final_range: (sequence_config >> 7) & 0x1
    }
  }
  const getSequenceStepTimeouts = async (pre_range) => {
    const pre_range_vcsel_period_pclks = await getVcselPulsePeriod(REG.PRE_RANGE_CONFIG_VCSEL_PERIOD)
    const msrc_dss_tcc_mclks = (await readReg(REG.MSRC_CONFIG_TIMEOUT_MACROP)) + 1
    const pre_range_mclks = await decodeTimeout(await readReg16(REG.PRE_RANGE_CONFIG_TIMEOUT_MACROP_HI))
    const final_range_vcsel_period_pclks = await getVcselPulsePeriod(REG.FINAL_RANGE_CONFIG_VCSEL_PERIOD)
    const final_range_mclks = decodeTimeout(await readReg16(REG.FINAL_RANGE_CONFIG_TIMEOUT_MACROP_HI)) - (pre_range? pre_range_mclks : 0)

    return {
      pre_range_vcsel_period_pclks,
      msrc_dss_tcc_mclks,
      msrc_dss_tcc_us: timeoutMclksToMicroseconds(msrc_dss_tcc_mclks, pre_range_vcsel_period_pclks),
      pre_range_mclks,
      pre_range_us: timeoutMclksToMicroseconds(pre_range_mclks, pre_range_vcsel_period_pclks),
      final_range_vcsel_period_pclks,
      final_range_mclks,
      final_range_us: timeoutMclksToMicroseconds(final_range_mclks, final_range_vcsel_period_pclks)
    }
  }

  const getVcselPulsePeriod = async (type) => ((await readReg(type)) + 1) << 1

  // Valid values are (even numbers only):
  //  pre:  12 to 18 (initialized default: 14)
  //  final: 8 to 14 (initialized default: 10)
  const setVcselPulsePeriod = async (type, period_pclks) => {

    const vcsel_period_reg = encodeVcselPeriod(period_pclks)

    const enables = await getSequenceStepEnables()
    const timeouts = await getSequenceStepTimeouts(enables.pre_range)


    if (type === 'pre') {
      const register = { 12:0x18, 14:0x30, 16:0x40, 18:0x50 }[period_pclks]
      if (!register) return Promise.reject(new Error('invalid period_pclks value'))

      await writeReg(register, 0x18)
      await writeReg(REG.PRE_RANGE_CONFIG_VALID_PHASE_LOW, 0x08)
      // apply new VCSEL period
      await writeReg(REG.PRE_RANGE_CONFIG_VCSEL_PERIOD, vcsel_period_reg)

      // set_sequence_step_timeout() - (SequenceStepId == VL53L0X_SEQUENCESTEP_PRE_RANGE)
      const new_pre_range_timeout_mclks = timeoutMicrosecondsToMclks(timeouts.pre_range_us, period_pclks)
      await writeReg16(REG.PRE_RANGE_CONFIG_TIMEOUT_MACROP_HI, encodeTimeout(new_pre_range_timeout_mclks))

      // set_sequence_step_timeout() - (SequenceStepId == VL53L0X_SEQUENCESTEP_MSRC)
      const new_msrc_timeout_mclks = timeoutMicrosecondsToMclks(timeouts.msrc_dss_tcc_us, period_pclks)
      await await writeReg(REG.MSRC_CONFIG_TIMEOUT_MACROP, (new_msrc_timeout_mclks > 256) ? 255 : (new_msrc_timeout_mclks - 1))

    }
    else if (type === 'final')
    {
      const writeFinal = async (phase_high, width, timeout, lim) => {
        await writeReg(REG.FINAL_RANGE_CONFIG_VALID_PHASE_HIGH, phase_high)
        await writeReg(REG.FINAL_RANGE_CONFIG_VALID_PHASE_LOW,  0x08)
        await writeReg(REG.GLOBAL_CONFIG_VCSEL_WIDTH, width)
        await writeReg(REG.ALGO_PHASECAL_CONFIG_TIMEOUT, timeout)
        await writeReg(0xFF, 0x01)
        await writeReg(REG.ALGO_PHASECAL_LIM, lim)
        await writeReg(0xFF, 0x00)
      }
      const args = {
        8: [0x10, 0x02, 0x0C, 0x30],
        10: [0x28, 0x03, 0x09, 0x20],
        12: [0x38, 0x03, 0x08, 0x20],
        14: [0x48, 0x03, 0x07, 0x20]
      }[period_pclks]

      await writeFinal(...args)

      // apply new VCSEL period
      await writeReg(REG.FINAL_RANGE_CONFIG_VCSEL_PERIOD, vcsel_period_reg)

      // set_sequence_step_timeout() - (SequenceStepId == VL53L0X_SEQUENCESTEP_FINAL_RANGE)
      const new_final_range_timeout_mclks = timeoutMicrosecondsToMclks(timeouts.final_range_us, period_pclks) + (enables.pre_range ? timeouts.pre_range_mclks : 0)
      await writeReg16(REG.FINAL_RANGE_CONFIG_TIMEOUT_MACROP_HI, encodeTimeout(new_final_range_timeout_mclks))

    }
    else
    {
      return Promise.reject(new Error('Invlaid type'))
    }

    await setMeasurementTimingBudget(timing_budget);

    // VL53L0X_perform_phase_calibration()
    const sequence_config = await readReg(REG.SYSTEM_SEQUENCE_CONFIG);
    await writeReg(REG.SYSTEM_SEQUENCE_CONFIG, 0x02);
    await performSingleRefCalibration(0x0);
    await writeReg(REG.SYSTEM_SEQUENCE_CONFIG, sequence_config);

    return true;
  }

  const setSignalRateLimit = (limit_Mcps) =>
    // Q9.7 fixed point format (9 integer bits, 7 fractional bits)
    limit_Mcps < 0 || limit_Mcps > 511.99
      ? Promise.reject()
      : writeReg16(REG.FINAL_RANGE_CONFIG_MIN_COUNT_RATE_RTN_LIMIT, limit_Mcps * (1 << 7))

  const getSignalRateLimit = async () => (await readReg16(REG.FINAL_RANGE_CONFIG_MIN_COUNT_RATE_RTN_LIMIT)) / (1 << 7)

  const readRangeSingleMillimeters = async () => {
    debug.info('readRangeSingleMillimeters')

    // I guess we need to make sure the stop variable didn't change somehow...
    // await protectedWrite(0x91, 0x01, stop_variable)

    await writeReg(0x00, 0x01);
    // this could have an optional timeout... but... (read next comment)
    while(await readReg(0x00) & 0x01) {
      console.log('not ready') //I haven't gotten here yet
    }

    return readRangeContinuousMillimeters();
  }

  const sysReady = async () => {
    const status = await readReg(REG.RESULT_INTERRUPT_STATUS)
    debug.verbose('status [%h]', status)
    // this could have an optional timeout... but... (read next comment)
    if (status & 0x07 === 0) {
      debug.verbose('sys not ready') //I haven't gotten here yet
      await sysReady()
    }
  }

  const performSingleRefCalibration = async (vhv_init_byte) => {
    await writeReg(REG.SYSRANGE_START, 0x01 | vhv_init_byte) // VL53L0X_REG_SYSRANGE_MODE_START_STOP
    await sysReady()
    await writeReg(REG.SYSTEM_INTERRUPT_CLEAR, 0x01)
    await writeReg(REG.SYSRANGE_START, 0x00)
    return true
  }
  const readRangeContinuousMillimeters = async () => {
    await sysReady()
    // assumptions: Linearity Corrective Gain is 1000 (default);
    // fractional ranging is not enabled
    const range = await readReg16(REG.RESULT_RANGE_STATUS + 10); // 0x1E

    await writeReg(REG.SYSTEM_INTERRUPT_CLEAR, 0x01);

    return range;
  }

  const protectedAccess = async (cb) => {
    await writeReg(0x80, 0x01)
    await writeReg(0xFF, 0x01) // select collection 1
    await writeReg(0x00, 0x00) // kinda like read-only=false?

    const result = await cb()

    await writeReg(0xFF, 0x01) // select collection 1
    await writeReg(0x00, 0x01) // kinda like read-only=true?
    await writeReg(0xFF, 0x00) // always set back to the default collection
    await writeReg(0x80, 0x00)
    return result
  }

  // create a mechanism to queue commands until init is done
  const initialize = init();
  const whenReady = (fn) => async (...args) => {
    await initialize // wait until the initialize promise is resolved
    return fn.apply(fn, args)
  }

  return {
    measure: whenReady(readRangeSingleMillimeters),
    //revision: () => readReg(1, 0xff),
    setSignalRateLimit: whenReady(setSignalRateLimit),
    getSignalRateLimit: whenReady(getSignalRateLimit),

    getMeasurementTimingBudget: whenReady(getMeasurementTimingBudget),
    setMeasurementTimingBudget: whenReady(setMeasurementTimingBudget),

    getVcselPulsePeriod: whenReady(getVcselPulsePeriod),
    setVcselPulsePeriod: whenReady(setVcselPulsePeriod),

    performSingleRefCalibration: whenReady(performSingleRefCalibration),

    //expose to allow doing whatever you want
    io : {
      writeReg: whenReady(writeReg),

      readReg: whenReady(readReg),
      readReg16: whenReady(readReg16),
    }
  };
};

const calcMacroPeriod = (vcsel_period_pclks) => (((2304 * vcsel_period_pclks * 1655) + 500) / 1000)
const timeoutMclksToMicroseconds = (timeout_period_mclks, vcsel_period_pclks) => {
  const macro_period_ns = calcMacroPeriod(vcsel_period_pclks);
  return Math.floor(((timeout_period_mclks * macro_period_ns) + (macro_period_ns / 2)) / 1000);
}
const timeoutMicrosecondsToMclks = (timeout_period_us, vcsel_period_pclks) => {
  const macro_period_ns = calcMacroPeriod(vcsel_period_pclks)
  return (((timeout_period_us * 1000) + (macro_period_ns / 2)) / macro_period_ns)
}

const decodeTimeout = (value) => ((value & 0x00FF) << ((value & 0xFF00) >> 8)) + 1 // format: "(LSByte * 2^MSByte) + 1"
const encodeTimeout = (timeout_mclks) => {
  if (timeout_mclks <= 0) return 0;

  // format: "(LSByte * 2^MSByte) + 1"
  let lsb = timeout_mclks - 1, msb = 0
  while ((lsb & 0xFFFFFF00) > 0) {
    lsb >>= 1
    msb++
  }

  return (msb << 8) | (lsb & 0xFF)
}
const encodeVcselPeriod = (period_pclks) => (((period_pclks) >> 1) - 1)
const calcCommonBudget = (budget_us, enables, timeouts) => {
  if (enables.tcc) {
    budget_us += (timeouts.msrc_dss_tcc_us + 590) //TccOverhead
  }

  if (enables.dss) {
    budget_us += 2 * (timeouts.msrc_dss_tcc_us + 690) //DssOverhead
  }
  else if (enables.msrc) {
    budget_us += (timeouts.msrc_dss_tcc_us + 660) //MsrcOverhead
  }

  if (enables.pre_range) {
    budget_us += (timeouts.pre_range_us + 660) //PreRangeOverhead
  }
  return budget_us;
}

module.exports = VL53L0X
