/** Serialize application JSON data without losing negative zero. */
export function stringifyJson(value: unknown, space?: string | number): string | undefined;
export function numberText(value: number): string;
/** Express-compatible JSON response middleware; does not alter input parsing. */
export function jsonResponses(request: unknown, response: any, next: () => void): void;
