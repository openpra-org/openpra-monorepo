import { JSX } from "react";
import { type UserProfile } from "interfaces-shared-types";
import { LockIcon, MailIcon, UserIcon } from "../welcome/icons";
import { SettingRow } from "./settingRow";
import "./css/accountSection.css";

function AccountSection({
  profile,
  onChangeEmail,
  onChangeUsername,
  onChangePassword,
  onSetupTfa,
  onDisableTfa,
  onConnectProvider,
  onDisconnectProvider,
  onSignOutSession,
  onSignOutOthers,
}: {
  profile: UserProfile;
  onChangeEmail: () => void;
  onChangeUsername: () => void;
  onChangePassword: () => void;
  onSetupTfa: () => void;
  onDisableTfa: () => void;
  onConnectProvider: (id: string) => void;
  onDisconnectProvider: (id: string) => void;
  onSignOutSession: (label: string) => void;
  onSignOutOthers: () => void;
}): JSX.Element {
  return (
    <section id="account" className="pf__section st__section">
      <div className="pf__section-h">
        <div>
          <h2 className="pf__section-title">Account &amp; security</h2>
        </div>
      </div>
      <div className="st__rows">
        <SettingRow
          label="Email address"
          description={<span className="st__mono">{profile.email}</span>}
          control={
            <button type="button" className="btn btn--ghost btn--sm" onClick={onChangeEmail}>
              <MailIcon /> Change
            </button>
          }
        />
        <SettingRow
          label="Username"
          description={<span className="st__mono">@{profile.username}</span>}
          control={
            <button type="button" className="btn btn--ghost btn--sm" onClick={onChangeUsername}>
              <UserIcon /> Change
            </button>
          }
        />
        <SettingRow
          label="Password"
          control={
            <button type="button" className="btn btn--ghost btn--sm" onClick={onChangePassword}>
              <LockIcon /> Change password
            </button>
          }
        />
        <SettingRow
          label="Two-factor authentication"
          control={
            profile.twoFactorEnabled ? (
              <div className="st__row-pair">
                <span className="st__pill st__pill--on">On</span>
                <button type="button" className="btn btn--ghost btn--sm" onClick={onDisableTfa}>
                  Disable
                </button>
              </div>
            ) : (
              <div className="st__row-pair">
                <span className="st__pill st__pill--off">Off</span>
                <button type="button" className="btn btn--primary btn--sm" onClick={onSetupTfa}>
                  Set up
                </button>
              </div>
            )
          }
        />
        <SettingRow
          label="Connected accounts"
          stack
          top
          control={
            <div className="st__providers">
              <ConnectedProviderRow
                id="github"
                name="GitHub"
                bg="#1d1d20"
                initial="G"
                onConnect={onConnectProvider}
                onDisconnect={onDisconnectProvider}
              />
              <ConnectedProviderRow
                id="google"
                name="Google"
                bg="#4285f4"
                initial="G"
                onConnect={onConnectProvider}
                onDisconnect={onDisconnectProvider}
              />
              <ConnectedProviderRow
                id="orcid"
                name="ORCID"
                bg="#a6ce39"
                initial="O"
                onConnect={onConnectProvider}
                onDisconnect={onDisconnectProvider}
              />
            </div>
          }
        />
        <SettingRow
          label="Active sessions"
          stack
          top
          control={
            <div className="st__sessions">
              <SessionRow
                device="MacBook Pro"
                browser="Safari"
                location="Raleigh, NC"
                lastActive="Just now"
                current
                onSignOut={() => { onSignOutSession("MacBook Pro"); }}
              />
              <SessionRow
                device="iPhone 15"
                browser="OpenPRA iOS"
                location="Raleigh, NC"
                lastActive="2 hours ago"
                onSignOut={() => { onSignOutSession("iPhone 15"); }}
              />
              <SessionRow
                device="Lab workstation"
                browser="Firefox"
                location="NC State"
                lastActive="Yesterday"
                onSignOut={() => { onSignOutSession("Lab workstation"); }}
              />
              <button type="button" className="btn btn--ghost btn--sm st__sessions-all" onClick={onSignOutOthers}>
                Sign out of all other sessions
              </button>
            </div>
          }
        />
      </div>
    </section>
  );
}

function ConnectedProviderRow({
  id,
  name,
  bg,
  initial,
  onConnect,
  onDisconnect,
}: {
  id: string;
  name: string;
  bg: string;
  initial: string;
  onConnect: (id: string) => void;
  onDisconnect: (id: string) => void;
}): JSX.Element {
  const connected = false;
  return (
    <div className="st__provider">
      <span className="st__provider-logo" style={{ background: bg }}>{initial}</span>
      <div className="st__provider-body">
        <div className="st__provider-name">{name}</div>
        <div className="st__provider-hint">
          {connected ? <>Connected</> : <>Not connected</>}
        </div>
      </div>
      <button
        type="button"
        className="btn btn--ghost btn--sm"
        onClick={() => { (connected ? onDisconnect : onConnect)(id); }}
      >
        {connected ? "Disconnect" : "Connect"}
      </button>
    </div>
  );
}

function SessionRow({
  device,
  browser,
  location,
  lastActive,
  current,
  onSignOut,
}: {
  device: string;
  browser: string;
  location: string;
  lastActive: string;
  current?: boolean;
  onSignOut: () => void;
}): JSX.Element {
  return (
    <div className="st__session">
      <div className="st__session-body">
        <div className="st__session-head">
          <span className="st__session-device">{device}</span>
          <span className="st__session-sep">·</span>
          <span>{browser}</span>
          {current && <span className="st__session-chip">This device</span>}
        </div>
        <div className="st__session-meta">
          {location} · {lastActive}
        </div>
      </div>
      {!current && (
        <button type="button" className="btn btn--ghost btn--sm" onClick={onSignOut}>
          Sign out
        </button>
      )}
    </div>
  );
}

export { AccountSection };
