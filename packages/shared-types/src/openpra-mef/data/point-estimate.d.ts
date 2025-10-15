/**
 * Representation of a decimal point number used for probabilities, restricted to the range (0, 1).
 */
export class PointEstimate {
    value: number;

    constructor(value: number) {
        this.value = value;
    }

    toXml(printer: (line: string) => void): void {
        printer(`<constant value="${this.value}"/>`);
    }
}
