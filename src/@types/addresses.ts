import { Gpio } from 'onoff'

export interface IAddresses {
  [key: number]: { addr: number; gpio?: Gpio; timingBudget: any }
}
