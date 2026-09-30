import { largestCanvas, withPngResolution, type CanvasProbe } from "../faultTreeImage";

const SIGNATURE = [137, 80, 78, 71, 13, 10, 26, 10];
const DENSITY_AT_2540_DPI = [0, 0, 0, 9, 112, 72, 89, 115, 0, 1, 134, 160, 0, 1, 134, 160, 1, 39, 22, 100, 162];
const CHROME_SIDE = 65535;
const CHROME_AREA = 268435456;

function chunk(type: string, data: number[]): number[] {
  return [0, 0, 0, data.length, ...Array.from(type, (letter) => letter.charCodeAt(0)), ...data, 0, 0, 0, 0];
}

const HEADER = chunk("IHDR", [0, 0, 0, 2, 0, 0, 0, 1, 8, 6, 0, 0, 0]);
const END = chunk("IEND", []);

function png(...chunks: number[][]): Uint8Array<ArrayBuffer> {
  return new Uint8Array([...SIGNATURE, ...chunks.flat()]);
}

function chunkTypes(bytes: Uint8Array): string[] {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const types: string[] = [];
  for (let offset = 8; offset + 12 <= bytes.length; offset += 12 + view.getUint32(offset)) {
    types.push(String.fromCharCode(...Array.from(bytes.subarray(offset + 4, offset + 8))));
  }
  return types;
}

function limitedProbe(maxSide: number, maxArea: number): CanvasProbe {
  return (width, height) => {
    if (width > maxSide || height > maxSide || width * height > maxArea) return null;
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    return canvas;
  };
}

describe("fault tree PNG export", () => {
  it("records the pixel density right after the image header", () => {
    const output = withPngResolution(png(HEADER, END), 2540);

    expect(Array.from(output.subarray(0, 8 + HEADER.length))).toEqual([...SIGNATURE, ...HEADER]);
    expect(Array.from(output.subarray(8 + HEADER.length, 8 + HEADER.length + 21))).toEqual(DENSITY_AT_2540_DPI);
    expect(chunkTypes(output)).toEqual(["IHDR", "pHYs", "IEND"]);
  });

  it("replaces a density the encoder already wrote", () => {
    const output = withPngResolution(png(HEADER, chunk("pHYs", [0, 0, 11, 196, 0, 0, 11, 196, 1]), END), 2540);

    expect(chunkTypes(output)).toEqual(["IHDR", "pHYs", "IEND"]);
    expect(Array.from(output.subarray(8 + HEADER.length, 8 + HEADER.length + 21))).toEqual(DENSITY_AT_2540_DPI);
  });

  it("grows the canvas to the browser's pixel limit", () => {
    const canvas = largestCanvas(1000, 658, limitedProbe(CHROME_SIDE, CHROME_AREA));

    expect(canvas.width * canvas.height).toBeLessThanOrEqual(CHROME_AREA);
    expect(canvas.width * canvas.height).toBeGreaterThan(0.97 * CHROME_AREA);
    expect(canvas.width / canvas.height).toBeCloseTo(1000 / 658, 2);
  });

  it("keeps a wide tree inside the browser's side limit", () => {
    const canvas = largestCanvas(8424, 868, limitedProbe(CHROME_SIDE, CHROME_AREA));

    expect(canvas.width).toBeLessThanOrEqual(CHROME_SIDE);
    expect(canvas.width * canvas.height).toBeGreaterThan(0.97 * CHROME_AREA);
  });

  it("goes below natural size when the tree is wider than the browser allows", () => {
    const canvas = largestCanvas(70000, 100, limitedProbe(32767, CHROME_AREA));

    expect(canvas.width).toBeLessThanOrEqual(32767);
    expect(canvas.width).toBeGreaterThan(0.99 * 32767);
  });

  it("starts from a smaller scale after an encoding failure", () => {
    const canvas = largestCanvas(1000, 658, limitedProbe(CHROME_SIDE, CHROME_AREA), 4);

    expect(canvas.width).toBeLessThanOrEqual(4000);
    expect(canvas.width).toBeGreaterThan(3960);
  });

  it("explains when the browser cannot make any canvas", () => {
    expect(() => largestCanvas(1000, 658, () => null)).toThrow("This browser could not create a canvas for the image.");
  });
});
