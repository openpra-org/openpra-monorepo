import { JSX, ReactNode } from "react";
import { type SessionInfo, type UserProfile } from "interfaces-shared-types";
import { GoogleIcon, GitHubIcon, LockIcon, MailIcon, UserIcon } from "../welcome/icons";
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
  sessions,
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
  sessions: SessionInfo[];
  onSignOutSession: (id: string) => void;
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
                id="google"
                name="Google"
                bg="#ffffff"
                initial="G"
                logo={<GoogleIcon />}
                enabled
                connected={profile.connectedAccounts.some((c) => c.provider === "google")}
                onConnect={onConnectProvider}
                onDisconnect={onDisconnectProvider}
              />
              <ConnectedProviderRow
                id="github"
                name="GitHub"
                bg="#ffffff"
                initial="G"
                logo={<GitHubIcon />}
                enabled
                connected={profile.connectedAccounts.some((c) => c.provider === "github")}
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
              {sessions.map((session) => (
                <SessionRow key={session.id} session={session} onSignOut={onSignOutSession} />
              ))}
              {sessions.some((session) => !session.current) && (
                <button type="button" className="btn btn--ghost btn--sm st__sessions-all" onClick={onSignOutOthers}>
                  Sign out of all other sessions
                </button>
              )}
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
  logo,
  connected,
  enabled,
  onConnect,
  onDisconnect,
}: {
  id: string;
  name: string;
  bg: string;
  initial: string;
  logo?: ReactNode;
  connected: boolean;
  enabled: boolean;
  onConnect: (id: string) => void;
  onDisconnect: (id: string) => void;
}): JSX.Element {
  const hint = connected ? "Connected" : enabled ? "Not connected" : "Coming soon";
  return (
    <div className="st__provider">
      <span
        className={`st__provider-logo${logo !== undefined ? " st__provider-logo--brand" : ""}`}
        style={{ background: bg }}
      >
        {logo ?? initial}
      </span>
      <div className="st__provider-body">
        <div className="st__provider-name">{name}</div>
        <div className="st__provider-hint">{hint}</div>
      </div>
      <button
        type="button"
        className="btn btn--ghost btn--sm"
        disabled={!enabled}
        onClick={() => { (connected ? onDisconnect : onConnect)(id); }}
      >
        {connected ? "Disconnect" : "Connect"}
      </button>
    </div>
  );
}

function SessionRow({
  session,
  onSignOut,
}: {
  session: SessionInfo;
  onSignOut: (id: string) => void;
}): JSX.Element {
  return (
    <div className="st__session">
      <div className="st__session-body">
        <div className="st__session-head">
          <span className="st__session-device">{session.device}</span>
          <span className="st__session-sep">·</span>
          <span>{session.browser}</span>
        </div>
        <div className="st__session-meta">{session.lastActive}</div>
      </div>
      {session.current ? (
        <span className="st__session-chip">This device</span>
      ) : (
        <button type="button" className="btn btn--ghost btn--sm" onClick={() => { onSignOut(session.id); }}>
          Sign out
        </button>
      )}
    </div>
  );
}

export { AccountSection };
