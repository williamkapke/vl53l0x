import { BytesWritten, openPromisified, PromisifiedBus } from 'i2c-bus'
import { REG } from '#types/registry'
import { IBudget } from '#types/budget'
import { decodeTimeout } from '@utils/encode-decode'
import { timeoutMclksToMicroseconds } from '@utils/calcs'
import { calcCommonBudget } from '@utils/budget'
import { ISequenceEnabled, ISequenceTimeouts } from '#types/sequence'

interface IConfig {
  bus: number
  deviceAddress: number
}

export default class I2CCore {
  private _busModule: PromisifiedBus
  private _bus: number
  private _deviceAddress: number

  constructor(bus: number, addr: number) {
    this._bus = bus
    this._deviceAddress = addr
  }

  protected get config(): IConfig {
    return {
      bus: this._bus,
      deviceAddress: this._deviceAddress,
    }
  }

  protected async _setupProviderModule(): Promise<void> {
    if (typeof this._bus !== 'number') {
      throw new Error(`Provider i2c-bus requires that bus be a number`)
    }

    try {
      this._busModule = await openPromisified(this._bus)
    } catch (error) {
      throw new Error(`openPromisified, ${error}`)
    }
  }

  protected async _write(data: Buffer): Promise<BytesWritten> {
    return await this._busModule.i2cWrite(this._deviceAddress, data.length, data)
  }

  protected async _writeReg(register: REG, value: number, isReg16 = false): Promise<BytesWritten> {
    const data = [register]

    if (isReg16) {
      data.push(...[value >> 8, value & 0xff])
    } else {
      data.push(value)
    }

    const buffer = Buffer.from(data)

    return this._write(buffer)
  }

  protected async _writeMulti(register: REG, array: Buffer): Promise<BytesWritten> {
    return this._write(Buffer.alloc(array.length + 1, register))
  }

  protected async _read(register: REG, length = 1): Promise<Buffer> {
    await this._busModule.i2cWrite(this._deviceAddress, 1, Buffer.alloc(1, register)) // tell it the read index
    return await (await this._busModule.i2cRead(this._deviceAddress, length, Buffer.allocUnsafe(length))).buffer
  }

  protected async _readReg(register: REG, isReg16 = false): Promise<number> {
    if (isReg16) {
      const buffer = await this._read(register, 2)
      return (buffer[0] << 8) | buffer[1]
    }

    return (await this._read(register))[0]
  }

  protected async _readMulti(register: REG, length?: number): Promise<Buffer> {
    return this._read(register, length)
  }

  protected async _getSpadInfo(): Promise<{ count: number; aperture: boolean }> {
    await this._writeReg(REG.POWER_MANAGEMENT_GO1_POWER_FORCE, REG.SYSTEM_SEQUENCE_CONFIG)
    await this._writeReg(0xff, REG.SYSTEM_SEQUENCE_CONFIG) // select collection 1
    await this._writeReg(REG.SYSRANGE_START, REG.SYSRANGE_START) // kinda like read-only=false?

    await this._writeReg(0xff, 0x06)
    const x83 = await this._readReg(0x83) // return hex(x83)
    await this._writeReg(0x83, x83 | REG.SYSTEM_INTERMEASUREMENT_PERIOD)
    await this._writeReg(0xff, 0x07)
    await this._writeReg(REG.SYSTEM_HISTOGRAM_BIN, REG.SYSTEM_SEQUENCE_CONFIG)
    await this._writeReg(REG.POWER_MANAGEMENT_GO1_POWER_FORCE, REG.SYSTEM_SEQUENCE_CONFIG)
    await this._writeReg(0x94, 0x6b)
    await this._writeReg(0x83, REG.SYSRANGE_START)

    // while ((await this._readReg(0x83)) === REG.SYSRANGE_START) {
    //   console.log('not ready') //I haven't gotten here yet
    // }
    // 0x83 seems to be 0x10 now

    await this._writeReg(0x83, REG.SYSTEM_SEQUENCE_CONFIG)

    await this._writeReg(REG.SYSTEM_HISTOGRAM_BIN, REG.SYSRANGE_START)
    await this._writeReg(0xff, 0x06)
    await this._writeReg(0x83, (await this._readReg(0x83)) & ~REG.SYSTEM_INTERMEASUREMENT_PERIOD)

    await this._writeReg(0xff, REG.SYSTEM_SEQUENCE_CONFIG) // select collection 1
    await this._writeReg(REG.SYSRANGE_START, REG.SYSTEM_SEQUENCE_CONFIG) // kinda like read-only=true?
    await this._writeReg(0xff, REG.SYSRANGE_START) // always set back to the default collection
    await this._writeReg(REG.POWER_MANAGEMENT_GO1_POWER_FORCE, REG.SYSRANGE_START)

    const tmp = await this._readReg(0x92)

    return {
      count: tmp & 0x7f,
      aperture: Boolean((tmp >> 7) & REG.SYSTEM_SEQUENCE_CONFIG),
    }
  }

  private async _getSequenceStepEnables(): Promise<ISequenceEnabled> {
    const sequence_config = await this._readReg(REG.SYSTEM_SEQUENCE_CONFIG)

    return {
      msrc: (sequence_config >> 2) & 0x1,
      dss: (sequence_config >> 3) & 0x1,
      tcc: (sequence_config >> 4) & 0x1,
      pre_range: (sequence_config >> 6) & 0x1,
      final_range: (sequence_config >> 7) & 0x1,
    }
  }

  private async _getSequenceStepTimeouts(pre_range: number): Promise<ISequenceTimeouts> {
    const pre_range_vcsel_period_pclks = await this._getVcselPulsePeriod(REG.PRE_RANGE_CONFIG_VCSEL_PERIOD)
    const msrc_dss_tcc_mclks = (await this._readReg(REG.MSRC_CONFIG_TIMEOUT_MACROP)) + 1
    const pre_range_mclks = decodeTimeout(await this._readReg(REG.PRE_RANGE_CONFIG_TIMEOUT_MACROP_HI, true))
    const final_range_vcsel_period_pclks = await this._getVcselPulsePeriod(REG.FINAL_RANGE_CONFIG_VCSEL_PERIOD)
    const final_range_mclks =
      decodeTimeout(await this._readReg(REG.FINAL_RANGE_CONFIG_TIMEOUT_MACROP_HI, true)) -
      (pre_range ? pre_range_mclks : 0)

    return {
      pre_range_vcsel_period_pclks,
      msrc_dss_tcc_mclks,
      msrc_dss_tcc_us: timeoutMclksToMicroseconds(msrc_dss_tcc_mclks, pre_range_vcsel_period_pclks),
      pre_range_mclks,
      pre_range_us: timeoutMclksToMicroseconds(pre_range_mclks, pre_range_vcsel_period_pclks),
      final_range_vcsel_period_pclks,
      final_range_mclks,
      final_range_us: timeoutMclksToMicroseconds(final_range_mclks, final_range_vcsel_period_pclks),
    }
  }

  protected async _getSequenceSteps(): Promise<{ enables: ISequenceEnabled; timeouts: ISequenceTimeouts }> {
    const enables = await this._getSequenceStepEnables()
    const timeouts = await this._getSequenceStepTimeouts(enables.pre_range)

    return {
      enables,
      timeouts,
    }
  }

  protected async _getBudget(v: number): Promise<IBudget> {
    const sequence = await this._getSequenceSteps()
    return {
      enables: sequence.enables,
      timeouts: sequence.timeouts,
      value: calcCommonBudget(v, sequence.enables, sequence.timeouts),
    }
  }

  protected async _getVcselPulsePeriod(type: number): Promise<number> {
    return ((await this._readReg(type)) + 1) << 1
  }
}
