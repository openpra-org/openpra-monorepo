import { JSX } from "react";
import { KeyIcon, PlusIcon } from "../welcome/icons";
import "./css/apiKeysSection.css";

function ApiKeysSection({ onAdd }: { onAdd: () => void }): JSX.Element {
  return (
    <section className="pf__section">
      <div className="pf__section-h">
        <div>
          <h2 className="pf__section-title">AI provider keys</h2>
          <p className="pf__section-sub">
            Keys you bring in for OpenPRA&apos;s multi-agent workflows. Stored encrypted; never shown after creation.
          </p>
        </div>
      </div>
      <div className="pf__keys-empty">
        <KeyIcon />
        <h3>No provider keys yet</h3>
        <p>Bring an Anthropic, OpenAI, or other provider key to power OpenPRA&apos;s agent features.</p>
        <button type="button" className="btn btn--primary" onClick={onAdd}>
          <PlusIcon /> Add your first provider
        </button>
      </div>
    </section>
  );
}

export { ApiKeysSection };
