import { isAlias, isMap, isScalar, isSeq, parseAllDocuments } from "yaml";
import type { Document } from "yaml";
import { domainSpecError } from "./errors";
import { floatRepr, isAsciiDigit, numberText, recordKeyOrder } from "./spec-values";
import type { SpecMapping, SpecValue } from "./spec-values";

type SpecTextFormat = "JSON" | "YAML";

type YamlInput = Parameters<typeof isScalar>[0];

type KeyValue = [string, SpecValue];

const BOOLEAN_TRUE = ["yes", "Yes", "YES", "true", "True", "TRUE", "on", "On", "ON"];
const BOOLEAN_FALSE = ["no", "No", "NO", "false", "False", "FALSE", "off", "Off", "OFF"];
const NULL_TEXT = ["~", "null", "Null", "NULL", ""];
const TAG_PREFIX = "tag:yaml.org,2002:";

const everyCharacter = (source: string, accept: (character: string) => boolean): boolean =>
  Array.from(source).every(accept);

const isDigitOrUnderscore = (character: string): boolean => isAsciiDigit(character) || character === "_";

const isHexCharacter = (character: string): boolean =>
  isAsciiDigit(character) ||
  (character >= "a" && character <= "f") ||
  (character >= "A" && character <= "F") ||
  character === "_";

const withoutSign = (source: string): string => (source[0] === "+" || source[0] === "-" ? source.slice(1) : source);

const isSexagesimalTail = (parts: readonly string[]): boolean =>
  parts.length > 0 &&
  parts.every(
    (part) =>
      (part.length === 1 && isAsciiDigit(part)) ||
      (part.length === 2 && part[0] >= "0" && part[0] <= "5" && isAsciiDigit(part[1])),
  );

const isDecimalHead = (source: string): boolean =>
  source.length > 0 && source[0] >= "1" && source[0] <= "9" && everyCharacter(source.slice(1), isDigitOrUnderscore);

const isIntegerText = (source: string): boolean => {
  const body = withoutSign(source);
  if (body.length === 0) return false;
  if (body.startsWith("0b")) {
    return body.length > 2 && everyCharacter(body.slice(2), (c) => c === "0" || c === "1" || c === "_");
  }
  if (body.startsWith("0x")) return body.length > 2 && everyCharacter(body.slice(2), isHexCharacter);
  if (body === "0") return true;
  if (body[0] === "0") return everyCharacter(body.slice(1), (c) => (c >= "0" && c <= "7") || c === "_");
  if (isDecimalHead(body)) return true;
  const parts = body.split(":");
  return parts.length > 1 && isDecimalHead(parts[0]) && isSexagesimalTail(parts.slice(1));
};

const isSignedExponent = (source: string): boolean =>
  source.length === 0 ||
  ((source[0] === "e" || source[0] === "E") &&
    (source[1] === "+" || source[1] === "-") &&
    source.length > 2 &&
    everyCharacter(source.slice(2), isAsciiDigit));

const splitExponent = (source: string): [string, string] => {
  for (let index = 0; index < source.length; index += 1) {
    if (source[index] === "e" || source[index] === "E") return [source.slice(0, index), source.slice(index)];
  }
  return [source, ""];
};

const isFloatText = (source: string): boolean => {
  if (source === ".nan" || source === ".NaN" || source === ".NAN") return true;
  const body = withoutSign(source);
  if (body === ".inf" || body === ".Inf" || body === ".INF") return true;
  if (source[0] === ".") {
    const [mantissa, exponent] = splitExponent(source.slice(1));
    return (
      mantissa.length > 0 &&
      isAsciiDigit(mantissa[0]) &&
      everyCharacter(mantissa.slice(1), isDigitOrUnderscore) &&
      isSignedExponent(exponent)
    );
  }
  const point = body.indexOf(".");
  if (point <= 0) return false;
  const head = body.slice(0, point);
  const tail = body.slice(point + 1);
  if (head.includes(":")) {
    const parts = head.split(":");
    return (
      isAsciiDigit(parts[0][0] ?? "") &&
      everyCharacter(parts[0].slice(1), isDigitOrUnderscore) &&
      isSexagesimalTail(parts.slice(1)) &&
      everyCharacter(tail, isDigitOrUnderscore)
    );
  }
  if (!isAsciiDigit(head[0]) || !everyCharacter(head.slice(1), isDigitOrUnderscore)) return false;
  const [fraction, exponent] = splitExponent(tail);
  return everyCharacter(fraction, isDigitOrUnderscore) && isSignedExponent(exponent);
};

const isDateText = (source: string): boolean =>
  source.length === 10 &&
  source[4] === "-" &&
  source[7] === "-" &&
  everyCharacter(source.slice(0, 4) + source.slice(5, 7) + source.slice(8), isAsciiDigit);

const sexagesimal = (parts: readonly string[]): number => {
  let total = 0;
  let base = 1;
  for (let index = parts.length - 1; index >= 0; index -= 1) {
    total += Number(parts[index]) * base;
    base *= 60;
  }
  return total;
};

const constructInteger = (source: string): number => {
  let value = source.split("_").join("");
  let sign = 1;
  if (value[0] === "-") sign = -1;
  if (value[0] === "+" || value[0] === "-") value = value.slice(1);
  if (value === "0") return 0;
  if (value.startsWith("0b")) return sign * parseInt(value.slice(2), 2);
  if (value.startsWith("0x")) return sign * parseInt(value.slice(2), 16);
  if (value[0] === "0") return sign * parseInt(value, 8);
  if (value.includes(":")) return sign * sexagesimal(value.split(":"));
  return sign * Number(value);
};

const constructFloat = (source: string): number => {
  let value = source.split("_").join("").toLowerCase();
  let sign = 1;
  if (value[0] === "-") sign = -1;
  if (value[0] === "+" || value[0] === "-") value = value.slice(1);
  if (value === ".inf") return sign * Infinity;
  if (value === ".nan") return NaN;
  if (value.includes(":")) return sign * sexagesimal(value.split(":"));
  return sign * Number(value);
};

const resolvePlainScalar = (source: string): SpecValue => {
  if (source === "=") throw domainSpecError("The specification uses the unsupported YAML value '='.");
  if (BOOLEAN_TRUE.includes(source)) return true;
  if (BOOLEAN_FALSE.includes(source)) return false;
  if (NULL_TEXT.includes(source)) return null;
  if (isIntegerText(source)) return constructInteger(source);
  if (isFloatText(source)) return constructFloat(source);
  return source;
};

const resolveTaggedScalar = (tag: string, source: string): SpecValue => {
  const name = tag.slice(TAG_PREFIX.length);
  if (name === "str") return source;
  if (name === "int" && isIntegerText(source)) return constructInteger(source);
  if (name === "float" && (isFloatText(source) || isIntegerText(source))) {
    return isFloatText(source) ? constructFloat(source) : constructInteger(source);
  }
  if (name === "bool" && (BOOLEAN_TRUE.includes(source) || BOOLEAN_FALSE.includes(source))) {
    return BOOLEAN_TRUE.includes(source);
  }
  if (name === "null") return null;
  throw domainSpecError(`The specification uses the unsupported YAML tag '${tag}'.`);
};

const keyText = (value: SpecValue): string => {
  if (typeof value === "string") return value;
  if (value === null) return "None";
  if (typeof value === "boolean") return value ? "True" : "False";
  if (typeof value === "number") return Number.isInteger(value) ? numberText(value) : floatRepr(value);
  throw domainSpecError("The specification uses a list or a mapping as a mapping key.");
};

const isPlainFloat = (node: YamlInput): boolean =>
  isScalar(node) &&
  node.type === "PLAIN" &&
  typeof node.tag !== "string" &&
  typeof node.value === "string" &&
  !isIntegerText(node.value) &&
  isFloatText(node.value);

const constructNode = (node: YamlInput, document: Document.Parsed, depth: number): SpecValue => {
  if (depth > 200) throw domainSpecError("The specification nests more than 200 levels deep.");
  if (node === null || node === undefined) return null;
  if (isAlias(node)) return constructNode(node.resolve(document), document, depth + 1);
  if (isScalar(node)) {
    const source = typeof node.value === "string" ? node.value : "";
    if (typeof node.tag === "string" && node.tag.startsWith(TAG_PREFIX)) return resolveTaggedScalar(node.tag, source);
    if (typeof node.tag === "string" && node.tag !== "!" && node.tag.length > 0) {
      throw domainSpecError(`The specification uses the unsupported YAML tag '${node.tag}'.`);
    }
    if (node.type === "PLAIN" && node.tag !== "!") {
      if (isDateText(source)) return source;
      return resolvePlainScalar(source);
    }
    return source;
  }
  if (isSeq(node)) return node.items.map((item) => constructNode(item, document, depth + 1));
  if (isMap(node)) {
    const output: SpecMapping = {};
    const order: string[] = [];
    for (const [key, value] of flattenMapping(node, document, depth)) {
      if (!Object.prototype.hasOwnProperty.call(output, key)) order.push(key);
      Object.defineProperty(output, key, { value, enumerable: true, writable: true, configurable: true });
    }
    return recordKeyOrder(output, order);
  }
  throw domainSpecError("The specification holds a YAML node that is not a scalar, a list or a mapping.");
};

const mergeSource = (node: YamlInput, document: Document.Parsed, depth: number): KeyValue[] => {
  const target = isAlias(node) ? node.resolve(document) : node;
  if (isMap(target)) return flattenMapping(target, document, depth + 1);
  throw domainSpecError("A YAML merge key must refer to a mapping or a list of mappings.");
};

function flattenMapping(node: YamlInput, document: Document.Parsed, depth: number): KeyValue[] {
  if (!isMap(node)) return [];
  const merged: KeyValue[] = [];
  const own: KeyValue[] = [];
  for (const pair of node.items) {
    const key = pair.key;
    const isMergeKey = isScalar(key) && key.type === "PLAIN" && key.value === "<<" && typeof key.tag !== "string";
    if (isMergeKey) {
      const target = isAlias(pair.value) ? pair.value.resolve(document) : pair.value;
      if (isSeq(target)) {
        const groups = target.items.map((item) => mergeSource(item, document, depth));
        for (let index = groups.length - 1; index >= 0; index -= 1) merged.push(...groups[index]);
      } else {
        merged.push(...mergeSource(target, document, depth));
      }
      continue;
    }
    const isValueKey = isScalar(key) && key.type === "PLAIN" && key.value === "=" && typeof key.tag !== "string";
    const keyValue = isValueKey ? "=" : constructNode(key, document, depth + 1);
    const name = isPlainFloat(key) && typeof keyValue === "number" ? floatRepr(keyValue) : keyText(keyValue);
    own.push([name, constructNode(pair.value, document, depth + 1)]);
  }
  return [...merged, ...own];
}

const parseYamlText = (source: string): SpecValue => {
  const documents = parseAllDocuments(source, {
    schema: "failsafe",
    uniqueKeys: false,
    merge: false,
    logLevel: "silent",
  });
  if (!Array.isArray(documents) || documents.length === 0) return {};
  if (documents.length > 1) throw domainSpecError("The specification holds more than one YAML document.");
  const document = documents[0];
  if (document.errors.length > 0) {
    throw domainSpecError(`The specification is not valid YAML: ${document.errors[0].message}`);
  }
  const value = constructNode(document.contents, document, 0);
  return value === null ? {} : value;
};

interface JsonCursor {
  source: string;
  position: number;
}

const jsonError = (cursor: JsonCursor, detail: string): Error =>
  domainSpecError(`The specification is not valid JSON: ${detail} at position ${cursor.position}`);

const skipJsonWhitespace = (cursor: JsonCursor): void => {
  while (cursor.position < cursor.source.length) {
    const character = cursor.source[cursor.position];
    if (character !== " " && character !== "\t" && character !== "\n" && character !== "\r") return;
    cursor.position += 1;
  }
};

const JSON_ESCAPES: [string, string][] = [
  ['"', '"'],
  ["\\", "\\"],
  ["/", "/"],
  ["b", "\b"],
  ["f", "\f"],
  ["n", "\n"],
  ["r", "\r"],
  ["t", "\t"],
];

const isHexDigit = (character: string): boolean =>
  isAsciiDigit(character) || (character >= "a" && character <= "f") || (character >= "A" && character <= "F");

const parseJsonString = (cursor: JsonCursor): string => {
  cursor.position += 1;
  let output = "";
  let start = cursor.position;
  for (;;) {
    if (cursor.position >= cursor.source.length) throw jsonError(cursor, "a string is not closed");
    const character = cursor.source[cursor.position];
    if (character === '"') {
      output += cursor.source.slice(start, cursor.position);
      cursor.position += 1;
      return output;
    }
    if (character === "\\") {
      output += cursor.source.slice(start, cursor.position);
      const escape = cursor.source[cursor.position + 1] ?? "";
      const simple = JSON_ESCAPES.find(([name]) => name === escape);
      if (escape === "u") {
        const digits = cursor.source.slice(cursor.position + 2, cursor.position + 6);
        if (digits.length !== 4 || !Array.from(digits).every(isHexDigit)) {
          throw jsonError(cursor, "a unicode escape is not valid");
        }
        output += String.fromCharCode(parseInt(digits, 16));
        cursor.position += 6;
      } else if (simple !== undefined) {
        output += simple[1];
        cursor.position += 2;
      } else {
        throw jsonError(cursor, "an escape sequence is not valid");
      }
      start = cursor.position;
      continue;
    }
    if (character < " ") throw jsonError(cursor, "a string holds a control character");
    cursor.position += 1;
  }
};

const parseJsonNumber = (cursor: JsonCursor): number => {
  const start = cursor.position;
  const peek = (): string => cursor.source[cursor.position] ?? "";
  if (peek() === "-") cursor.position += 1;
  if (peek() === "0") cursor.position += 1;
  else if (peek() >= "1" && peek() <= "9") {
    while (isAsciiDigit(peek())) cursor.position += 1;
  } else throw jsonError(cursor, "a number is not valid");
  if (peek() === ".") {
    cursor.position += 1;
    if (!isAsciiDigit(peek())) throw jsonError(cursor, "a number is not valid");
    while (isAsciiDigit(peek())) cursor.position += 1;
  }
  if (peek() === "e" || peek() === "E") {
    cursor.position += 1;
    if (peek() === "+" || peek() === "-") cursor.position += 1;
    if (!isAsciiDigit(peek())) throw jsonError(cursor, "a number is not valid");
    while (isAsciiDigit(peek())) cursor.position += 1;
  }
  return Number(cursor.source.slice(start, cursor.position));
};

const JSON_LITERALS: [string, SpecValue][] = [
  ["true", true],
  ["false", false],
  ["null", null],
  ["NaN", NaN],
  ["Infinity", Infinity],
  ["-Infinity", -Infinity],
];

const parseJsonValue = (cursor: JsonCursor, depth: number): SpecValue => {
  if (depth > 500) throw jsonError(cursor, "the nesting is too deep");
  skipJsonWhitespace(cursor);
  const character = cursor.source[cursor.position] ?? "";
  if (character === "{") {
    cursor.position += 1;
    const output: SpecMapping = {};
    const order: string[] = [];
    skipJsonWhitespace(cursor);
    if (cursor.source[cursor.position] === "}") {
      cursor.position += 1;
      return output;
    }
    for (;;) {
      skipJsonWhitespace(cursor);
      if (cursor.source[cursor.position] !== '"') throw jsonError(cursor, "a key must be a string");
      const key = parseJsonString(cursor);
      skipJsonWhitespace(cursor);
      if (cursor.source[cursor.position] !== ":") throw jsonError(cursor, "a colon is missing");
      cursor.position += 1;
      const value = parseJsonValue(cursor, depth + 1);
      if (!Object.prototype.hasOwnProperty.call(output, key)) order.push(key);
      Object.defineProperty(output, key, { value, enumerable: true, writable: true, configurable: true });
      skipJsonWhitespace(cursor);
      const next = cursor.source[cursor.position] ?? "";
      cursor.position += 1;
      if (next === "}") return recordKeyOrder(output, order);
      if (next !== ",") throw jsonError(cursor, "a comma or a closing brace is missing");
    }
  }
  if (character === "[") {
    cursor.position += 1;
    const output: SpecValue[] = [];
    skipJsonWhitespace(cursor);
    if (cursor.source[cursor.position] === "]") {
      cursor.position += 1;
      return output;
    }
    for (;;) {
      output.push(parseJsonValue(cursor, depth + 1));
      skipJsonWhitespace(cursor);
      const next = cursor.source[cursor.position] ?? "";
      cursor.position += 1;
      if (next === "]") return output;
      if (next !== ",") throw jsonError(cursor, "a comma or a closing bracket is missing");
    }
  }
  if (character === '"') return parseJsonString(cursor);
  for (const [literal, value] of JSON_LITERALS) {
    if (cursor.source.startsWith(literal, cursor.position)) {
      cursor.position += literal.length;
      return value;
    }
  }
  if (character === "-" || isAsciiDigit(character)) return parseJsonNumber(cursor);
  throw jsonError(cursor, cursor.position >= cursor.source.length ? "the text ends early" : "a value is not valid");
};

const parseJsonText = (source: string): SpecValue => {
  const cursor: JsonCursor = { source: source.charCodeAt(0) === 0xfeff ? source.slice(1) : source, position: 0 };
  const value = parseJsonValue(cursor, 0);
  skipJsonWhitespace(cursor);
  if (cursor.position < cursor.source.length) throw jsonError(cursor, "extra text follows the value");
  return value;
};

const parseSpecText = (format: SpecTextFormat, source: string): SpecValue => {
  const value = format === "JSON" ? parseJsonText(source) : parseYamlText(source);
  return value === null ? {} : value;
};

export type { SpecTextFormat };
export { parseJsonText, parseSpecText };
