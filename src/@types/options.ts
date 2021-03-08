export interface OPTS {
  signalRateLimit?: number
  vcselPulsePeriod?: {
    pre: 12 | 14 | 16 | 18
    final: 12 | 14 | 16 | 18
  }
  measurementTimingBudget?: number
}
