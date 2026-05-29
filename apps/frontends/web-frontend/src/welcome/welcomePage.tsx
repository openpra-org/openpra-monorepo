import { JSX, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { type Project } from "interfaces-shared-types";
import { useToast } from "../toast/toastProvider";
import { getRecentProject, getSharedProjects } from "../projects/projectApi";
import { TopBar } from "./topBar";
import { RecentProjectCard } from "./recentProjectCard";
import { NewProjectCard } from "./newProjectCard";
import { NewProjectModal } from "./newProjectModal";
import { SharedProjectCard } from "./sharedProjectCard";
import { EmptyState } from "./emptyState";
import { PosAwaitingMeSection } from "./posAwaitingMeSection";
import "./css/welcomePage.css";

function WelcomePage(): JSX.Element {
  const [recent, setRecent] = useState<Project | null>(null);
  const [shared, setShared] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const { addToast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    let cancelled = false;
    Promise.all([getRecentProject(), getSharedProjects()])
      .then(([r, s]) => {
        if (cancelled) return;
        setRecent(r.project);
        setShared(s.projects);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        const message = (err as { message?: string }).message ?? "Could not load projects";
        setLoadError(message);
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);


  function handleCreated(project: Project): void {
    setRecent(project);
    setModalOpen(false);
    addToast({ id: crypto.randomUUID(), type: "success", message: `Project "${project.name}" created` });
  }

  function handleCreateError(message: string): void {
    addToast({ id: crypto.randomUUID(), type: "danger", message });
  }

  const isEmpty = !loading && recent === null && shared.length === 0;
  const hasShared = shared.length > 0;

  return (
    <div className="wp wp--compact">
      <div className="wp__bg" />
      <TopBar />
      <main className="wp__main">
        <div className="wp__intro">
          <h1 className="wp__intro-line">
            {isEmpty ? "Let's start your first analysis." : "Pick up where you left off."}
          </h1>
          {!isEmpty && <p className="wp__intro-sub">Or start a new analysis.</p>}
        </div>

        {loadError && <p className="wp__load-error">{loadError}</p>}

        {!loading && !loadError && (
          isEmpty ? (
            <EmptyState onCreate={() => { setModalOpen(true); }} />
          ) : (
            <>
              <section className="wp__hero" aria-label="Continue or start a project">
                {recent !== null && (
                  <RecentProjectCard
                    project={recent}
                    onContinue={() => { navigate(`/projects/${recent.id}`); }}
                    onViewAll={() => { navigate("/projects"); }}
                  />
                )}
                <NewProjectCard onClick={() => { setModalOpen(true); }} />
              </section>

              <PosAwaitingMeSection />

              {hasShared && (
                <section className="wp__section" aria-label="Shared with you">
                  <div className="wp__section-h">
                    <h2>Shared with you</h2>
                    <span className="wp__section-h-meta">{shared.length} projects</span>
                  </div>
                  <div className="shared">
                    {shared.map((p) => (
                      <SharedProjectCard
                        key={p.id}
                        project={p}
                        onOpen={() => { navigate(`/projects/${p.id}`); }}
                      />
                    ))}
                  </div>
                </section>
              )}
            </>
          )
        )}
      </main>

      {modalOpen && (
        <NewProjectModal
          onClose={() => { setModalOpen(false); }}
          onCreated={handleCreated}
          onError={handleCreateError}
        />
      )}
    </div>
  );
}

export { WelcomePage };
