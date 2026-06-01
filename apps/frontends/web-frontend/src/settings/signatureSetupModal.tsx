import { JSX, useEffect, useRef, useState } from "react";
import { CloseIcon } from "../welcome/icons";
import { saveMySignature } from "../users/userApi";
import "./css/signatureSetupModal.css";

interface SignatureSetupModalProps {
  onClose: () => void;
  onSaved: (dataUrl: string) => void;
}

function SignatureSetupModal({ onClose, onSaved }: SignatureSetupModalProps): JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawing = useRef(false);
  const lastPos = useRef<{ x: number; y: number } | null>(null);
  const [hasStrokes, setHasStrokes] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas === null) return;
    const ctx = canvas.getContext("2d");
    if (ctx === null) return;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = "#1a1a2e";
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
  }, []);

  function relativePos(clientX: number, clientY: number, canvas: HTMLCanvasElement): { x: number; y: number } {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY,
    };
  }

  function startDraw(pos: { x: number; y: number }): void {
    drawing.current = true;
    lastPos.current = pos;
  }

  function continueDraw(pos: { x: number; y: number }): void {
    if (!drawing.current || lastPos.current === null) return;
    const canvas = canvasRef.current;
    if (canvas === null) return;
    const ctx = canvas.getContext("2d");
    if (ctx === null) return;
    ctx.beginPath();
    ctx.moveTo(lastPos.current.x, lastPos.current.y);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
    lastPos.current = pos;
    setHasStrokes(true);
  }

  function endDraw(): void {
    drawing.current = false;
    lastPos.current = null;
  }

  function handleMouseDown(e: React.MouseEvent<HTMLCanvasElement>): void {
    const canvas = canvasRef.current;
    if (canvas === null) return;
    startDraw(relativePos(e.clientX, e.clientY, canvas));
  }

  function handleMouseMove(e: React.MouseEvent<HTMLCanvasElement>): void {
    const canvas = canvasRef.current;
    if (canvas === null) return;
    continueDraw(relativePos(e.clientX, e.clientY, canvas));
  }

  function handleTouchStart(e: React.TouchEvent<HTMLCanvasElement>): void {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (canvas === null) return;
    const touch = e.touches[0];
    if (touch === undefined) return;
    startDraw(relativePos(touch.clientX, touch.clientY, canvas));
  }

  function handleTouchMove(e: React.TouchEvent<HTMLCanvasElement>): void {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (canvas === null) return;
    const touch = e.touches[0];
    if (touch === undefined) return;
    continueDraw(relativePos(touch.clientX, touch.clientY, canvas));
  }

  function handleClear(): void {
    const canvas = canvasRef.current;
    if (canvas === null) return;
    const ctx = canvas.getContext("2d");
    if (ctx === null) return;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    setHasStrokes(false);
  }

  function handleSave(): void {
    const canvas = canvasRef.current;
    if (canvas === null) return;
    const dataUrl = canvas.toDataURL("image/png");
    setSaving(true);
    setError(null);
    saveMySignature(dataUrl)
      .then(() => { onSaved(dataUrl); })
      .catch((err: unknown) => {
        setError((err as { message?: string }).message ?? "Could not save signature");
        setSaving(false);
      });
  }

  return (
    <div className="sigmodal__backdrop" onClick={onClose}>
      <div className="sigmodal" role="dialog" aria-label="Set up signature" onClick={(e) => e.stopPropagation()}>
        <div className="sigmodal__head">
          <div>
            <h2 className="sigmodal__title">Set up your signature</h2>
            <p className="sigmodal__sub">Draw your signature below. It will be used on all workbook sign-offs.</p>
          </div>
          <button type="button" className="sigmodal__close" onClick={onClose} aria-label="Close"><CloseIcon /></button>
        </div>

        <div className="sigmodal__canvas-wrap">
          <canvas
            ref={canvasRef}
            className="sigmodal__canvas"
            width={600}
            height={200}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={endDraw}
            onMouseLeave={endDraw}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={endDraw}
          />
          {!hasStrokes && (
            <div className="sigmodal__canvas-hint" aria-hidden="true">Sign here</div>
          )}
        </div>

        {error !== null && <p className="sigmodal__error">{error}</p>}

        <div className="sigmodal__foot">
          <button type="button" className="btn btn--ghost btn--sm" onClick={handleClear} disabled={!hasStrokes}>
            Clear
          </button>
          <div className="sigmodal__foot-right">
            <button type="button" className="btn btn--ghost btn--sm" onClick={onClose}>Cancel</button>
            <button
              type="button"
              className="btn btn--primary btn--sm"
              onClick={handleSave}
              disabled={!hasStrokes || saving}
            >
              {saving ? "Saving…" : "Save signature"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export { SignatureSetupModal };
