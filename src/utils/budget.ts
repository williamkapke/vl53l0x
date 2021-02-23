import { ISequenceEnabled, ISequenceTimeouts } from '#types/sequence'

export const calcCommonBudget = (budget_us: number, enables: ISequenceEnabled, timeouts: ISequenceTimeouts): number => {
  if (enables.tcc) {
    budget_us += timeouts.msrc_dss_tcc_us + 590 //TccOverhead
  }

  if (enables.dss) {
    budget_us += 2 * (timeouts.msrc_dss_tcc_us + 690) //DssOverhead
  } else if (enables.msrc) {
    budget_us += timeouts.msrc_dss_tcc_us + 660 //MsrcOverhead
  }

  if (enables.pre_range) {
    budget_us += timeouts.pre_range_us + 660 //PreRangeOverhead
  }

  return budget_us
}
