import { JSX, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import logo from "../assets/OpenPRA.png";
import { BookIcon, CaretIcon, LogoutIcon, SettingsIcon, UserIcon } from "./icons";
import { ThemePicker } from "./themePicker";
import { useTheme } from "./useTheme";
import { NotificationBell } from "../notifications/notificationBell";
import "./css/topBar.css";

function computeInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function docsUrl(): string {
  const { protocol, hostname } = window.location;
  if (hostname.endsWith("-dev.openpra.org")) {
    return `${protocol}//${hostname.replace("-dev.openpra.org", "-docs-dev.openpra.org")}`;
  }
  return "https://docs-dev.openpra.org";
}

function TopBar(): JSX.Element {
  const [theme, setTheme] = useTheme();
  const [menuOpen, setMenuOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    function onClick(e: MouseEvent): void {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setMenuOpen(false);
    }
    if (menuOpen) document.addEventListener("mousedown", onClick);
    return () => { document.removeEventListener("mousedown", onClick); };
  }, [menuOpen]);

  function handleSignOut(): void {
    setMenuOpen(false);
    logout();
    navigate("/auth", { replace: true });
  }

  const displayName = user?.username ?? user?.email ?? "Account";
  const displayEmail = user?.email ?? "";
  const firstName = displayName.split(/[\s@]/)[0];
  const initials = computeInitials(displayName.includes("@") ? displayName : displayName);

  return (
    <header className="wp__topbar">
      <button
        type="button"
        className="wp__brand wp__brand--link"
        onClick={() => { navigate("/"); }}
        aria-label="Go to welcome page"
      >
        <img src={logo} alt="OpenPRA" className="wp__brand-logo" />
        <span className="wp__brand-name">OpenPRA</span>
      </button>
      <nav className="wp__topbar-nav" aria-label="Primary">
        <a
          className="wp__nav-link"
          href={docsUrl()}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Documentation"
        >
          <BookIcon /><span>Documentation</span>
        </a>
        <NotificationBell />
        <ThemePicker theme={theme} setTheme={setTheme} />
        <div className="wp__avatar-wrap" ref={wrapRef}>
          <button
            type="button"
            className="wp__avatar-btn"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            onClick={() => { setMenuOpen((o) => !o); }}
          >
            <span className="wp__avatar" aria-hidden="true">{initials}</span>
            <span className="wp__avatar-name">{firstName}</span>
            <span className="wp__avatar-caret"><CaretIcon /></span>
          </button>
          {menuOpen && (
            <div className="wp__menu" role="menu">
              <div className="wp__menu-header">
                <div className="wp__menu-name">{displayName}</div>
                {displayEmail && <div className="wp__menu-email">{displayEmail}</div>}
              </div>
              <button
                type="button"
                className="wp__menu-item"
                role="menuitem"
                onClick={() => { setMenuOpen(false); navigate("/profile"); }}
              >
                <UserIcon /> Profile
              </button>
              <button
                type="button"
                className="wp__menu-item"
                role="menuitem"
                onClick={() => { setMenuOpen(false); navigate("/settings"); }}
              >
                <SettingsIcon /> Settings
              </button>
              <div className="wp__menu-divider" />
              <button type="button" className="wp__menu-item" role="menuitem" onClick={handleSignOut}>
                <LogoutIcon /> Sign out
              </button>
            </div>
          )}
        </div>
      </nav>
    </header>
  );
}

export { TopBar };
