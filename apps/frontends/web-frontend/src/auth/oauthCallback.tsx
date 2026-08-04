import { JSX, useContext, useEffect, useMemo, useState, type FormEvent } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { setToken } from "./authStorage";
import { useAuth, getRoles } from "./AuthContext";
import { UpdateRole } from "../role/role";
import { RoleContext } from "../role/roleProvider";
import { clearCampaignAttribution } from "../analytics/analytics";
import logo from "../assets/Triplet.png";
import "./css/loginForm.css";
import "./css/authPage.css";

function parseHash(): URLSearchParams {
  const raw = window.location.hash.startsWith("#") ? window.location.hash.slice(1) : window.location.hash;
  return new URLSearchParams(raw);
}

function providerLabel(provider: string): string {
  if (provider === "google") return "Google";
  if (provider === "github") return "GitHub";
  return "this connection";
}

function errorMessage(error: string, provider: string): string {
  const label = providerLabel(provider);
  if (error === "not_linked") return `You haven't signed up with ${label}. Sign up first using one of these connections.`;
  if (error === "email_exists") return `An account with that email already exists. Log in and connect ${label} from Settings.`;
  if (error === "provider_unavailable") return `${label} sign-in isn't available right now.`;
  if (error === "expired" || error === "invalid_state") return "That sign-in link expired. Please try again.";
  return "Sign-in failed. Please try again.";
}

function OAuthCallbackPage(): JSX.Element {
  const params = useMemo(() => parseHash(), []);
  const token = params.get("token");
  const challenge = params.get("challenge");
  const linked = params.get("linked");
  const error = params.get("error");
  const provider = params.get("provider") ?? "";

  const role = useContext(RoleContext);
  const { adoptSession, completeTwoFactor } = useAuth();
  const navigate = useNavigate();

  const [destination, setDestination] = useState<"home" | "settings" | null>(null);
  const [code, setCode] = useState("");
  const [codeInvalid, setCodeInvalid] = useState(false);
  const [verifying, setVerifying] = useState(false);

  useEffect(() => {
    if (token !== null) {
      setToken(token);
      adoptSession();
      UpdateRole(role, getRoles());
      clearCampaignAttribution();
      window.history.replaceState(null, "", window.location.pathname);
      setDestination("home");
    } else if (linked !== null) {
      setDestination("settings");
    }
  }, [token, linked, adoptSession, role]);

  if (destination === "home") return <Navigate to="/" replace />;
  if (destination === "settings") return <Navigate to="/settings" replace />;

  async function handleVerify(e: FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault();
    if (challenge === null || code.trim().length === 0) return;
    setCodeInvalid(false);
    setVerifying(true);
    try {
      await completeTwoFactor(challenge, code.trim());
      UpdateRole(role, getRoles());
      setDestination("home");
    } catch {
      setCodeInvalid(true);
    } finally {
      setVerifying(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-page__bg" />
      <div className="auth-page__card">
        <div className="login-form__header">
          <div className="login-form__logo-wrap">
            <img src={logo} alt="OpenPRA" className="login-form__logo-img" />
          </div>

          {token !== null || linked !== null ? (
            <>
              <h1 className="login-form__title">Signing you in…</h1>
              <p className="login-form__subtitle">One moment.</p>
            </>
          ) : challenge !== null ? (
            <>
              <h1 className="login-form__title">Two-step verification</h1>
              <p className="login-form__subtitle">Enter the code from your authenticator app</p>
            </>
          ) : (
            <>
              <h1 className="login-form__title">Couldn't sign in</h1>
              <p className="login-form__subtitle">{errorMessage(error ?? "oauth_failed", provider)}</p>
            </>
          )}
        </div>

        {challenge !== null && (
          <form onSubmit={(e) => { void handleVerify(e); }} noValidate>
            <div className="login-form__field">
              <label className="login-form__label" htmlFor="oauth-2fa-code">Authentication code</label>
              <input
                id="oauth-2fa-code"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                value={code}
                onChange={(e) => { setCode(e.target.value); if (codeInvalid) setCodeInvalid(false); }}
                className={`login-form__input${codeInvalid ? " login-form__input--error" : ""}`}
                autoFocus
              />
              <p className="login-form__hint">6-digit code, or one of your backup codes</p>
            </div>
            {codeInvalid && <p className="login-form__invalid-msg">Invalid authentication code</p>}
            <button type="submit" className="login-form__submit-btn" disabled={verifying || code.trim().length === 0}>
              {verifying ? "Verifying…" : "Verify"}
            </button>
          </form>
        )}

        {token === null && linked === null && challenge === null && (
          <button type="button" className="login-form__submit-btn" onClick={() => { navigate("/auth", { replace: true }); }}>
            Back to sign in
          </button>
        )}
      </div>
    </div>
  );
}

export { OAuthCallbackPage };
