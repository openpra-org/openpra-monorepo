export class ScientificNotation {
  /**
   * Converts a number to scientific notation with proper rounding.
   * @param value The number to format
   * @param significantDigits Number of significant digits
   * @returns A string representation in scientific notation
   */
  static toScientific(value: number, significantDigits = 3): string {
    if (value === 0) return `0.${"0".repeat(significantDigits - 1)}e+0`;
    const exponent = Math.floor(Math.log10(Math.abs(value)));
    let mantissa = value / Math.pow(10, exponent);

    // Round mantissa
    mantissa = parseFloat(mantissa.toPrecision(significantDigits));

    // If rounding pushed mantissa to 10, adjust exponent
    if (mantissa === 10) {
      mantissa = 1.0;
      return `${mantissa.toFixed(significantDigits - 1)}e${exponent + 1}`;
    }

    return `${mantissa.toFixed(significantDigits - 1)}e${exponent}`;
  }

  /**
   * Parses a scientific notation string back to a number.
   * @param notation The scientific notation string (e.g., "3.14e-5")
   * @returns The parsed number, or NaN if invalid
   */
  static fromScientific(notation: string): number {
    const parsed = Number(notation);
    return isNaN(parsed) ? NaN : parsed;
  }

  /**
   * Rounds a number while preserving scientific notation.
   * @param value The number to round
   * @param significantDigits The number of significant digits
   * @returns A rounded scientific notation string
   */
  static roundScientific(value: number, significantDigits = 3): string {
    return this.toScientific(value, significantDigits);
  }
}
