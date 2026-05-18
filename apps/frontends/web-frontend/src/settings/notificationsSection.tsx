import { JSX } from "react";
import { type NotificationPrefs } from "interfaces-shared-types";
import { SettingRow } from "./settingRow";
import { Toggle } from "./toggle";

interface Item {
  key: keyof NotificationPrefs;
  label: string;
  description: string;
}

const ITEMS: Item[] = [
  { key: "projectShared", label: "Project shared with me", description: "Another user or team gives you access to a project." },
  { key: "teamInvite", label: "Team invite", description: "An admin invites you to join their team." },
  { key: "runFinished", label: "Model run finished", description: "A quantification run completes." },
  { key: "quantErrors", label: "Quantification errors", description: "A run fails or produces validation warnings." },
];

function NotificationsSection({
  prefs,
  onToggle,
}: {
  prefs: NotificationPrefs;
  onToggle: (key: keyof NotificationPrefs, next: boolean) => void;
}): JSX.Element {
  return (
    <section id="notifications" className="pf__section st__section">
      <div className="pf__section-h">
        <div>
          <h2 className="pf__section-title">Notifications</h2>
          <p className="pf__section-sub">Pick what we tell you about. Changes save instantly.</p>
        </div>
      </div>
      <div className="st__rows">
        {ITEMS.map((item) => (
          <SettingRow
            key={item.key}
            label={item.label}
            description={item.description}
            control={
              <Toggle
                checked={prefs[item.key]}
                onChange={(next) => { onToggle(item.key, next); }}
                label={item.label}
              />
            }
          />
        ))}
      </div>
    </section>
  );
}

export { NotificationsSection };
