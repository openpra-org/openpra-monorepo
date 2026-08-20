import { JSX } from "react";
import { DownloadIcon, TrashIcon } from "../welcome/icons";
import { SettingRow } from "./settingRow";

function DataSection({
  onExport,
  onDelete,
}: {
  onExport: () => void;
  onDelete: () => void;
}): JSX.Element {
  return (
    <section id="data" className="pf__section st__section st__danger">
      <div className="pf__section-h">
        <div>
          <h2 className="pf__section-title">Data &amp; privacy</h2>
        </div>
      </div>
      <div className="st__rows">
        <SettingRow
          label="Export all my data"
          description="Downloads a JSON file with your profile, owned projects, team memberships, and notifications."
          control={
            <button type="button" className="btn btn--ghost btn--sm" onClick={onExport}>
              <DownloadIcon /> Download my data
            </button>
          }
        />
        <SettingRow
          label="Delete my account"
          description="Permanently removes your account, owned projects, and admin teams."
          control={
            <button type="button" className="btn btn--danger btn--sm" onClick={onDelete}>
              <TrashIcon /> Delete account
            </button>
          }
        />
      </div>
    </section>
  );
}

export { DataSection };
