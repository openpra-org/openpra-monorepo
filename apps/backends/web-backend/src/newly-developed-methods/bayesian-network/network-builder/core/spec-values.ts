import { NetworkBuilderError } from "./errors";

type SpecValue = string | number | boolean | null | SpecValue[] | SpecMapping;

interface SpecMapping {
  [key: string]: SpecValue;
}

type OptionalSpecValue = SpecValue | undefined;

const isMapping = (value: OptionalSpecValue): value is SpecMapping =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isSequence = (value: OptionalSpecValue): value is SpecValue[] => Array.isArray(value);

const KEY_ORDER = Symbol("keyOrder");

const isArrayIndexText = (key: string): boolean => {
  if (key.length === 0 || key.length > 10) return false;
  if (key === "0") return true;
  if (key[0] < "1" || key[0] > "9") return false;
  for (let index = 1; index < key.length; index += 1) {
    if (key[index] < "0" || key[index] > "9") return false;
  }
  return Number(key) < 4294967295;
};

const recordKeyOrder = <Target extends object>(mapping: Target, keys: readonly string[]): Target => {
  if (keys.some(isArrayIndexText)) {
    Object.defineProperty(mapping, KEY_ORDER, {
      value: Array.from(keys),
      enumerable: true,
      writable: true,
      configurable: true,
    });
  }
  return mapping;
};

const keysOf = (mapping: object): string[] => {
  const own = Object.keys(mapping);
  const stored: string[] | undefined = Reflect.get(mapping, KEY_ORDER);
  if (!Array.isArray(stored)) return own;
  const present = new Set(own);
  const seen = new Set<string>();
  const ordered: string[] = [];
  for (const key of stored) {
    if (present.has(key) && !seen.has(key)) {
      ordered.push(key);
      seen.add(key);
    }
  }
  for (const key of own) {
    if (!seen.has(key)) ordered.push(key);
  }
  return ordered;
};

const entriesOf = <Value>(mapping: { [key: string]: Value }): [string, Value][] =>
  keysOf(mapping).map((key) => [key, mapping[key]]);

const valuesOf = <Value>(mapping: { [key: string]: Value }): Value[] => keysOf(mapping).map((key) => mapping[key]);

const hasKey = (mapping: SpecMapping, key: string): boolean => Object.prototype.hasOwnProperty.call(mapping, key);

const getValue = (mapping: SpecMapping, key: string): SpecValue => (hasKey(mapping, key) ? mapping[key] : null);

const getValueOr = (mapping: SpecMapping, key: string, fallback: SpecValue): SpecValue =>
  hasKey(mapping, key) ? mapping[key] : fallback;

const typeName = (value: OptionalSpecValue): string => {
  if (value === null || value === undefined) return "NoneType";
  if (typeof value === "boolean") return "bool";
  if (typeof value === "string") return "str";
  if (typeof value === "number") return Number.isInteger(value) ? "int" : "float";
  if (Array.isArray(value)) return "list";
  return "dict";
};

const compareText = (left: string, right: string): number => {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
};

const sortedText = (values: Iterable<string>): string[] => Array.from(values).sort(compareText);

const isAsciiDigit = (character: string): boolean => character >= "0" && character <= "9";

const isAsciiLetter = (character: string): boolean =>
  (character >= "a" && character <= "z") || (character >= "A" && character <= "Z");

const isAsciiAlphanumeric = (character: string): boolean => isAsciiDigit(character) || isAsciiLetter(character);

const isWhitespace = (character: string): boolean =>
  character === " " ||
  character === "\t" ||
  character === "\n" ||
  character === "\r" ||
  character === "\v" ||
  character === "\f" ||
  character === "\u001c" ||
  character === "\u001d" ||
  character === "\u001e" ||
  character === "\u001f" ||
  character === "\u0085" ||
  character === " " ||
  character === " " ||
  (character >= " " && character <= " ") ||
  character === " " ||
  character === " " ||
  character === " " ||
  character === " " ||
  character === "　";

const stripWith = (source: string, shouldStrip: (character: string) => boolean): string => {
  let start = 0;
  let end = source.length;
  while (start < end && shouldStrip(source[start])) start += 1;
  while (end > start && shouldStrip(source[end - 1])) end -= 1;
  return source.slice(start, end);
};

const strip = (source: string): string => stripWith(source, isWhitespace);

const stripCharacters = (source: string, characters: string): string =>
  stripWith(source, (character) => characters.includes(character));

const replaceRuns = (source: string, keep: (character: string) => boolean, replacement: string): string => {
  let output = "";
  let inRun = false;
  for (const character of Array.from(source)) {
    if (keep(character)) {
      output += character;
      inRun = false;
    } else if (!inRun) {
      output += replacement;
      inRun = true;
    }
  }
  return output;
};

const replaceNonAlphanumericRuns = (source: string, replacement: string): string =>
  replaceRuns(source, isAsciiAlphanumeric, replacement);

const replaceNonIdentifierRuns = (source: string, replacement: string): string =>
  replaceRuns(source, (character) => isAsciiAlphanumeric(character) || character === "_", replacement);

const collapseUnderscores = (source: string): string => {
  let output = "";
  let previousUnderscore = false;
  for (const character of Array.from(source)) {
    if (character === "_") {
      if (!previousUnderscore) output += character;
      previousUnderscore = true;
    } else {
      output += character;
      previousUnderscore = false;
    }
  }
  return output;
};

const startsWithIdentifierStart = (source: string): boolean =>
  source.length > 0 && (isAsciiLetter(source[0]) || source[0] === "_");

const isIdentifier = (source: string): boolean =>
  startsWithIdentifierStart(source) &&
  Array.from(source).every((character) => isAsciiAlphanumeric(character) || character === "_");

const isCased = (character: string): boolean => character.toLowerCase() !== character.toUpperCase();

const titleCase = (source: string): string => {
  let output = "";
  let previousCased = false;
  for (const character of Array.from(source)) {
    if (isCased(character)) {
      output += previousCased ? character.toLowerCase() : character.toUpperCase();
      previousCased = true;
    } else {
      output += character;
      previousCased = false;
    }
  }
  return output;
};

interface DecimalParts {
  negative: boolean;
  digits: string;
  pointPosition: number;
}

const exactDecimal = (value: number): DecimalParts => {
  const view = new DataView(new ArrayBuffer(8));
  view.setFloat64(0, value);
  const high = view.getUint32(0);
  const low = view.getUint32(4);
  const negative = high >>> 31 === 1;
  const biasedExponent = (high >>> 20) & 0x7ff;
  const fraction = (BigInt(high & 0xfffff) << 32n) | BigInt(low);
  const mantissa = biasedExponent === 0 ? fraction : fraction | (1n << 52n);
  const exponent = biasedExponent === 0 ? -1074 : biasedExponent - 1075;
  if (mantissa === 0n) return { negative, digits: "0", pointPosition: 1 };
  if (exponent >= 0) {
    const digits = (mantissa << BigInt(exponent)).toString();
    return { negative, digits, pointPosition: digits.length };
  }
  const scaled = (mantissa * 5n ** BigInt(-exponent)).toString();
  return { negative, digits: scaled, pointPosition: scaled.length + exponent };
};

const roundHalfEven = (digits: string, keep: number): { digits: string; carried: boolean } => {
  if (keep >= digits.length) return { digits: digits + "0".repeat(keep - digits.length), carried: false };
  const head = digits.slice(0, keep);
  const next = digits.charCodeAt(keep) - 48;
  const restNonZero = Array.from(digits.slice(keep + 1)).some((character) => character !== "0");
  const lastOdd = keep > 0 ? (head.charCodeAt(keep - 1) - 48) % 2 === 1 : false;
  const roundUp = next > 5 || (next === 5 && (restNonZero || lastOdd));
  if (!roundUp) return { digits: head, carried: false };
  if (keep === 0) return { digits: "1", carried: true };
  const incremented = (BigInt(head) + 1n).toString().padStart(keep, "0");
  return { digits: incremented, carried: incremented.length > keep };
};

const nonFiniteText = (value: number): string | null => {
  if (Number.isNaN(value)) return "nan";
  if (value === Infinity) return "inf";
  if (value === -Infinity) return "-inf";
  return null;
};

const exponentText = (exponent: number): string => {
  const sign = exponent < 0 ? "-" : "+";
  const magnitude = Math.abs(exponent).toString();
  return `e${sign}${magnitude.length < 2 ? `0${magnitude}` : magnitude}`;
};

const formatFixed = (value: number, decimals: number): string => {
  const special = nonFiniteText(value);
  if (special !== null) return special;
  const parts = exactDecimal(value);
  let source = parts.digits;
  let point = parts.pointPosition;
  if (point < 0) {
    source = "0".repeat(-point) + source;
    point = 0;
  }
  const rounded = roundHalfEven(source, point + decimals);
  const integerLength = rounded.carried ? point + 1 : point;
  const integerPart = rounded.digits.slice(0, integerLength);
  const fractionPart = rounded.digits.slice(integerLength).padEnd(decimals, "0").slice(0, decimals);
  const sign = parts.negative ? "-" : "";
  const whole = integerPart === "" ? "0" : integerPart;
  return decimals > 0 ? `${sign}${whole}.${fractionPart}` : `${sign}${whole}`;
};

const scientificParts = (value: number, precision: number): { negative: boolean; digits: string; exponent: number } => {
  const parts = exactDecimal(value);
  if (parts.digits === "0") return { negative: parts.negative, digits: "0".repeat(precision), exponent: 0 };
  let firstNonZero = 0;
  while (parts.digits[firstNonZero] === "0") firstNonZero += 1;
  const trimmed = parts.digits.slice(firstNonZero);
  let exponent = parts.pointPosition - firstNonZero - 1;
  const rounded = roundHalfEven(trimmed, precision);
  let digits = rounded.digits;
  if (rounded.carried) {
    digits = digits.slice(0, precision);
    exponent += 1;
  }
  return { negative: parts.negative, digits, exponent };
};

const formatExponent = (value: number, decimals: number): string => {
  const special = nonFiniteText(value);
  if (special !== null) return special;
  const parts = scientificParts(value, decimals + 1);
  const mantissa = decimals > 0 ? `${parts.digits[0]}.${parts.digits.slice(1)}` : parts.digits[0];
  return `${parts.negative ? "-" : ""}${mantissa}${exponentText(parts.exponent)}`;
};

const stripTrailingZeros = (source: string): string => {
  if (!source.includes(".")) return source;
  let end = source.length;
  while (end > 0 && source[end - 1] === "0") end -= 1;
  if (end > 0 && source[end - 1] === ".") end -= 1;
  return source.slice(0, end);
};

const formatGeneral = (value: number, precision: number): string => {
  const special = nonFiniteText(value);
  if (special !== null) return special;
  const effective = precision === 0 ? 1 : precision;
  const parts = scientificParts(value, effective);
  if (parts.exponent < -4 || parts.exponent >= effective) {
    const mantissa =
      effective > 1 ? stripTrailingZeros(`${parts.digits[0]}.${parts.digits.slice(1)}`) : parts.digits[0];
    return `${parts.negative ? "-" : ""}${mantissa}${exponentText(parts.exponent)}`;
  }
  return stripTrailingZeros(formatFixed(value, effective - 1 - parts.exponent));
};

const floatRepr = (value: number): string => {
  const special = nonFiniteText(value);
  if (special !== null) return special;
  if (value === 0) return Object.is(value, -0) ? "-0.0" : "0.0";
  const source = Math.abs(value).toExponential();
  const marker = source.indexOf("e");
  const digits = source.slice(0, marker).split(".").join("");
  const exponent = Number(source.slice(marker + 1));
  const sign = value < 0 ? "-" : "";
  if (exponent < -4 || exponent >= 16) {
    const mantissa = digits.length > 1 ? `${digits[0]}.${digits.slice(1)}` : digits[0];
    return `${sign}${mantissa}${exponentText(exponent)}`;
  }
  if (exponent < 0) return `${sign}0.${"0".repeat(-exponent - 1)}${digits}`;
  if (digits.length <= exponent + 1) return `${sign}${digits}${"0".repeat(exponent + 1 - digits.length)}.0`;
  return `${sign}${digits.slice(0, exponent + 1)}.${digits.slice(exponent + 1)}`;
};

const numberText = (value: number): string => (Number.isInteger(value) ? value.toFixed(0) : floatRepr(value));

const UNPRINTABLE_RANGES: [number, number][] = [
  [0x00, 0x1f],
  [0x7f, 0xa0],
  [0xad, 0xad],
  [0x061c, 0x061c],
  [0x1680, 0x1680],
  [0x180e, 0x180e],
  [0x2000, 0x200f],
  [0x2028, 0x202f],
  [0x205f, 0x2064],
  [0x2066, 0x206f],
  [0x3000, 0x3000],
  [0xd800, 0xf8ff],
  [0xfeff, 0xfeff],
  [0xfff9, 0xfffb],
];

const isPrintableCode = (code: number): boolean =>
  !UNPRINTABLE_RANGES.some(([low, high]) => code >= low && code <= high);

const escapeCode = (code: number): string => {
  if (code < 0x100) return `\\x${code.toString(16).padStart(2, "0")}`;
  if (code < 0x10000) return `\\u${code.toString(16).padStart(4, "0")}`;
  return `\\U${code.toString(16).padStart(8, "0")}`;
};

const textRepr = (source: string): string => {
  const quote = source.includes("'") && !source.includes('"') ? '"' : "'";
  let output = quote;
  for (const character of Array.from(source)) {
    const code = character.codePointAt(0) ?? 0;
    if (character === "\\") output += "\\\\";
    else if (character === quote) output += `\\${quote}`;
    else if (character === "\n") output += "\\n";
    else if (character === "\r") output += "\\r";
    else if (character === "\t") output += "\\t";
    else if (!isPrintableCode(code)) output += escapeCode(code);
    else output += character;
  }
  return output + quote;
};

const repr = (value: OptionalSpecValue): string => {
  if (value === null || value === undefined) return "None";
  if (typeof value === "boolean") return value ? "True" : "False";
  if (typeof value === "number") return numberText(value);
  if (typeof value === "string") return textRepr(value);
  if (Array.isArray(value)) return `[${value.map((item) => repr(item)).join(", ")}]`;
  return `{${keysOf(value)
    .map((key) => `${textRepr(key)}: ${repr(value[key])}`)
    .join(", ")}}`;
};

const tupleRepr = (values: readonly SpecValue[]): string =>
  values.length === 1 ? `(${repr(values[0])},)` : `(${values.map((item) => repr(item)).join(", ")})`;

const floatListRepr = (values: readonly number[]): string => `[${values.map((item) => floatRepr(item)).join(", ")}]`;

const text = (value: OptionalSpecValue): string => (typeof value === "string" ? value : repr(value));

const truthy = (value: OptionalSpecValue): boolean => {
  if (value === null || value === undefined) return false;
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  if (typeof value === "string") return value.length > 0;
  if (Array.isArray(value)) return value.length > 0;
  return Object.keys(value).length > 0;
};

const DECIMAL_ZERO_CODE_POINTS = [
  1632, 1776, 1984, 2406, 2534, 2662, 2790, 2918, 3046, 3174, 3302, 3430, 3558, 3664, 3792, 3872, 4160, 4240, 6112,
  6160, 6470, 6608, 6784, 6800, 6992, 7088, 7232, 7248, 42528, 43216, 43264, 43472, 43504, 43600, 44016, 65296, 66720,
  68912, 69734, 69872, 69942, 70096, 70384, 70736, 70864, 71248, 71360, 71472, 71904, 72016, 72784, 73040, 73120, 73552,
  92768, 92864, 93008, 120782, 120792, 120802, 120812, 120822, 123200, 123632, 124144, 125264, 130032,
];

const asciiDigits = (source: string): string => {
  let output = "";
  for (const character of Array.from(source)) {
    const code = character.codePointAt(0) ?? 0;
    if (code < 1632) {
      output += character;
      continue;
    }
    const zero = DECIMAL_ZERO_CODE_POINTS.find((start) => code >= start && code < start + 10);
    output += zero === undefined ? character : String(code - zero);
  }
  return output;
};

const parseDecimalText = (source: string): number | null => {
  const trimmed = asciiDigits(strip(source));
  if (trimmed.length === 0) return null;
  let body = trimmed;
  let sign = 1;
  if (body[0] === "+" || body[0] === "-") {
    sign = body[0] === "-" ? -1 : 1;
    body = body.slice(1);
  }
  const lowered = body.toLowerCase();
  if (lowered === "inf" || lowered === "infinity") return sign * Infinity;
  if (lowered === "nan") return NaN;
  let cleaned = "";
  let mantissaDigits = 0;
  let pointSeen = false;
  let exponentSeen = false;
  let exponentDigits = 0;
  for (let index = 0; index < body.length; index += 1) {
    const character = body[index];
    if (isAsciiDigit(character)) {
      cleaned += character;
      if (exponentSeen) exponentDigits += 1;
      else mantissaDigits += 1;
    } else if (character === "_") {
      const previous = index > 0 ? body[index - 1] : "";
      const next = index + 1 < body.length ? body[index + 1] : "";
      if (!isAsciiDigit(previous) || !isAsciiDigit(next)) return null;
    } else if (character === "." && !pointSeen && !exponentSeen) {
      pointSeen = true;
      cleaned += character;
    } else if ((character === "e" || character === "E") && !exponentSeen && mantissaDigits > 0) {
      exponentSeen = true;
      cleaned += "e";
      const next = index + 1 < body.length ? body[index + 1] : "";
      if (next === "+" || next === "-") {
        cleaned += next;
        index += 1;
      }
    } else {
      return null;
    }
  }
  if (mantissaDigits === 0) return null;
  if (exponentSeen && exponentDigits === 0) return null;
  return sign * Number(cleaned);
};

const toFloat = (value: OptionalSpecValue): number => {
  if (typeof value === "number") return value;
  if (typeof value === "boolean") return value ? 1 : 0;
  if (typeof value === "string") {
    const parsed = parseDecimalText(value);
    if (parsed === null) {
      throw new NetworkBuilderError("ValueError", `could not convert string to float: ${textRepr(value)}`);
    }
    return parsed;
  }
  throw new NetworkBuilderError(
    "TypeError",
    `float() argument must be a string or a real number, not '${typeName(value)}'`,
  );
};

const toInteger = (value: OptionalSpecValue): number => {
  if (typeof value === "number") {
    if (Number.isNaN(value)) throw new NetworkBuilderError("ValueError", "cannot convert float NaN to integer");
    if (!Number.isFinite(value)) {
      throw new NetworkBuilderError("OverflowError", "cannot convert float infinity to integer");
    }
    return Math.trunc(value);
  }
  if (typeof value === "boolean") return value ? 1 : 0;
  if (typeof value === "string") {
    let body = asciiDigits(strip(value));
    let sign = 1;
    if (body[0] === "+" || body[0] === "-") {
      sign = body[0] === "-" ? -1 : 1;
      body = body.slice(1);
    }
    let cleaned = "";
    let valid = body.length > 0;
    for (let index = 0; index < body.length && valid; index += 1) {
      const character = body[index];
      if (isAsciiDigit(character)) cleaned += character;
      else if (character === "_") {
        const previous = index > 0 ? body[index - 1] : "";
        const next = index + 1 < body.length ? body[index + 1] : "";
        if (!isAsciiDigit(previous) || !isAsciiDigit(next)) valid = false;
      } else valid = false;
    }
    if (!valid || cleaned.length === 0) {
      throw new NetworkBuilderError("ValueError", `invalid literal for int() with base 10: ${textRepr(value)}`);
    }
    return sign * Number(cleaned);
  }
  throw new NetworkBuilderError(
    "TypeError",
    `int() argument must be a string, a bytes-like object or a real number, not '${typeName(value)}'`,
  );
};

const iterValues = (value: OptionalSpecValue): SpecValue[] => {
  if (Array.isArray(value)) return value;
  if (typeof value === "string") return Array.from(value);
  if (isMapping(value)) return keysOf(value);
  throw new NetworkBuilderError("TypeError", `'${typeName(value)}' object is not iterable`);
};

const sum = (values: Iterable<number>): number => {
  let total = 0;
  let compensation = 0;
  for (const value of values) {
    const next = total + value;
    if (Math.abs(total) >= Math.abs(value)) compensation += total - next + value;
    else compensation += value - next + total;
    total = next;
  }
  if (compensation !== 0 && Number.isFinite(compensation)) total += compensation;
  return total;
};

const repeat = <Item>(values: readonly Item[], count: number): Item[] => {
  const output: Item[] = [];
  for (let index = 0; index < count; index += 1) {
    for (const value of values) output.push(value);
  }
  return output;
};

const decodeRowIndex = (rowIndex: number, dimensions: readonly number[]): number[] => {
  const output = new Array<number>(dimensions.length).fill(0);
  let remaining = Math.trunc(rowIndex);
  for (let index = dimensions.length - 1; index >= 0; index -= 1) {
    const dimension = Math.trunc(dimensions[index]);
    output[index] = remaining % dimension;
    remaining = Math.floor(remaining / dimension);
  }
  return output;
};

const cartesianProduct = <Item>(groups: readonly (readonly Item[])[]): Item[][] => {
  let output: Item[][] = [[]];
  for (const group of groups) {
    const next: Item[][] = [];
    for (const prefix of output) {
      for (const item of group) next.push([...prefix, item]);
    }
    output = next;
  }
  return output;
};

export type { OptionalSpecValue, SpecMapping, SpecValue };
export {
  cartesianProduct,
  collapseUnderscores,
  compareText,
  decodeRowIndex,
  entriesOf,
  floatListRepr,
  floatRepr,
  formatExponent,
  formatFixed,
  formatGeneral,
  getValue,
  getValueOr,
  hasKey,
  isAsciiAlphanumeric,
  isAsciiDigit,
  isAsciiLetter,
  isIdentifier,
  isMapping,
  isSequence,
  iterValues,
  keysOf,
  numberText,
  recordKeyOrder,
  repeat,
  replaceNonAlphanumericRuns,
  replaceNonIdentifierRuns,
  repr,
  sortedText,
  startsWithIdentifierStart,
  strip,
  stripCharacters,
  sum,
  text,
  textRepr,
  titleCase,
  toFloat,
  toInteger,
  truthy,
  tupleRepr,
  typeName,
  valuesOf,
};
