import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { OpenPraBrand } from "../design-system/OpenPraBrand";
import { registerCampaignOpen } from "./analytics";
import "./campaignLandingPage.css";

function CampaignLandingPage(): JSX.Element {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (token === undefined) { setError("This invitation link is invalid."); return; }
    let cancelled = false;
    registerCampaignOpen(token)
      .then((campaign) => {
        if (!cancelled) window.setTimeout(() => { navigate(campaign.destinationPath, { replace: true }); }, 650);
      })
      .catch((reason: unknown) => { if (!cancelled) setError((reason as { message?: string }).message ?? "This invitation link is unavailable."); });
    return () => { cancelled = true; };
  }, [navigate, token]);

  return (
    <main className="campaign-landing">
      <section className="campaign-landing__card">
        <OpenPraBrand variant="tagline" surface="light" className="campaign-landing__brand" />
        {error === null ? (
          <>
            <div className="campaign-landing__spinner" aria-hidden="true" />
            <h1>Opening your invitation</h1>
            <p>Preparing a secure path into OpenPRA…</p>
          </>
        ) : (
          <>
            <h1>Invitation unavailable</h1>
            <p>{error}</p>
            <button type="button" onClick={() => { navigate("/auth", { replace: true }); }}>Go to sign in</button>
          </>
        )}
      </section>
    </main>
  );
}

export { CampaignLandingPage };
