export interface ISequenceEnabled {
  msrc: number
  dss: number
  tcc: number
  pre_range: number
  final_range: number
}

export interface ISequenceTimeouts {
  pre_range_vcsel_period_pclks: number
  msrc_dss_tcc_mclks: number
  msrc_dss_tcc_us: number
  pre_range_mclks: number
  pre_range_us: number
  final_range_vcsel_period_pclks: number
  final_range_mclks: number
  final_range_us: number
}
