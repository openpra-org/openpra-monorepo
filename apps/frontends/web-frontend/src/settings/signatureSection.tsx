import { JSX } from "react";
import { SignatureSetupModal } from "./signatureSetupModal";
import { clearMySignature } from "../users/userApi";
import "./css/signatureSection.css";

function SignatureSection({
  signatureDataUrl,
  modalOpen,
  onOpenModal,
  onCloseModal,
  onSaved,
  onCleared,
}: {
  signatureDataUrl: string | null;
  modalOpen: boolean;
  onOpenModal: () => void;
  onCloseModal: () => void;
  onSaved: (dataUrl: string) => void;
  onCleared: () => void;
}): JSX.Element {
  function handleClear(): void {
    clearMySignature()
      .then(() => { onCleared(); })
      .catch(() => { /* toast handled by parent if needed */ });
  }

  return (
    <section id="signature" className="pf__section st__section">
      <div className="pf__section-h">
        <div>
          <h2 className="pf__section-title">Signature</h2>
          <p className="pf__section-sub">Your handwritten signature is placed on workbooks when you sign off as a reviewer, approver, or preparer.</p>
        </div>
      </div>

      <div className="sigsec__body">
        {signatureDataUrl !== null ? (
          <div className="sigsec__preview-wrap">
            <div className="sigsec__preview-label">Current signature</div>
            <div className="sigsec__preview">
              <img src={signatureDataUrl} alt="Your signature" className="sigsec__img" />
            </div>
            <div className="sigsec__actions">
              <button type="button" className="btn btn--ghost btn--sm" onClick={onOpenModal}>Update</button>
              <button type="button" className="btn btn--ghost btn--sm sigsec__clear-btn" onClick={handleClear}>Remove</button>
            </div>
          </div>
        ) : (
          <div className="sigsec__empty">
            <p className="sigsec__empty-text">No signature set up yet.</p>
            <button type="button" className="btn btn--primary btn--sm" onClick={onOpenModal}>Set up signature</button>
          </div>
        )}
      </div>

      {modalOpen && (
        <SignatureSetupModal
          onClose={onCloseModal}
          onSaved={(dataUrl) => { onSaved(dataUrl); onCloseModal(); }}
        />
      )}
    </section>
  );
}

export { SignatureSection };
