import { type SeismicPRA } from "interfaces-mef-types/seismic/seismic-pra";

type HazardCurve =
  SeismicPRA["seismicHazardAnalysis"]["hazardQuantification"]["hazardCurves"][number];
type SecondaryHazardCurve = NonNullable<
  SeismicPRA["seismicHazardAnalysis"]["secondaryHazardEvaluation"]["hazards"][number]["retainedAnalysis"]
>["hazardCurves"][number];
type SeismicResponseResult =
  SeismicPRA["seismicFragilityAnalysis"]["seismicResponseAnalysis"]["responseResults"][number];

interface HazardFanPoint {
  x: number;
  low: number;
  median: number;
  mean: number;
  high: number;
}

type SpectrumDirection = "HORIZONTAL" | "VERTICAL";

function curveAtFractile(
  curves: HazardCurve[],
  fractile: number,
): HazardCurve | undefined {
  return curves.find((curve) =>
    curve.statistic === "FRACTILE"
    && curve.fractile !== undefined
    && Math.abs(curve.fractile - fractile) < 1e-9);
}

function motionValueAtFrequency(
  curve: HazardCurve | undefined,
  target: number,
): number | undefined {
  if (curve === undefined || curve.points.length === 0 || target <= 0) return undefined;
  const points = [...curve.points]
    .filter((point) =>
      point.groundMotion > 0 && point.annualFrequencyOfExceedance > 0)
    .sort((left, right) => left.groundMotion - right.groundMotion);
  if (points.length === 0) return undefined;

  for (let index = 0; index < points.length - 1; index += 1) {
    const left = points[index]!;
    const right = points[index + 1]!;
    if (
      left.annualFrequencyOfExceedance >= target
      && right.annualFrequencyOfExceedance <= target
    ) {
      if (left.annualFrequencyOfExceedance === right.annualFrequencyOfExceedance) {
        return Math.sqrt(left.groundMotion * right.groundMotion);
      }
      const fraction = (
        Math.log(target) - Math.log(left.annualFrequencyOfExceedance)
      ) / (
        Math.log(right.annualFrequencyOfExceedance)
        - Math.log(left.annualFrequencyOfExceedance)
      );
      return Math.exp(
        Math.log(left.groundMotion)
        + fraction * (Math.log(right.groundMotion) - Math.log(left.groundMotion)),
      );
    }
  }

  if (target > points[0]!.annualFrequencyOfExceedance) {
    return points[0]!.groundMotion;
  }
  return points.at(-1)!.groundMotion;
}

function hazardCurveFanSeries(
  mef: SeismicPRA,
  parameterRef: string,
): HazardFanPoint[] {
  const curves = mef.seismicHazardAnalysis.hazardQuantification.hazardCurves
    .filter((curve) => curve.groundMotionParameterRef === parameterRef);
  const meanCurve = curves.find((curve) => curve.statistic === "MEAN");
  const lowCurve = curveAtFractile(curves, 0.05);
  const medianCurve = curveAtFractile(curves, 0.5);
  const highCurve = curveAtFractile(curves, 0.95);
  if (
    meanCurve === undefined
    || lowCurve === undefined
    || medianCurve === undefined
    || highCurve === undefined
  ) return [];

  const valuesAtMotion = (curve: HazardCurve): Map<number, number> =>
    new Map(curve.points.map((point) => [
      point.groundMotion,
      point.annualFrequencyOfExceedance,
    ]));
  const lowValues = valuesAtMotion(lowCurve);
  const medianValues = valuesAtMotion(medianCurve);
  const highValues = valuesAtMotion(highCurve);

  return meanCurve.points.flatMap((point) => {
    const low = lowValues.get(point.groundMotion);
    const median = medianValues.get(point.groundMotion);
    const high = highValues.get(point.groundMotion);
    return low === undefined || median === undefined || high === undefined
      ? []
      : [{
        x: point.groundMotion,
        low,
        median,
        mean: point.annualFrequencyOfExceedance,
        high,
      }];
  });
}

function responseSpectrumFanSeries(
  mef: SeismicPRA,
  direction: SpectrumDirection,
  targetAnnualFrequency: number,
): HazardFanPoint[] {
  const sha = mef.seismicHazardAnalysis;
  const parameters = sha.analysisBasis.groundMotionParameters
    .filter((parameter) =>
      direction === "VERTICAL"
        ? parameter.direction === "VERTICAL"
        : parameter.direction !== "VERTICAL")
    .sort((left, right) => {
      const leftFrequency = left.parameterType === "PEAK_GROUND_ACCELERATION"
        ? 100
        : left.selectedFrequencyRangeHz.lower;
      const rightFrequency = right.parameterType === "PEAK_GROUND_ACCELERATION"
        ? 100
        : right.selectedFrequencyRangeHz.lower;
      return rightFrequency - leftFrequency;
    });

  return parameters.flatMap((parameter) => {
    const frequencyHz = parameter.parameterType === "PEAK_GROUND_ACCELERATION"
      ? 100
      : parameter.selectedFrequencyRangeHz.lower;
    const curves = sha.hazardQuantification.hazardCurves
      .filter((curve) => curve.groundMotionParameterRef === parameter.uuid);
    const low = motionValueAtFrequency(
      curveAtFractile(curves, 0.05),
      targetAnnualFrequency,
    );
    const median = motionValueAtFrequency(
      curveAtFractile(curves, 0.5),
      targetAnnualFrequency,
    );
    const mean = motionValueAtFrequency(
      curves.find((curve) => curve.statistic === "MEAN"),
      targetAnnualFrequency,
    );
    const high = motionValueAtFrequency(
      curveAtFractile(curves, 0.95),
      targetAnnualFrequency,
    );
    return low === undefined
      || median === undefined
      || mean === undefined
      || high === undefined
      ? []
      : [{
        x: 1 / frequencyHz,
        low,
        median,
        mean,
        high,
      }];
  });
}

function secondaryHazardFanSeries(
  curves: SecondaryHazardCurve[],
): HazardFanPoint[] {
  const curveAt = (
    fractile: number,
  ): SecondaryHazardCurve | undefined => curves.find((curve) =>
    curve.statistic === "FRACTILE"
    && curve.fractile !== undefined
    && Math.abs(curve.fractile - fractile) < 1e-9);
  const meanCurve = curves.find((curve) => curve.statistic === "MEAN");
  const lowCurve = curveAt(0.05);
  const medianCurve = curveAt(0.5);
  const highCurve = curveAt(0.95);
  if (
    meanCurve === undefined
    || lowCurve === undefined
    || medianCurve === undefined
    || highCurve === undefined
  ) return [];

  const valuesAtLevel = (
    curve: SecondaryHazardCurve,
  ): Map<number, number> => new Map(curve.points.map((point) => [
    point.hazardLevel,
    point.annualFrequencyOfExceedance,
  ]));
  const lowValues = valuesAtLevel(lowCurve);
  const medianValues = valuesAtLevel(medianCurve);
  const highValues = valuesAtLevel(highCurve);

  return meanCurve.points.flatMap((point) => {
    const low = lowValues.get(point.hazardLevel);
    const median = medianValues.get(point.hazardLevel);
    const high = highValues.get(point.hazardLevel);
    return low === undefined || median === undefined || high === undefined
      ? []
      : [{
        x: point.hazardLevel,
        low,
        median,
        mean: point.annualFrequencyOfExceedance,
        high,
      }];
  });
}

function structuralResponseFanSeries(
  result: SeismicResponseResult | undefined,
): HazardFanPoint[] {
  if (result?.spectrumPoints === undefined) return [];
  const beta = result.compositeBeta
    ?? Math.sqrt(result.betaRandomness ** 2 + result.betaUncertainty ** 2);
  return result.spectrumPoints
    .filter((point) => point.frequencyHz > 0 && point.medianResponse > 0)
    .map((point) => ({
      x: point.frequencyHz,
      low: point.medianResponse * Math.exp(-1.644854 * beta),
      median: point.medianResponse,
      mean: point.medianResponse * Math.exp(0.5 * beta ** 2),
      high: point.medianResponse * Math.exp(1.644854 * beta),
    }));
}

export {
  hazardCurveFanSeries,
  motionValueAtFrequency,
  responseSpectrumFanSeries,
  secondaryHazardFanSeries,
  structuralResponseFanSeries,
  type HazardFanPoint,
  type SpectrumDirection,
};
