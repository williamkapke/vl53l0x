import { BytesWritten } from 'i2c-bus'
import { REG } from './registry'

export interface API {
  measure: (pin?: number | string) => Promise<number>
  setSignalRateLimit(
    limit_Mcps: number,
    pin?: string | number
  ): Promise<
    | void
    | {
        [key: string]: BytesWritten
      }
    | BytesWritten
  >
  getSignalRateLimit(
    pin?: string | number
  ): Promise<
    | number
    | {
        [key: string]: number
      }
  >
  getMeasurementTimingBudget(
    pin?: string | number
  ): Promise<
    | number
    | {
        [key: string]: number
      }
  >
  setMeasurementTimingBudget(budget_us: number, pin: string | number): Promise<void>
  setVcselPulsePeriod: (type: 'pre' | 'final', period_pclks: 8 | 10 | 12 | 14 | 16 | 18, pin?: number) => Promise<void>
  getVcselPulsePeriod(
    type: number,
    pin?: string | number
  ): Promise<
    | number
    | {
        [key: string]: number
      }
  >

  performSingleRefCalibration(vhv_init_byte: number, pin?: string | number): Promise<void>

  io: {
    write(data: Buffer, addr: number): Promise<BytesWritten>
    writeReg(register: REG, value: number, addr: number, isReg16: boolean): Promise<BytesWritten>
    writeMulti(register: REG, array: Buffer, addr: number): Promise<BytesWritten>
    readReg(register: REG, addr: number, isReg16: boolean): Promise<number>
    readMulti(register: REG, addr: number, length?: number): Promise<Buffer>
  }
}
