export interface FaultTreeImageArea {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface FaultTreePng {
  blob: Blob;
  width: number;
  height: number;
  dotsPerInch: number;
}

export type CanvasProbe = (width: number, height: number) => HTMLCanvasElement | null;

const CSS_PIXELS_PER_INCH = 96;
const METERS_PER_INCH = 0.0254;
const SCALE_STEP = 0.99;
const STATE_CLASSES = ["ftbox--selected", "ftbox--invalid", "ftline--selected", "ftline--invalid"];
const PHYSICAL_SIZE_TYPE = Array.from("pHYs", (letter) => letter.charCodeAt(0));
const CRC_TABLE = crcTable();
const fontDataByUrl = new Map<string, Promise<string>>();

function crcTable(): Uint32Array {
  const table = new Uint32Array(256);
  for (let index = 0; index < table.length; index += 1) {
    let value = index;
    for (let bit = 0; bit < 8; bit += 1) value = (value & 1) === 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    table[index] = value >>> 0;
  }
  return table;
}

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (let index = 0; index < bytes.length; index += 1) {
    crc = CRC_TABLE[(crc ^ bytes[index]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function physicalSizeChunk(dotsPerInch: number): Uint8Array<ArrayBuffer> {
  const pixelsPerMeter = Math.round(dotsPerInch / METERS_PER_INCH);
  const chunk = new Uint8Array(21);
  const view = new DataView(chunk.buffer);
  view.setUint32(0, 9);
  chunk.set(PHYSICAL_SIZE_TYPE, 4);
  view.setUint32(8, pixelsPerMeter);
  view.setUint32(12, pixelsPerMeter);
  chunk[16] = 1;
  view.setUint32(17, crc32(chunk.subarray(4, 17)));
  return chunk;
}

export function withPngResolution(png: Uint8Array<ArrayBuffer>, dotsPerInch: number): Uint8Array<ArrayBuffer> {
  const view = new DataView(png.buffer, png.byteOffset, png.byteLength);
  const chunks = [png.subarray(0, 8)];
  let offset = 8;
  while (offset + 12 <= png.length) {
    const end = offset + 12 + view.getUint32(offset);
    const type = String.fromCharCode(png[offset + 4], png[offset + 5], png[offset + 6], png[offset + 7]);
    if (type !== "pHYs") chunks.push(png.subarray(offset, end));
    if (type === "IHDR") chunks.push(physicalSizeChunk(dotsPerInch));
    offset = end;
  }
  const output = new Uint8Array(chunks.reduce((total, chunk) => total + chunk.length, 0));
  chunks.reduce((position, chunk) => {
    output.set(chunk, position);
    return position + chunk.length;
  }, 0);
  return output;
}

function paintsCorner(context: CanvasRenderingContext2D, width: number, height: number): boolean {
  try {
    context.fillRect(width - 1, height - 1, 1, 1);
    return context.getImageData(width - 1, height - 1, 1, 1).data[3] === 255;
  } catch {
    return false;
  }
}

function usableCanvas(width: number, height: number): HTMLCanvasElement | null {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (context !== null && paintsCorner(context, width, height)) return canvas;
  canvas.width = 0;
  canvas.height = 0;
  return null;
}

function largestSide(probe: CanvasProbe): number {
  let low = 1;
  while (probe(low * 2, 1) !== null) low *= 2;
  let high = low * 2;
  while (high - low > 1) {
    const middle = Math.floor((low + high) / 2);
    if (probe(middle, 1) !== null) low = middle;
    else high = middle;
  }
  return low;
}

export function largestCanvas(
  width: number,
  height: number,
  probe: CanvasProbe = usableCanvas,
  startScale = Number.POSITIVE_INFINITY,
): HTMLCanvasElement {
  const side = largestSide(probe);
  let scale = Math.min(startScale, side / width, side / height);
  while (Math.floor(width * scale) >= 1 && Math.floor(height * scale) >= 1) {
    const canvas = probe(Math.floor(width * scale), Math.floor(height * scale));
    if (canvas !== null) return canvas;
    scale *= SCALE_STEP;
  }
  throw new Error("This browser could not create a canvas for the image.");
}

function unquoted(value: string): string {
  const trimmed = value.trim();
  return trimmed.startsWith("\"") || trimmed.startsWith("'") ? trimmed.slice(1, -1) : trimmed;
}

function fontFamilies(value: string): string[] {
  return value.split(",").map(unquoted);
}

function sourceUrls(src: string): string[] {
  return src.split("url(").slice(1).map((part) => unquoted(part.slice(0, part.indexOf(")"))));
}

function inlineStyles(source: Element, copy: Element, families: Set<string>): void {
  const style = getComputedStyle(source);
  const declarations: string[] = [];
  for (let index = 0; index < style.length; index += 1) {
    const name = style.item(index);
    if (!name.startsWith("--") && name !== "vector-effect") declarations.push(`${name}:${style.getPropertyValue(name)}`);
  }
  copy.setAttribute("style", declarations.join(";"));
  fontFamilies(style.fontFamily).forEach((family) => families.add(family));
  Array.from(source.children).forEach((child, index) => {
    const copied = copy.children.item(index);
    if (copied !== null) inlineStyles(child, copied, families);
  });
}

function styledCopy(tree: HTMLElement, families: Set<string>): HTMLElement {
  const marked = Array.from(tree.querySelectorAll(STATE_CLASSES.map((name) => `.${name}`).join(","))).map((element) => ({
    element,
    className: element.getAttribute("class") ?? "",
  }));
  marked.forEach(({ element }) => element.classList.remove(...STATE_CLASSES));
  try {
    const copy = tree.cloneNode(true) as HTMLElement;
    inlineStyles(tree, copy, families);
    return copy;
  } finally {
    marked.forEach(({ element, className }) => element.setAttribute("class", className));
  }
}

function contentArea(tree: HTMLElement, margin: number): FaultTreeImageArea {
  const boxes = Array.from(tree.children).flatMap((child) => child instanceof HTMLElement
    ? [{ left: child.offsetLeft, top: child.offsetTop, right: child.offsetLeft + child.offsetWidth, bottom: child.offsetTop + child.offsetHeight }]
    : []);
  const drawings = Array.from(tree.children).flatMap((child) => {
    if (!(child instanceof SVGGraphicsElement)) return [];
    const box = child.getBBox();
    return box.width === 0 && box.height === 0 ? [] : [{ left: box.x, top: box.y, right: box.x + box.width, bottom: box.y + box.height }];
  });
  const parts = [...boxes, ...drawings];
  const left = Math.min(...parts.map((part) => part.left)) - margin;
  const top = Math.min(...parts.map((part) => part.top)) - margin;
  const right = Math.max(...parts.map((part) => part.right)) + margin;
  const bottom = Math.max(...parts.map((part) => part.bottom)) + margin;
  return { x: left, y: top, width: Math.ceil(right - left), height: Math.ceil(bottom - top) };
}

function fontFaceRules(sheet: CSSStyleSheet): CSSFontFaceRule[] {
  try {
    return Array.from(sheet.cssRules).filter((rule): rule is CSSFontFaceRule => rule instanceof CSSFontFaceRule);
  } catch {
    return [];
  }
}

function dataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("The browser could not read a font for the image."));
    reader.readAsDataURL(blob);
  });
}

function fontData(url: string): Promise<string> {
  const cached = fontDataByUrl.get(url);
  if (cached !== undefined) return cached;
  const loading = fetch(url)
    .then((response) => {
      if (!response.ok) throw new Error(`The font ${url} could not be loaded for the image.`);
      return response.blob();
    })
    .then(dataUrl);
  fontDataByUrl.set(url, loading);
  loading.catch(() => fontDataByUrl.delete(url));
  return loading;
}

async function embeddedFontFaces(families: ReadonlySet<string>): Promise<string> {
  const faces = Array.from(document.styleSheets).flatMap((sheet) => fontFaceRules(sheet)
    .filter((rule) => fontFamilies(rule.style.getPropertyValue("font-family")).some((family) => families.has(family)))
    .map((rule) => ({ rule, base: sheet.href ?? document.baseURI })));
  const css = await Promise.all(faces.map(async ({ rule, base }) => {
    const sources = sourceUrls(rule.style.getPropertyValue("src")).filter((source) => !source.startsWith("data:"));
    const inlined = await Promise.all(sources.map(async (source) => ({ source, data: await fontData(new URL(source, base).href) })));
    return inlined.reduce((text, { source, data }) => text.split(source).join(data), rule.cssText);
  }));
  return Array.from(new Set(css)).join("");
}

function treeMarkup(copy: HTMLElement, area: FaultTreeImageArea, width: number, height: number, fonts: string): string {
  const frame = document.createElement("div");
  const shift = document.createElement("div");
  frame.setAttribute("style", `position:relative;width:${area.width}px;height:${area.height}px;overflow:hidden`);
  shift.setAttribute("style", `position:absolute;left:${-area.x}px;top:${-area.y}px`);
  shift.append(copy);
  frame.append(shift);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${area.width} ${area.height}"><style>${fonts}</style><foreignObject x="0" y="0" width="${area.width}" height="${area.height}">${new XMLSerializer().serializeToString(frame)}</foreignObject></svg>`;
}

function loadedImage(markup: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("The browser could not draw the fault tree."));
    image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(markup)}`;
  });
}

function encodedPng(canvas: HTMLCanvasElement): Promise<Blob | null> {
  return new Promise((resolve, reject) => {
    try {
      canvas.toBlob(resolve, "image/png");
    } catch {
      reject(new Error("This browser does not allow saving the drawn tree as an image."));
    }
  });
}

async function largestPng(
  copy: HTMLElement,
  area: FaultTreeImageArea,
  fonts: string,
  background: string,
  startScale: number,
): Promise<FaultTreePng> {
  const canvas = largestCanvas(area.width, area.height, usableCanvas, startScale);
  const scale = canvas.width / area.width;
  const image = await loadedImage(treeMarkup(copy, area, canvas.width, canvas.height, fonts));
  const context = canvas.getContext("2d");
  if (context === null) throw new Error("This browser could not create a canvas for the image.");
  context.fillStyle = background;
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  const blob = await encodedPng(canvas);
  const width = canvas.width;
  const height = canvas.height;
  canvas.width = 0;
  canvas.height = 0;
  if (blob === null) return largestPng(copy, area, fonts, background, scale / Math.SQRT2);
  const dotsPerInch = CSS_PIXELS_PER_INCH * scale;
  const png = withPngResolution(new Uint8Array(await blob.arrayBuffer()), dotsPerInch);
  return { blob: new Blob([png], { type: "image/png" }), width, height, dotsPerInch };
}

export async function renderFaultTreePng(tree: HTMLElement, margin: number): Promise<FaultTreePng> {
  const families = new Set<string>();
  const area = contentArea(tree, margin);
  const copy = styledCopy(tree, families);
  const background = getComputedStyle(tree).getPropertyValue("--color-surface").trim();
  const fonts = await embeddedFontFaces(families);
  return largestPng(copy, area, fonts, background === "" ? "#ffffff" : background, Number.POSITIVE_INFINITY);
}
