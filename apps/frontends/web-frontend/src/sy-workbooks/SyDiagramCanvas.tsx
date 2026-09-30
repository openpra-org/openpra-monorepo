import { useEffect, useRef, useState, type JSX, type PointerEvent, type RefObject } from "react";
import type { SystemDiagram, SystemDiagramRegion, SystemDiagramRotation } from "interfaces-mef-types/sy/systems-analysis";
import { displayAspect, loadDiagramSource, pageAspect, renderDiagram, resolveDiagramDocument, type SyDiagramSource } from "./syDiagrams";
import { useSyWorkbook } from "./syWorkbookContext";

function useElementSize(element: RefObject<HTMLElement | null>): { width: number; height: number } {
  const [size, setSize] = useState({ width: 0, height: 0 });
  useEffect(() => {
    const target = element.current;
    if (target === null) return undefined;
    function measure(): void {
      if (target === null) return;
      const width = target.clientWidth;
      const height = target.clientHeight;
      setSize((current) => (current.width === width && current.height === height ? current : { width, height }));
    }
    measure();
    if (typeof ResizeObserver === "undefined") return undefined;
    const observer = new ResizeObserver(measure);
    observer.observe(target);
    return () => observer.disconnect();
  }, [element]);
  return size;
}

function useElementWidth(element: RefObject<HTMLElement | null>): number {
  return useElementSize(element).width;
}

function usePageAspect(source: SyDiagramSource | null, page: number): number | null {
  const [aspect, setAspect] = useState<number | null>(null);
  useEffect(() => {
    setAspect(null);
    if (source === null) return undefined;
    let active = true;
    pageAspect(source, page)
      .then((value) => { if (active) setAspect(value); })
      .catch(() => { if (active) setAspect(1.3); });
    return () => { active = false; };
  }, [source, page]);
  return aspect;
}

function capturePointer(event: PointerEvent<HTMLElement>): void {
  try {
    event.currentTarget.setPointerCapture(event.pointerId);
  } catch {
    return;
  }
}

function SyDiagramCanvas({ source, page, region, width, label, rotation = 0 }: {
  source: SyDiagramSource;
  page: number;
  region: SystemDiagramRegion;
  width: number;
  label: string;
  rotation?: SystemDiagramRotation;
}): JSX.Element {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [error, setError] = useState<string | null>(null);
  const { x, y, width: regionWidth, height: regionHeight } = region;

  useEffect(() => {
    const target = canvas.current;
    if (target === null || width <= 0) return undefined;
    let active = true;
    const render = renderDiagram(source, page, { x, y, width: regionWidth, height: regionHeight }, width);
    render.done
      .then((image) => {
        if (!active) return;
        const turned = rotation === 90 || rotation === 270;
        target.width = turned ? image.height : image.width;
        target.height = turned ? image.width : image.height;
        const context = target.getContext("2d");
        if (context !== null) {
          context.save();
          context.translate(target.width / 2, target.height / 2);
          context.rotate((rotation * Math.PI) / 180);
          context.drawImage(image, -image.width / 2, -image.height / 2);
          context.restore();
        }
        setError(null);
      })
      .catch((err: Error) => {
        if (active) setError(err.message.length > 0 ? err.message : "The diagram could not be drawn.");
      });
    return () => {
      active = false;
      render.cancel();
    };
  }, [source, page, x, y, regionWidth, regionHeight, width, rotation]);

  return (
    <>
      <canvas ref={canvas} className="sy-diagram-canvas" role="img" aria-label={label} style={{ width }} />
      {error !== null && <p className="sy-review-error">{error}</p>}
    </>
  );
}

function SyDiagramView({ diagram, width, height }: { diagram: SystemDiagram; width: number; height?: number }): JSX.Element {
  const { sy, runtime } = useSyWorkbook();
  const sourceDocument = resolveDiagramDocument(sy, runtime.workbookId, diagram);
  const url = sourceDocument?.url ?? null;
  const kind = sourceDocument?.kind ?? null;
  const [source, setSource] = useState<SyDiagramSource | null>(null);
  const [error, setError] = useState<string | null>(null);
  const pageShape = usePageAspect(height === undefined ? null : source, diagram.page);
  const rotation = diagram.rotation ?? 0;

  useEffect(() => {
    if (url === null || kind === null) return undefined;
    let active = true;
    setSource(null);
    setError(null);
    loadDiagramSource({ url, kind })
      .then((loaded) => { if (active) setSource(loaded); })
      .catch((err: Error) => { if (active) setError(err.message.length > 0 ? err.message : "The source document could not be opened."); });
    return () => { active = false; };
  }, [url, kind]);

  if (sourceDocument === null) return <p className="sy-review-error">The source document is not in this workbook.</p>;
  if (error !== null) return <p className="sy-review-error">{error}</p>;
  if (source === null) return <p className="sy-review-empty">Opening {diagram.filename}…</p>;
  if (diagram.page > source.pageCount) return <p className="sy-review-error">Page {diagram.page} is not in {diagram.filename}.</p>;
  if (height === undefined) return <SyDiagramCanvas source={source} page={diagram.page} region={diagram.region} width={width} label={diagram.title} rotation={rotation} />;
  if (pageShape === null) return <p className="sy-review-empty">Opening {diagram.filename}…</p>;
  const fitted = Math.floor(Math.min(width, height / displayAspect(pageShape, diagram.region, rotation)));
  return <SyDiagramCanvas source={source} page={diagram.page} region={diagram.region} width={fitted} label={diagram.title} rotation={rotation} />;
}

export { SyDiagramCanvas, SyDiagramView, capturePointer, useElementSize, useElementWidth, usePageAspect };
