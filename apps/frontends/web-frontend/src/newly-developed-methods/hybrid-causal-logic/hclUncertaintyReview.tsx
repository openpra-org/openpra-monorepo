import { useEffect, useState } from "react";
import type { HclUncertaintySettings } from "interfaces-mef-types/modeling";
import { HclUncertaintySettingsSchema } from "interfaces-mef-types/zod/modeling";
import { stringifyJson } from "interfaces-shared-types/json";

/** Keeps invalid saved data available for explicit review without using it. */
export function HclUncertaintyReview({ value, disabled, onChange }: {
  value: unknown;
  disabled: boolean;
  onChange: (settings: HclUncertaintySettings) => void;
}) {
  const [draft, setDraft] = useState(() => stringifyJson(value, 2) ?? "null");
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    setDraft(stringifyJson(value, 2) ?? "null");
    setError(null);
  }, [value]);
  return <div>
    <p role="status">Saved uncertainty settings need review. Probability calculations can still run.</p>
    <details>
      <summary>Review saved uncertainty JSON</summary>
      <label>Saved uncertainty settings<textarea value={draft} disabled={disabled} onChange={(event) => setDraft(event.target.value)} /></label>
      <button type="button" disabled={disabled} onClick={() => {
        try {
          const settings = HclUncertaintySettingsSchema.parse(JSON.parse(draft));
          onChange(settings);
          setError(null);
        } catch (error) {
          setError(error instanceof Error ? error.message : "Invalid uncertainty settings");
        }
      }}>Apply reviewed settings</button>
      {error !== null && <p role="alert">{error}</p>}
    </details>
  </div>;
}
