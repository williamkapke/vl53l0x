import { ISequenceEnabled, ISequenceTimeouts } from './sequence'

export interface IBudget {
  enables: ISequenceEnabled
  timeouts: ISequenceTimeouts
  value: number
}
