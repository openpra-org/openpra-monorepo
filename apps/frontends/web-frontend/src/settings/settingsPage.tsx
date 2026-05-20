import { JSX, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  type ChangeEmailRequest,
  type ChangePasswordRequest,
  type ChangeUsernameRequest,
  type NotificationPrefs,
  type UserProfile,
} from "interfaces-shared-types";
import { useToast } from "../toast/toastProvider";
import { useAuth } from "../auth/AuthContext";
import { ArrowLeftIcon } from "../welcome/icons";
import { ThemePicker } from "../welcome/themePicker";
import { useTheme } from "../welcome/useTheme";
import {
  changeEmail,
  changePassword,
  changeUsername,
  deleteMyAccount,
  disableTwoFactor,
  getMyProfile,
  getNotificationPrefs,
  updateNotificationPrefs,
} from "../users/userApi";
import { SettingsSidebar, SETTINGS_NAV_ITEMS } from "./settingsSidebar";
import { AccountSection } from "./accountSection";
import { NotificationsSection } from "./notificationsSection";
import { AppearanceSection } from "./appearanceSection";
import { WorkspaceSection } from "./workspaceSection";
import { ShortcutsSection } from "./shortcutsSection";
import { DataSection } from "./dataSection";
import { ChangeEmailModal } from "./changeEmailModal";
import { ChangeUsernameModal } from "./changeUsernameModal";
import { ChangePasswordModal } from "./changePasswordModal";
import { DeleteAccountModal } from "./deleteAccountModal";
import { TwoFactorSetupModal } from "./twoFactorSetupModal";
import { TwoFactorDisableModal } from "./twoFactorDisableModal";
import { useAppearancePrefs } from "./useAppearancePrefs";
import { useWorkspaceDefaults } from "./useWorkspaceDefaults";
import "./css/settingsPage.css";

const DEFAULT_NOTIFY: NotificationPrefs = {
  projectShared: true,
  teamInvite: true,
  runFinished: true,
  quantErrors: true,
};

function SettingsPage(): JSX.Element {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [notify, setNotify] = useState<NotificationPrefs>(DEFAULT_NOTIFY);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<string>("account");
  const [emailOpen, setEmailOpen] = useState(false);
  const [usernameOpen, setUsernameOpen] = useState(false);
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [tfaSetupOpen, setTfaSetupOpen] = useState(false);
  const [tfaDisableOpen, setTfaDisableOpen] = useState(false);
  const [mutating, setMutating] = useState(false);
  const [theme, setTheme] = useTheme();
  const appearance = useAppearancePrefs();
  const workspace = useWorkspaceDefaults();
  const { addToast } = useToast();
  const navigate = useNavigate();
  const { logout } = useAuth();
  const observerRef = useRef<IntersectionObserver | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([getMyProfile(), getNotificationPrefs()])
      .then(([profileRes, notifyRes]) => {
        if (cancelled) return;
        setProfile(profileRes.profile);
        setNotify(notifyRes);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setLoadError((err as { message?: string }).message ?? "Could not load settings");
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (loading || profile === null) return undefined;
    const visible = new Map<string, number>();
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            visible.set(entry.target.id, entry.boundingClientRect.top);
          } else {
            visible.delete(entry.target.id);
          }
        });
        if (visible.size === 0) return;
        let topId = "";
        let topY = Number.POSITIVE_INFINITY;
        visible.forEach((y, id) => {
          if (y < topY) {
            topY = y;
            topId = id;
          }
        });
        if (topId) setActiveId(topId);
      },
      { rootMargin: "-100px 0px -55% 0px" },
    );
    SETTINGS_NAV_ITEMS.forEach((item) => {
      const el = document.getElementById(item.id);
      if (el !== null) observer.observe(el);
    });
    observerRef.current = observer;
    return () => {
      observer.disconnect();
      observerRef.current = null;
    };
  }, [loading, profile]);

  function flashSuccess(msg: string): void {
    addToast({ id: crypto.randomUUID(), type: "success", message: msg });
  }

  function flashError(msg: string): void {
    addToast({ id: crypto.randomUUID(), type: "danger", message: msg });
  }

  function comingSoon(label: string): void {
    addToast({ id: crypto.randomUUID(), type: "info", message: `${label} — coming soon` });
  }

  function jumpTo(id: string): void {
    const el = document.getElementById(id);
    if (el === null) return;
    setActiveId(id);
    el.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function handleChangeEmailSubmit(payload: ChangeEmailRequest): void {
    setMutating(true);
    changeEmail(payload)
      .then((res) => {
        setProfile(res.profile);
        setEmailOpen(false);
        flashSuccess("Email updated");
      })
      .catch((err: unknown) => {
        flashError((err as { message?: string }).message ?? "Could not update email");
      })
      .finally(() => { setMutating(false); });
  }

  function handleChangeUsernameSubmit(payload: ChangeUsernameRequest): void {
    setMutating(true);
    changeUsername(payload)
      .then((res) => {
        setProfile(res.profile);
        setUsernameOpen(false);
        flashSuccess("Username updated");
      })
      .catch((err: unknown) => {
        flashError((err as { message?: string }).message ?? "Could not update username");
      })
      .finally(() => { setMutating(false); });
  }

  function handleChangePasswordSubmit(payload: ChangePasswordRequest): void {
    setMutating(true);
    changePassword(payload)
      .then(() => {
        setPasswordOpen(false);
        flashSuccess("Password updated");
      })
      .catch((err: unknown) => {
        flashError((err as { message?: string }).message ?? "Could not update password");
      })
      .finally(() => { setMutating(false); });
  }

  function handleDeleteAccountConfirm(currentPassword: string): void {
    setMutating(true);
    deleteMyAccount(currentPassword)
      .then(() => {
        flashSuccess("Account deleted");
        logout();
        navigate("/auth", { replace: true });
      })
      .catch((err: unknown) => {
        flashError((err as { message?: string }).message ?? "Could not delete account");
      })
      .finally(() => { setMutating(false); });
  }

  function handleTwoFactorEnabled(): void {
    setProfile((prev) => (prev === null ? prev : { ...prev, twoFactorEnabled: true }));
    flashSuccess("Two-factor authentication enabled");
  }

  function handleDisableTwoFactorConfirm(code: string): void {
    setMutating(true);
    disableTwoFactor(code)
      .then(() => {
        setProfile((prev) => (prev === null ? prev : { ...prev, twoFactorEnabled: false }));
        setTfaDisableOpen(false);
        flashSuccess("Two-factor authentication disabled");
      })
      .catch((err: unknown) => {
        flashError((err as { message?: string }).message ?? "Could not disable two-factor authentication");
      })
      .finally(() => { setMutating(false); });
  }

  function handleNotifyToggle(key: keyof NotificationPrefs, next: boolean): void {
    const prev = notify;
    const optimistic = { ...notify, [key]: next };
    setNotify(optimistic);
    updateNotificationPrefs({ [key]: next })
      .then((server) => { setNotify(server); })
      .catch((err: unknown) => {
        setNotify(prev);
        flashError((err as { message?: string }).message ?? "Could not save notification preference");
      });
  }

  return (
    <div className="wp wp--compact ap pf st">
      <div className="wp__bg" />
      <main className="wp__main st__main">
        <div className="pf__topline">
          <button type="button" className="ap__back pf__back" onClick={() => { navigate("/"); }}>
            <ArrowLeftIcon /> Welcome
          </button>
          <ThemePicker theme={theme} setTheme={setTheme} />
        </div>

        <h1 className="st__title">Settings</h1>
        <p className="st__subtitle">Manage your account, preferences, and workspace defaults.</p>

        {loadError && <p className="st__load-error">{loadError}</p>}

        {!loading && !loadError && profile !== null && (
          <div className="st__shell">
            <SettingsSidebar activeId={activeId} onJump={jumpTo} />
            <div className="st__col">
              <AccountSection
                profile={profile}
                onChangeEmail={() => { setEmailOpen(true); }}
                onChangeUsername={() => { setUsernameOpen(true); }}
                onChangePassword={() => { setPasswordOpen(true); }}
                onSetupTfa={() => { setTfaSetupOpen(true); }}
                onDisableTfa={() => { setTfaDisableOpen(true); }}
                onConnectProvider={(id) => { comingSoon(`Connect ${id}`); }}
                onDisconnectProvider={(id) => { comingSoon(`Disconnect ${id}`); }}
                onSignOutSession={(label) => { comingSoon(`Sign out ${label}`); }}
                onSignOutOthers={() => { comingSoon("Sign out of other sessions"); }}
              />
              <NotificationsSection prefs={notify} onToggle={handleNotifyToggle} />
              <AppearanceSection
                theme={theme}
                setTheme={setTheme}
                prefs={appearance.prefs}
                setDensity={appearance.setDensity}
                setFontSize={appearance.setFontSize}
                setReducedMotion={appearance.setReducedMotion}
                setHighContrast={appearance.setHighContrast}
                setSigFigs={appearance.setSigFigs}
              />
              <WorkspaceSection
                defaults={workspace.defaults}
                setEngine={workspace.setEngine}
                setApproximation={workspace.setApproximation}
                setTruncation={workspace.setTruncation}
              />
              <ShortcutsSection />
              <DataSection
                onExport={() => { comingSoon("Data export"); }}
                onDelete={() => { setDeleteOpen(true); }}
              />
            </div>
          </div>
        )}
      </main>

      {emailOpen && profile !== null && (
        <ChangeEmailModal
          currentEmail={profile.email}
          onCancel={() => { if (!mutating) setEmailOpen(false); }}
          onSubmit={handleChangeEmailSubmit}
          pending={mutating}
        />
      )}

      {usernameOpen && profile !== null && (
        <ChangeUsernameModal
          currentUsername={profile.username}
          onCancel={() => { if (!mutating) setUsernameOpen(false); }}
          onSubmit={handleChangeUsernameSubmit}
          pending={mutating}
        />
      )}

      {passwordOpen && (
        <ChangePasswordModal
          onCancel={() => { if (!mutating) setPasswordOpen(false); }}
          onSubmit={handleChangePasswordSubmit}
          pending={mutating}
        />
      )}

      {deleteOpen && (
        <DeleteAccountModal
          onCancel={() => { if (!mutating) setDeleteOpen(false); }}
          onConfirm={handleDeleteAccountConfirm}
          pending={mutating}
        />
      )}

      {tfaSetupOpen && (
        <TwoFactorSetupModal
          onClose={() => { setTfaSetupOpen(false); }}
          onEnabled={handleTwoFactorEnabled}
        />
      )}

      {tfaDisableOpen && (
        <TwoFactorDisableModal
          onCancel={() => { if (!mutating) setTfaDisableOpen(false); }}
          onConfirm={handleDisableTwoFactorConfirm}
          pending={mutating}
        />
      )}
    </div>
  );
}

export { SettingsPage };
