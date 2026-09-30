import type { PDFDocumentProxy, RenderTask } from "pdfjs-dist";
import type { SystemDiagram, SystemDiagramRegion, SystemDiagramRotation, SystemsAnalysis } from "interfaces-mef-types/sy/systems-analysis";
import { fetchBytes } from "../api/client";
import { getToken } from "../auth/authStorage";
import { syDocumentContentPath, type SyDocumentEntry } from "./syWorkbookApi";

type SyDiagramSourceKind = "pdf" | "image";

interface SyDiagramDocument {
  documentId: string;
  filename: string;
  kind: SyDiagramSourceKind;
  url: string;
  example: boolean;
}

type SyDiagramSource =
  | { kind: "pdf"; pdf: PDFDocumentProxy; pageCount: number }
  | { kind: "image"; image: ImageBitmap; pageCount: number };

interface SyDiagramRender {
  done: Promise<HTMLCanvasElement>;
  cancel: () => void;
}

interface SyPdfSearchHit {
  page: number;
  lines: string[];
  caption: string | null;
}

interface SyPdfSearchResult {
  hits: SyPdfSearchHit[];
  pagesWithText: number;
}

const FULL_PAGE: SystemDiagramRegion = { x: 0, y: 0, width: 1, height: 1 };
const MAX_CANVAS_SIDE = 8192;
const MAX_CANVAS_AREA = 40_000_000;

const sources = new Map<string, Promise<SyDiagramSource>>();
const pageText = new WeakMap<PDFDocumentProxy, Map<number, string[]>>();

function sourceKind(filename: string, mimeType?: string): SyDiagramSourceKind | null {
  const name = filename.toLowerCase();
  if (mimeType === "application/pdf" || name.endsWith(".pdf")) return "pdf";
  if (mimeType === "image/png" || mimeType === "image/jpeg" || name.endsWith(".png") || name.endsWith(".jpg") || name.endsWith(".jpeg")) return "image";
  return null;
}

type SyExampleDocuments = Pick<SystemsAnalysis, "exampleDocuments">;

function exampleDiagramDocuments(sy: SyExampleDocuments): SyDiagramDocument[] {
  return (sy.exampleDocuments ?? []).flatMap((doc): SyDiagramDocument[] => {
    if (doc.url === undefined) return [];
    if (doc.kind === "doc") return [{ documentId: doc.id, filename: doc.name, kind: "pdf", url: doc.url, example: true }];
    if (doc.kind === "image") return [{ documentId: doc.id, filename: doc.name, kind: "image", url: doc.url, example: true }];
    return [];
  });
}

function diagramDocuments(sy: SyExampleDocuments, workbookId: string | null, uploaded: readonly SyDocumentEntry[]): SyDiagramDocument[] {
  const stored = workbookId === null ? [] : uploaded.flatMap((doc): SyDiagramDocument[] => {
    const kind = sourceKind(doc.filename, doc.mimeType);
    return kind === null ? [] : [{ documentId: doc.documentId, filename: doc.filename, kind, url: syDocumentContentPath(workbookId, doc.documentId), example: false }];
  });
  return [...stored, ...exampleDiagramDocuments(sy)];
}

function resolveDiagramDocument(sy: SyExampleDocuments, workbookId: string | null, diagram: Pick<SystemDiagram, "documentId" | "filename">): SyDiagramDocument | null {
  const example = exampleDiagramDocuments(sy).find((doc) => doc.documentId === diagram.documentId);
  if (example !== undefined) return example;
  const kind = sourceKind(diagram.filename);
  if (workbookId === null || kind === null) return null;
  return { documentId: diagram.documentId, filename: diagram.filename, kind, url: syDocumentContentPath(workbookId, diagram.documentId), example: false };
}

async function openSource(document: Pick<SyDiagramDocument, "url" | "kind">): Promise<SyDiagramSource> {
  if (document.kind === "image") return { kind: "image", image: await createImageBitmap(new Blob([await fetchBytes(document.url)])), pageCount: 1 };
  const [pdfjs, assets] = await Promise.all([import("pdfjs-dist"), import("./syPdfAssets.mjs")]);
  pdfjs.GlobalWorkerOptions.workerSrc = assets.pdfWorkerUrl;
  class BundledBinaryData {
    async fetch({ filename }: { filename: string }): Promise<Uint8Array> {
      const url = assets.pdfWasmUrls[filename];
      if (url === undefined) throw new Error(`${filename} is not bundled with the app.`);
      const response = await fetch(url);
      if (!response.ok) throw new Error(`${filename} could not be loaded.`);
      return new Uint8Array(await response.arrayBuffer());
    }
  }
  const token = getToken();
  const pdf = await pdfjs.getDocument({
    url: new URL(document.url, window.location.href).toString(),
    httpHeaders: token === null ? {} : { Authorization: `Bearer ${token}` },
    disableAutoFetch: true,
    disableStream: true,
    rangeChunkSize: 262144,
    useWorkerFetch: false,
    BinaryDataFactory: BundledBinaryData,
  }).promise;
  return { kind: "pdf", pdf, pageCount: pdf.numPages };
}

function loadDiagramSource(document: Pick<SyDiagramDocument, "url" | "kind">): Promise<SyDiagramSource> {
  const cached = sources.get(document.url);
  if (cached !== undefined) return cached;
  const loading = openSource(document);
  sources.set(document.url, loading);
  loading.catch(() => sources.delete(document.url));
  return loading;
}

function renderScale(regionWidth: number, regionHeight: number, cssWidth: number): number {
  const ratio = window.devicePixelRatio > 0 ? window.devicePixelRatio : 1;
  return Math.min(
    (cssWidth / regionWidth) * ratio,
    MAX_CANVAS_SIDE / regionWidth,
    MAX_CANVAS_SIDE / regionHeight,
    Math.sqrt(MAX_CANVAS_AREA / (regionWidth * regionHeight)),
  );
}

function renderDiagram(source: SyDiagramSource, pageNumber: number, region: SystemDiagramRegion, cssWidth: number): SyDiagramRender {
  let task: RenderTask | null = null;
  let cancelled = false;
  const canvas = document.createElement("canvas");
  async function draw(): Promise<HTMLCanvasElement> {
    if (source.kind === "image") {
      const width = region.width * source.image.width;
      const height = region.height * source.image.height;
      const scale = renderScale(width, height, cssWidth);
      canvas.width = Math.max(1, Math.round(width * scale));
      canvas.height = Math.max(1, Math.round(height * scale));
      canvas.getContext("2d")?.drawImage(source.image, region.x * source.image.width, region.y * source.image.height, width, height, 0, 0, canvas.width, canvas.height);
      return canvas;
    }
    const page = await source.pdf.getPage(pageNumber);
    if (cancelled) throw new Error("Rendering cancelled");
    const base = page.getViewport({ scale: 1 });
    const width = region.width * base.width;
    const height = region.height * base.height;
    const scale = renderScale(width, height, cssWidth);
    const viewport = page.getViewport({ scale, offsetX: -region.x * base.width * scale, offsetY: -region.y * base.height * scale });
    canvas.width = Math.max(1, Math.round(width * scale));
    canvas.height = Math.max(1, Math.round(height * scale));
    task = page.render({ canvas, viewport, background: "#ffffff", intent: "print" });
    await task.promise;
    return canvas;
  }
  return {
    done: draw(),
    cancel: () => {
      cancelled = true;
      task?.cancel();
    },
  };
}

async function pageAspect(source: SyDiagramSource, pageNumber: number): Promise<number> {
  if (source.kind === "image") return source.image.height / source.image.width;
  const viewport = (await source.pdf.getPage(pageNumber)).getViewport({ scale: 1 });
  return viewport.height / viewport.width;
}

function displayAspect(pageShape: number, region: SystemDiagramRegion, rotation: SystemDiagramRotation): number {
  const shape = (pageShape * region.height) / region.width;
  return rotation === 90 || rotation === 270 ? 1 / shape : shape;
}

function normalizeText(text: string): string {
  let spaced = "";
  for (const character of text) spaced += character === "\t" || character === "\n" || character === "\r" ? " " : character;
  return spaced.toLowerCase().split(" ").filter((part) => part.length > 0).join(" ");
}

function isCaption(line: string): boolean {
  const text = normalizeText(line);
  return text.startsWith("figure") || text.startsWith("fig.") || text.startsWith("fig ");
}

async function pageLines(pdf: PDFDocumentProxy, pageNumber: number): Promise<string[]> {
  let pages = pageText.get(pdf);
  if (pages === undefined) {
    pages = new Map();
    pageText.set(pdf, pages);
  }
  const cached = pages.get(pageNumber);
  if (cached !== undefined) return cached;
  const page = await pdf.getPage(pageNumber);
  const content = await page.getTextContent();
  const lines: string[] = [];
  let line = "";
  let lineEnd: number | null = null;
  for (const item of content.items) {
    if (!("str" in item)) continue;
    const x = Number(item.transform[4]);
    if (lineEnd !== null && item.str.length > 0 && x - lineEnd > Math.max(1, item.height * 0.2) && !line.endsWith(" ")) line += " ";
    line += item.str;
    lineEnd = x + item.width;
    if (item.hasEOL) {
      if (line.trim().length > 0) lines.push(line.trim());
      line = "";
      lineEnd = null;
    }
  }
  if (line.trim().length > 0) lines.push(line.trim());
  pages.set(pageNumber, lines);
  return lines;
}

function queryWords(query: string): string[] {
  return normalizeText(query).split(" ").filter((word) => word.length > 0);
}

function matchPage(page: number, lines: readonly string[], query: string): SyPdfSearchHit | null {
  const words = queryWords(query);
  const text = normalizeText(lines.join(" "));
  if (words.length === 0 || !words.every((word) => text.includes(word))) return null;
  const scored = lines
    .map((line) => ({ line, score: words.filter((word) => normalizeText(line).includes(word)).length, caption: isCaption(line) }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => Number(b.caption) - Number(a.caption) || b.score - a.score);
  const caption = scored.find((entry) => entry.caption)?.line ?? null;
  return { page, lines: scored.slice(0, 2).map((entry) => entry.line), caption };
}

function rankHits(hits: readonly SyPdfSearchHit[]): SyPdfSearchHit[] {
  return [...hits].sort((a, b) => Number(b.caption !== null) - Number(a.caption !== null) || a.page - b.page);
}

async function searchPdf(source: SyDiagramSource, query: string, onProgress: (page: number, total: number) => void, isCancelled: () => boolean): Promise<SyPdfSearchResult> {
  if (source.kind !== "pdf" || queryWords(query).length === 0) return { hits: [], pagesWithText: 0 };
  const hits: SyPdfSearchHit[] = [];
  let pagesWithText = 0;
  for (let page = 1; page <= source.pageCount; page += 1) {
    if (isCancelled()) break;
    const lines = await pageLines(source.pdf, page);
    onProgress(page, source.pageCount);
    if (lines.length > 0) pagesWithText += 1;
    const hit = matchPage(page, lines, query);
    if (hit !== null) hits.push(hit);
  }
  return { hits: rankHits(hits), pagesWithText };
}

function withoutDiagram(sy: SystemsAnalysis, systemId: string, diagramId: string): SystemsAnalysis {
  return {
    ...sy,
    systemDefinitions: sy.systemDefinitions.map((system) => (system.uuid !== systemId ? system : {
      ...system,
      diagrams: (system.diagrams ?? []).filter((diagram) => diagram.uuid !== diagramId),
    })),
  };
}

function withDiagram(sy: SystemsAnalysis, systemId: string, diagram: SystemDiagram): SystemsAnalysis {
  return {
    ...sy,
    systemDefinitions: sy.systemDefinitions.map((system) => {
      if (system.uuid !== systemId) return system;
      const current = system.diagrams ?? [];
      const diagrams = current.some((item) => item.uuid === diagram.uuid)
        ? current.map((item) => (item.uuid === diagram.uuid ? diagram : item))
        : [...current, diagram];
      return { ...system, diagrams };
    }),
  };
}

function roundRegion(region: SystemDiagramRegion): SystemDiagramRegion {
  const round = (value: number): number => Math.round(Math.min(1, Math.max(0, value)) * 10000) / 10000;
  const x = round(region.x);
  const y = round(region.y);
  return { x, y, width: Math.max(0.0001, round(Math.min(region.width, 1 - x))), height: Math.max(0.0001, round(Math.min(region.height, 1 - y))) };
}

export {
  FULL_PAGE,
  diagramDocuments,
  displayAspect,
  loadDiagramSource,
  matchPage,
  pageAspect,
  rankHits,
  renderDiagram,
  resolveDiagramDocument,
  roundRegion,
  searchPdf,
  withDiagram,
  withoutDiagram,
  type SyDiagramDocument,
  type SyDiagramRender,
  type SyDiagramSource,
  type SyPdfSearchHit,
  type SyPdfSearchResult,
};
