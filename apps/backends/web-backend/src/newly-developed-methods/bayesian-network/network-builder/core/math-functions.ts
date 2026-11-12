const ERX = 8.45062911510467529297e-1;
const EFX = 1.28379167095512586316e-1;
const EFX8 = 1.02703333676410069053;
const PP = [
  1.28379167095512558561e-1, -3.2504210724700149937e-1, -2.84817495755985104766e-2, -5.77027029648944159157e-3,
  -2.37630166566501626084e-5,
];
const QQ = [
  3.97917223959155352819e-1, 6.50222499887672944485e-2, 5.08130628187576562776e-3, 1.32494738004321644526e-4,
  -3.9602282787753681232e-6,
];
const PA = [
  -2.36211856075265944077e-3, 4.14856118683748331666e-1, -3.72207876035701323847e-1, 3.18346619901161753674e-1,
  -1.10894694282396677476e-1, 3.54783043256182359371e-2, -2.166375594868790843e-3,
];
const QA = [
  1.06420880400844228286e-1, 5.40397917702171048937e-1, 7.18286544141962662868e-2, 1.26171219808761642112e-1,
  1.36370839120290507362e-2, 1.1984499846799107417e-2,
];
const RA = [
  -9.86494403484714822705e-3, -6.93858572707181764372e-1, -1.05586262253232909814e1, -6.23753324503260060396e1,
  -1.62396669462573470355e2, -1.84605092906711035994e2, -8.12874355063065934246e1, -9.81432934416914548592,
];
const SA = [
  1.96512716674392571292e1, 1.376577541435190426e2, 4.34565877475229228821e2, 6.45387271733267880336e2,
  4.29008140027567833386e2, 1.08635005541779435134e2, 6.57024977031928170135, -6.04244152148580987438e-2,
];
const RB = [
  -9.86494292470009928597e-3, -7.99283237680523006574e-1, -1.77579549177547519889e1, -1.60636384855821916062e2,
  -6.37566443368389627722e2, -1.02509513161107724954e3, -4.83519191608651397019e2,
];
const SB = [
  3.03380607434824582924e1, 3.25792512996573918826e2, 1.53672958608443695994e3, 3.19985821950859553908e3,
  2.55305040643316442583e3, 4.74528541206955367215e2, -2.24409524465858183362e1,
];

const polynomial = (coefficients: readonly number[], argument: number): number => {
  let total = coefficients[coefficients.length - 1];
  for (let index = coefficients.length - 2; index >= 0; index -= 1) total = coefficients[index] + argument * total;
  return total;
};

const unitPolynomial = (coefficients: readonly number[], argument: number): number =>
  1 + argument * polynomial(coefficients, argument);

const clearLowWord = (value: number): number => {
  const view = new DataView(new ArrayBuffer(8));
  view.setFloat64(0, value);
  view.setUint32(4, 0);
  return view.getFloat64(0);
};

const errorFunction = (value: number): number => {
  if (Number.isNaN(value)) return NaN;
  if (value === Infinity) return 1;
  if (value === -Infinity) return -1;
  const magnitude = Math.abs(value);
  if (magnitude < 0.84375) {
    if (magnitude < 2 ** -28) {
      if (magnitude < 2 ** -1015) return 0.125 * (8 * value + EFX8 * value);
      return value + EFX * value;
    }
    const square = value * value;
    return value + value * (polynomial(PP, square) / unitPolynomial(QQ, square));
  }
  if (magnitude < 1.25) {
    const shifted = magnitude - 1;
    const ratio = polynomial(PA, shifted) / unitPolynomial(QA, shifted);
    return value >= 0 ? ERX + ratio : -ERX - ratio;
  }
  if (magnitude >= 6) return value >= 0 ? 1 - 1e-300 : 1e-300 - 1;
  const inverseSquare = 1 / (magnitude * magnitude);
  const ratio =
    magnitude < 1 / 0.35 ?
      polynomial(RA, inverseSquare) / unitPolynomial(SA, inverseSquare)
    : polynomial(RB, inverseSquare) / unitPolynomial(SB, inverseSquare);
  const truncated = clearLowWord(magnitude);
  const tail =
    Math.exp(-truncated * truncated - 0.5625) * Math.exp((truncated - magnitude) * (truncated + magnitude) + ratio);
  return value >= 0 ? 1 - tail / magnitude : tail / magnitude - 1;
};

const isClose = (left: number, right: number, relativeTolerance: number, absoluteTolerance: number): boolean => {
  if (left === right) return true;
  if (!Number.isFinite(left) || !Number.isFinite(right)) return false;
  const difference = Math.abs(right - left);
  return (
    difference <= Math.abs(relativeTolerance * right) ||
    difference <= Math.abs(relativeTolerance * left) ||
    difference <= absoluteTolerance
  );
};

export { errorFunction, isClose };
