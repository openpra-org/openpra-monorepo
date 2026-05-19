import { JSX, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { type PublicUserProfile } from "interfaces-shared-types";
import { useAuth } from "../auth/AuthContext";
import { useToast } from "../toast/toastProvider";
import { ArrowLeftIcon } from "../welcome/icons";
import { useTheme } from "../welcome/useTheme";
import { ThemePicker } from "../welcome/themePicker";
import { getPublicUser } from "./userApi";
import "./css/userProfilePage.css";

function UserProfilePage(): JSX.Element {
  const params = useParams<{ username: string }>();
  const username = params.username ?? "";
  const navigate = useNavigate();
  const { user } = useAuth();
  const { addToast } = useToast();
  const [theme, setTheme] = useTheme();
  const [profile, setProfile] = useState<PublicUserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (user !== null && user.username === username) {
      navigate("/profile", { replace: true });
      return;
    }
    let cancelled = false;
    setLoading(true);
    getPublicUser(username)
      .then((res) => { if (!cancelled) setProfile(res); })
      .catch((err: unknown) => {
        if (cancelled) return;
        const message = (err as { message?: string }).message ?? "Could not load profile";
        setLoadError(message);
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [username, user, navigate]);

  function flashInfo(label: string): void {
    addToast({ id: crypto.randomUUID(), type: "info", message: `${label} — coming soon` });
  }

  const titleAndOrg: string[] = [];
  if (profile?.title) titleAndOrg.push(profile.title);
  if (profile?.organization) titleAndOrg.push(profile.organization);

  return (
    <div className="wp wp--compact ap pf up">
      <div className="wp__bg" />
      <main className="wp__main pf__main">
        <div className="pf__topline">
          <button type="button" className="ap__back pf__back" onClick={() => { navigate(-1); }}>
            <ArrowLeftIcon /> Back
          </button>
          <ThemePicker theme={theme} setTheme={setTheme} />
        </div>

        {loading && <p className="up__load">Loading profile…</p>}
        {loadError !== null && <p className="up__load-error">{loadError}</p>}

        {!loading && !loadError && profile !== null && (
          <>
            <div className="pf__header">
              <div className="pf__cover">
                {profile.coverUrl !== null
                  ? <img src={profile.coverUrl} alt="" className="pf__cover-img" />
                  : <div className="pf__cover-art" />}
              </div>
              <div className="pf__header-body">
                <div className="pf__avatar-wrap">
                  {profile.avatarUrl !== null
                    ? <img src={profile.avatarUrl} alt={`${profile.fullName} avatar`} className="pf__avatar pf__avatar--img" />
                    : <span className="pf__avatar" aria-hidden="true">{profile.initials}</span>}
                </div>
                <div className="pf__identity">
                  <div className="pf__identity-top">
                    <h1 className="pf__name">{profile.fullName}</h1>
                    <button type="button" className="btn btn--ghost btn--sm" onClick={() => { flashInfo("Message"); }}>
                      Message
                    </button>
                  </div>
                  <div className="pf__title-row">
                    <span className="up__handle">@{profile.username}</span>
                    {titleAndOrg.map((part) => (
                      <span key={part}>
                        <span className="pf__sep">·</span> <span>{part}</span>
                      </span>
                    ))}
                  </div>
                  <p className="pf__bio">
                    {profile.bio || <span className="pf__empty">No bio yet.</span>}
                  </p>
                </div>
              </div>
            </div>

            <section className="pf__section">
              <div className="pf__section-h">
                <div>
                  <h2 className="pf__section-title">About</h2>
                  <p className="pf__section-sub">Member since {profile.memberSince}</p>
                </div>
              </div>
              {profile.linkedin !== "" && (
                <p className="up__link">
                  <a href={profile.linkedin} target="_blank" rel="noreferrer noopener">LinkedIn profile ↗</a>
                </p>
              )}
            </section>
          </>
        )}
      </main>
    </div>
  );
}

export { UserProfilePage };
