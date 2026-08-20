import { JSX, useEffect, useRef, useState, FormEvent } from "react";
import { QRCodeSVG } from "qrcode.react";
import { CloseIcon } from "../welcome/icons";
import { setupTwoFactor, enableTwoFactor } from "../users/userApi";
import "./css/twoFactorSetupModal.css";

function TwoFactorSetupModal({
  onClose,
  onEnabled,
}: {
  onClose: () => void;
  onEnabled: () => void;
}): JSX.Element {
  const [otpauthUri, setOtpauthUri] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [enabling, setEnabling] = useState(false);
  const [enableError, setEnableError] = useState<string | null>(null);
  const [backupCodes, setBackupCodes] = useState<string[] | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    setupTwoFactor()
      .then((res) => {
        if (cancelled) return;
        setOtpauthUri(res.otpauthUri);
        setSecret(res.secret);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setLoadError((err as { message?: string }).message ?? "Could not start setup");
      });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    const id = window.setTimeout(() => { inputRef.current?.focus(); }, 50);
    return () => { window.clearTimeout(id); };
  }, [otpauthUri]);

  useEffect(() => {
    function onKey(e: KeyboardEvent): void {
      if (e.key === "Escape" && !enabling) onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("keydown", onKey); };
  }, [onClose, enabling]);

  function submit(e: FormEvent<HTMLFormElement>): void {
    e.preventDefault();
    if (code.trim().length === 0 || enabling) return;
    setEnableError(null);
    setEnabling(true);
    enableTwoFactor(code.trim())
      .then((res) => {
        setBackupCodes(res.backupCodes);
        onEnabled();
      })
      .catch((err: unknown) => {
        setEnableError((err as { message?: string }).message ?? "Invalid authentication code");
      })
      .finally(() => { setEnabling(false); });
  }

  return (
    <div
      className="modal__backdrop"
      onClick={(e) => { if (e.target === e.currentTarget && !enabling) onClose(); }}
    >
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="tfa-title">
        <div className="modal__head">
          <div>
            <h2 className="modal__title" id="tfa-title">
              {backupCodes === null ? "Set up two-factor authentication" : "Save your backup codes"}
            </h2>
            <p className="modal__sub">
              {backupCodes === null
                ? "Scan the QR code with an authenticator app, then enter the 6-digit code."
                : "Store these somewhere safe. Each code works once if you lose your device."}
            </p>
          </div>
          <button type="button" className="modal__close" onClick={onClose} aria-label="Close" disabled={enabling}>
            <CloseIcon />
          </button>
        </div>

        {backupCodes === null ? (
          <form onSubmit={submit} noValidate>
            <div className="modal__body">
              {loadError !== null && <p className="tfa__error">{loadError}</p>}
              {loadError === null && otpauthUri === null && <p className="tfa__loading">Preparing setup…</p>}
              {otpauthUri !== null && secret !== null && (
                <>
                  <div className="tfa__qr-wrap">
                    <QRCodeSVG value={otpauthUri} size={172} marginSize={2} level="M" />
                  </div>
                  <div className="tfa__manual">
                    <span className="tfa__manual-label">Can't scan? Enter this key manually</span>
                    <code className="tfa__manual-key">{secret}</code>
                  </div>
                  <div className="field">
                    <label className="field__label" htmlFor="tfa-code">Authentication code</label>
                    <input
                      ref={inputRef}
                      id="tfa-code"
                      type="text"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      value={code}
                      onChange={(e) => { setCode(e.target.value); if (enableError !== null) setEnableError(null); }}
                      className={`field__input${enableError !== null ? " field__input--error" : ""}`}
                      disabled={enabling}
                    />
                    {enableError !== null && <div className="field__error">{enableError}</div>}
                  </div>
                </>
              )}
            </div>
            <div className="modal__foot">
              <button type="button" className="btn btn--ghost" onClick={onClose} disabled={enabling}>Cancel</button>
              <button type="submit" className="btn btn--primary" disabled={enabling || otpauthUri === null || code.trim().length === 0}>
                {enabling ? "Verifying…" : "Verify & enable"}
              </button>
            </div>
          </form>
        ) : (
          <>
            <div className="modal__body">
              <ul className="tfa__backup-grid">
                {backupCodes.map((c) => (
                  <li key={c} className="tfa__backup-item">{c}</li>
                ))}
              </ul>
            </div>
            <div className="modal__foot">
              <button type="button" className="btn btn--primary" onClick={onClose}>Done</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export { TwoFactorSetupModal };
