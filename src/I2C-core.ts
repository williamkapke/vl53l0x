import { BytesWritten, openPromisified, PromisifiedBus } from 'i2c-bus'
import { REG } from '#types/registry'
import { IBudget } from '#types/budget'
import { decodeTimeout } from '@utils/encode-decode'
import { timeoutMclksToMicroseconds } from '@utils/calcs'
import { calcCommonBudget } from '@utils/budget'
import { ISequenceEnabled, ISequenceTimeouts } from '#types/sequence'
import { BinaryValue, Gpio } from 'onoff'
import { OPTS } from '#types/options'
import { IAddresses } from '#types/addresses'

interface IConfig {
  bus: number
  devices: IAddresses | number
}

export default class I2CCore {
  private _busModule: PromisifiedBus
  private _bus: number
  protected _addresses: IAddresses
  protected _options: OPTS = {
    signalRateLimit: 0.1,
    vcselPulsePeriod: {
      pre: 18,
      final: 14,
    },
    measurementTimingBudget: 400000,
  }

  constructor(address: number[][] | number, bus: number) {
    this._bus = bus
    this._addressSetup(address)
  }

  private _addressSetup(address: number[][] | number): void {
    if (!this._addresses) {
      this._addresses = {}
    }

    if (address && typeof address !== 'number' && address.length > 0) {
      for (const pin of address) {
        this._addresses[pin[0]] = {
          addr: pin[1],
          gpio: new Gpio(pin[0], 'out'),
          timingBudget: -1,
        }

        this._addresses[pin[0]].gpio.writeSync(0)
      }
    } else if (address && typeof address === 'number') {
      this._addresses[99] = {
        addr: address,
        timingBudget: -1,
      }
    }
  }

  protected async _scan(): Promise<void> {
    const scan = (await this._busModule.scan()).map((s) => '0x' + s.toString(16))
    console.log('SCAN', scan)
  }

  protected get config(): IConfig {
    return {
      bus: this._bus,
      devices: this._addresses,
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

  protected async _gpioWrite(gpio: Gpio, value: BinaryValue): Promise<void> {
    return new Promise((resolve, reject) => {
      gpio.write(value, (err) => {
        if (err) reject(err)

        const timeout = setTimeout(() => {
          clearTimeout(timeout)
          resolve()
        })
      })
    })
  }

  protected async _writeReg(register: REG, value: number, addr: number, isReg16 = false): Promise<BytesWritten> {
    const data: [REG, number?] = [register]

    if (isReg16) {
      data.push(...[value >> 8, value & 0xff])
    } else {
      data.push(value)
    }

    const buffer = Buffer.from(data)

    return this._write(buffer, addr)
  }

  protected async _write(data: Buffer, addr: number): Promise<BytesWritten> {
    return await this._busModule.i2cWrite(addr, data.length, data)
  }

  protected async _writeMulti(register: REG, array: Buffer, addr: number): Promise<BytesWritten> {
    return this._write(Buffer.alloc(array.length + 1, register), addr)
  }

  protected async _read(register: REG, addr: number, length = 1): Promise<Buffer> {
    await this._busModule.i2cWrite(addr, 1, Buffer.alloc(1, register)) // tell it the read index
    return await (await this._busModule.i2cRead(addr, length, Buffer.allocUnsafe(length))).buffer
  }

  protected async _readReg(register: REG, addr: number, isReg16 = false): Promise<number> {
    if (isReg16) {
      const buffer = await this._read(register, addr, 2)
      return (buffer[0] << 8) | buffer[1]
    }

    return (await this._read(register, addr))[0]
  }

  protected async _readMulti(register: REG, addr: number, length?: number): Promise<Buffer> {
    return this._read(register, addr, length)
  }

  protected async _getSpadInfo(pin: number | string): Promise<{ count: number; aperture: boolean }> {
    await this._writeReg(REG.POWER_MANAGEMENT_GO1_POWER_FORCE, REG.SYSTEM_SEQUENCE_CONFIG, this._addresses[pin].addr)
    await this._writeReg(0xff, REG.SYSTEM_SEQUENCE_CONFIG, this._addresses[pin].addr) // select collection 1
    await this._writeReg(REG.SYSRANGE_START, REG.SYSRANGE_START, this._addresses[pin].addr) // kinda like read-only=false?

    await this._writeReg(0xff, 0x06, this._addresses[pin].addr)
    const x83 = await this._readReg(0x83, this._addresses[pin].addr) // return hex(x83)
    await this._writeReg(0x83, x83 | REG.SYSTEM_INTERMEASUREMENT_PERIOD, this._addresses[pin].addr)
    await this._writeReg(0xff, 0x07, this._addresses[pin].addr)
    await this._writeReg(REG.SYSTEM_HISTOGRAM_BIN, REG.SYSTEM_SEQUENCE_CONFIG, this._addresses[pin].addr)
    await this._writeReg(REG.POWER_MANAGEMENT_GO1_POWER_FORCE, REG.SYSTEM_SEQUENCE_CONFIG, this._addresses[pin].addr)
    await this._writeReg(0x94, 0x6b, this._addresses[pin].addr)
    await this._writeReg(0x83, REG.SYSRANGE_START, this._addresses[pin].addr)

    // while ((await this._readReg(0x83)) === REG.SYSRANGE_START) {
    //   console.log('not ready') //I haven't gotten here yet
    // }
    // 0x83 seems to be 0x10 now

    await this._writeReg(0x83, REG.SYSTEM_SEQUENCE_CONFIG, this._addresses[pin].addr)

    await this._writeReg(REG.SYSTEM_HISTOGRAM_BIN, REG.SYSRANGE_START, this._addresses[pin].addr)
    await this._writeReg(0xff, 0x06, this._addresses[pin].addr)
    await this._writeReg(
      0x83,
      (await this._readReg(0x83, this._addresses[pin].addr)) & ~REG.SYSTEM_INTERMEASUREMENT_PERIOD,
      this._addresses[pin].addr
    )

    await this._writeReg(0xff, REG.SYSTEM_SEQUENCE_CONFIG, this._addresses[pin].addr) // select collection 1
    await this._writeReg(REG.SYSRANGE_START, REG.SYSTEM_SEQUENCE_CONFIG, this._addresses[pin].addr) // kinda like read-only=true?
    await this._writeReg(0xff, REG.SYSRANGE_START, this._addresses[pin].addr) // always set back to the default collection
    await this._writeReg(REG.POWER_MANAGEMENT_GO1_POWER_FORCE, REG.SYSRANGE_START, this._addresses[pin].addr)

    const tmp = await this._readReg(0x92, this._addresses[pin].addr)

    return {
      count: tmp & 0x7f,
      aperture: Boolean((tmp >> 7) & REG.SYSTEM_SEQUENCE_CONFIG),
    }
  }

  private async _getSequenceStepEnables(pin: number | string): Promise<ISequenceEnabled> {
    const sequence_config = await this._readReg(REG.SYSTEM_SEQUENCE_CONFIG, this._addresses[pin].addr)

    return {
      msrc: (sequence_config >> 2) & 0x1,
      dss: (sequence_config >> 3) & 0x1,
      tcc: (sequence_config >> 4) & 0x1,
      pre_range: (sequence_config >> 6) & 0x1,
      final_range: (sequence_config >> 7) & 0x1,
    }
  }

  private async _getSequenceStepTimeouts(pre_range: number, pin: number | string): Promise<ISequenceTimeouts> {
    const pre_range_vcsel_period_pclks = await this._getVcselPulsePeriodInternal(REG.PRE_RANGE_CONFIG_VCSEL_PERIOD, pin)
    const msrc_dss_tcc_mclks = (await this._readReg(REG.MSRC_CONFIG_TIMEOUT_MACROP, this._addresses[pin].addr)) + 1
    const pre_range_mclks = decodeTimeout(
      await this._readReg(REG.PRE_RANGE_CONFIG_TIMEOUT_MACROP_HI, this._addresses[pin].addr, true)
    )
    const final_range_vcsel_period_pclks = await this._getVcselPulsePeriodInternal(
      REG.FINAL_RANGE_CONFIG_VCSEL_PERIOD,
      pin
    )
    const final_range_mclks =
      decodeTimeout(await this._readReg(REG.FINAL_RANGE_CONFIG_TIMEOUT_MACROP_HI, this._addresses[pin].addr, true)) -
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

  protected async _getSequenceSteps(
    pin: number | string
  ): Promise<{ enables: ISequenceEnabled; timeouts: ISequenceTimeouts }> {
    const enables = await this._getSequenceStepEnables(pin)
    const timeouts = await this._getSequenceStepTimeouts(enables.pre_range, pin)

    return {
      enables,
      timeouts,
    }
  }

  protected async _getBudget(v: number, pin: number | string): Promise<IBudget> {
    const sequence = await this._getSequenceSteps(pin)
    return {
      enables: sequence.enables,
      timeouts: sequence.timeouts,
      value: calcCommonBudget(v, sequence.enables, sequence.timeouts),
    }
  }

  protected async _getVcselPulsePeriodInternal(type: number, pin: number | string): Promise<number> {
    return ((await this._readReg(type, this._addresses[pin].addr)) + 1) << 1
  }
}
