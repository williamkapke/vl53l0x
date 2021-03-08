import { BytesWritten } from 'i2c-bus'
import { REG } from './registry'

export interface API {
  measure: (pin?: number) => Promise<number>
  setSignalRateLimit: (limit_Mcps: number, pin?: number) => Promise<void | BytesWritten>
  getSignalRateLimit: () => Promise<number>
  getMeasurementTimingBudget: () => Promise<number>
  setMeasurementTimingBudget: (budget_us: number, pin?: number) => Promise<void>
  getVcselPulsePeriod: (type: number) => Promise<number>
  setVcselPulsePeriod: (type: 'pre' | 'final', period_pclks: 8 | 10 | 12 | 14 | 16 | 18, pin?: number) => Promise<void>
  performSingleRefCalibration: (vhv_init_byte: number) => Promise<void>
  io: {
    write: (data: Buffer) => Promise<BytesWritten>
    writeReg: (register: REG, value: number, isReg16?: boolean) => Promise<BytesWritten>
    writeMulti: (register: REG, array: Buffer) => Promise<BytesWritten>
    readReg: (register: REG, isReg16?: boolean) => Promise<number>
    readMulti: (register: REG, length?: number) => Promise<Buffer>
  }
}
