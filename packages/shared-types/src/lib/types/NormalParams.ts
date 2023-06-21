// ["mean", "std"]
// ["median", "error_factor"]
// ["p5", "p95"];
export enum NormalParams {
  MeanStd = "mean & std",
  MedianErrorFactor = "median & error factor",
  Percentiles = "percentiles"
}

export const NormalParamsMap = {
  [NormalParams.MeanStd]: ["mean", "std"],
  [NormalParams.MedianErrorFactor]: ["error_factor", "median"],
  [NormalParams.Percentiles]: ["p5", "p95"]
};

export const NormalParamsReverseMap = {
  [NormalParamsMap[NormalParams.MeanStd].toString()]: NormalParams.MeanStd,
  [NormalParamsMap[NormalParams.MedianErrorFactor].toString()]: NormalParams.MedianErrorFactor,
  [NormalParamsMap[NormalParams.Percentiles].toString()]: NormalParams.Percentiles
};
