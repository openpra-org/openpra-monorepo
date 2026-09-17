import { numberText, stringifyJson } from "../json";
import { applyWorkbookPatch, createWorkbookPatch } from "../workbooks/WorkbookPatch";

describe("signed-zero JSON", () => {
  it("keeps numeric zero signs without changing strings, keys or other numbers", () => {
    const value = { "0": -0, text: '0 -0 \\" 1e0\n\u0000', values: [0, -0, 0.001, -1e-7, -0, 0] };
    const text = stringifyJson(value, 2)!;
    expect(JSON.parse(text)).toEqual(value);
    expect(Object.is(JSON.parse(text)["0"], -0)).toBe(true);
    expect(text).toContain("-0.0");
    expect(JSON.parse(text).values.map((n: number) => Object.is(n, -0))).toEqual([false, true, false, false, true, false]);
  });

  it("retains standard omission, null, date and boxed-number behavior", () => {
    const value = { missing: undefined, date: new Date(0), array: [undefined, NaN, Infinity, new Number(-0), 0, -0] };
    expect(JSON.parse(stringifyJson(value)!)).toEqual({ date: "1970-01-01T00:00:00.000Z", array: [null, null, null, -0, 0, -0] });
    expect(JSON.parse(stringifyJson(value)!).array.slice(3).map((n: number) => Object.is(n, -0))).toEqual([true, false, true]);
    expect(stringifyJson(undefined)).toBeUndefined();
    expect(stringifyJson(0)).toBe("0");
    expect(stringifyJson(-0)).toBe("-0.0");
    expect(() => stringifyJson(1n)).toThrow(TypeError);
    const circular: { self?: unknown } = {}; circular.self = circular;
    expect(() => stringifyJson(circular)).toThrow(TypeError);
  });

  it("preserves finite binary64 values through JSON parsing", () => {
    const buffer = new ArrayBuffer(8), view = new DataView(buffer);
    const values = [0, -0, Number.MIN_VALUE, Number.MAX_VALUE, 0.1, 1 - Number.EPSILON];
    for (let i = 0; i < 2048; i += 1) {
      view.setUint32(0, Math.imul(i, 2654435761)); view.setUint32(4, Math.imul(i + 1, 2246822519));
      const value = view.getFloat64(0); if (Number.isFinite(value)) values.push(value);
    }
    const parsed: number[] = JSON.parse(stringifyJson(values)!);
    expect(parsed.every((value, index) => Object.is(value, values[index]))).toBe(true);
  });

  it("keeps negative zero in patch values, copied fields and applied edits", () => {
    const before = { keep: [-0, 0], changed: 0, rows: [] as { p: number }[] };
    const after = { keep: [-0, 0], changed: -0, rows: [{ p: -0 }] };
    const patch = createWorkbookPatch(before, after);
    const applied = applyWorkbookPatch(before, JSON.parse(stringifyJson(patch)!));
    expect(Object.is(applied.keep[0], -0)).toBe(true);
    expect(Object.is(applied.changed, -0)).toBe(true);
    expect(Object.is(applied.rows[0]!.p, -0)).toBe(true);
    expect(Object.is(before.changed, 0)).toBe(true);
    expect(applied.keep).not.toBe(before.keep);
  });

  it("keeps zero signs in exported numeric cells", () => {
    expect(numberText(-0)).toBe("-0");
    expect(numberText(0)).toBe("0");
    expect(numberText(1e-25)).toBe(String(1e-25));
  });
});
it("retains signed zero beside a workbook string larger than the BSON limit", () => {
  const text = "escaped \\\"0\\\" " + "x".repeat(17 * 1024 * 1024);
  const input = { text, positive: 0, negative: -0, array: [1e-20, 0, -0] };
  const output = JSON.parse(stringifyJson(input)!);
  expect(output).toEqual(input);
  expect(Object.is(output.negative, -0)).toBe(true);
  expect(Object.is(output.array[2], -0)).toBe(true);
});
