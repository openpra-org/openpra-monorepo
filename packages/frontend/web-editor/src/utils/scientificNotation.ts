export class ScientificNotation {
  static toScientific(value: number, significantDigits = 3): string {
    if (value === 0) return `0.${"0".repeat(significantDigits - 1)}e+0`;
    const exponent = Math.floor(Math.log10(Math.abs(value)));
    let mantissa = value / Math.pow(10, exponent);
    mantissa = parseFloat(mantissa.toPrecision(significantDigits));
    if (mantissa === 10) {
      mantissa = 1.0;
      return `${mantissa.toFixed(significantDigits - 1)}e${String(exponent + 1)}`;
    }
    return `${mantissa.toFixed(significantDigits - 1)}e${String(exponent)}`;
  }
  static fromScientific(notation: string): number {
    const parsed = Number(notation);
    return isNaN(parsed) ? NaN : parsed;
  }
  static roundScientific(value: number, significantDigits = 3): string {
    return this.toScientific(value, significantDigits);
  }
}
