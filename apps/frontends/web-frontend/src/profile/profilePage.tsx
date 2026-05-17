import { JSX, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  type CreateTeamRequest,
  type MyProfileResponse,
  type Team,
  type UpdateUserProfileRequest,
  type UserProfile,
} from "interfaces-shared-types";
import { useToast } from "../toast/toastProvider";
import { TopBar } from "../welcome/topBar";
import { ArrowLeftIcon } from "../welcome/icons";
import { getMyProfile, updateMyProfile } from "../users/userApi";
import { createTeam, getMyTeams, leaveTeam } from "../teams/teamsApi";
import { ProfileHeader } from "./profileHeader";
import { StatsStrip } from "./statsStrip";
import { ContactSection } from "./contactSection";
import { TeamsSection } from "./teamsSection";
import { ApiKeysSection } from "./apiKeysSection";
import { EditProfileModal } from "./editProfileModal";
import { CreateTeamModal } from "./createTeamModal";
import { JoinTeamModal } from "./joinTeamModal";
import { ConfirmLeaveModal } from "./confirmLeaveModal";
import "./css/profilePage.css";

function ProfilePage(): JSX.Element {
  const [data, setData] = useState<MyProfileResponse | null>(null);
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [createTeamOpen, setCreateTeamOpen] = useState(false);
  const [joinTeamOpen, setJoinTeamOpen] = useState(false);
  const [leaveTarget, setLeaveTarget] = useState<Team | null>(null);
  const [mutating, setMutating] = useState(false);

  const { addToast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    let cancelled = false;
    Promise.all([getMyProfile(), getMyTeams()])
      .then(([profileRes, teamsRes]) => {
        if (cancelled) return;
        setData(profileRes);
        setTeams(teamsRes.teams);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setLoadError((err as { message?: string }).message ?? "Could not load profile");
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  function flashSuccess(msg: string): void {
    addToast({ id: crypto.randomUUID(), type: "success", message: msg });
  }

  function flashError(msg: string): void {
    addToast({ id: crypto.randomUUID(), type: "danger", message: msg });
  }

  function comingSoon(label: string): void {
    addToast({ id: crypto.randomUUID(), type: "info", message: `${label} — coming soon` });
  }

  function handleEditSubmit(payload: UpdateUserProfileRequest): void {
    setMutating(true);
    updateMyProfile(payload)
      .then((res) => {
        setData(res);
        setEditOpen(false);
        flashSuccess("Profile updated");
      })
      .catch((err: unknown) => {
        flashError((err as { message?: string }).message ?? "Could not save profile");
      })
      .finally(() => { setMutating(false); });
  }

  function handleCreateTeamSubmit(payload: CreateTeamRequest): void {
    setMutating(true);
    createTeam(payload)
      .then((team) => {
        setTeams((prev) => [team, ...prev]);
        setCreateTeamOpen(false);
        flashSuccess(`Created "${team.name}"`);
      })
      .catch((err: unknown) => {
        flashError((err as { message?: string }).message ?? "Could not create team");
      })
      .finally(() => { setMutating(false); });
  }

  function handleJoinSuccess(team: Team): void {
    setTeams((prev) => {
      const existing = prev.findIndex((t) => t.id === team.id);
      if (existing >= 0) {
        const next = prev.slice();
        next[existing] = team;
        return next;
      }
      return [team, ...prev];
    });
    setJoinTeamOpen(false);
    flashSuccess(team.role === "pending" ? `Requested to join "${team.name}"` : `Joined "${team.name}"`);
  }

  function handleLeaveConfirm(): void {
    if (leaveTarget === null) return;
    setMutating(true);
    const target = leaveTarget;
    leaveTeam(target.id)
      .then(() => {
        setTeams((prev) => prev.filter((t) => t.id !== target.id));
        flashSuccess(target.role === "pending" ? "Join request cancelled" : `Left "${target.name}"`);
        setLeaveTarget(null);
      })
      .catch((err: unknown) => {
        flashError((err as { message?: string }).message ?? "Could not leave team");
      })
      .finally(() => { setMutating(false); });
  }

  const profile: UserProfile | null = data?.profile ?? null;
  const projectCount = data?.projectCount ?? 0;

  return (
    <div className="wp wp--compact ap pf">
      <div className="wp__bg" />
      <TopBar />
      <main className="wp__main pf__main">
        <button type="button" className="ap__back pf__back" onClick={() => { navigate("/"); }}>
          <ArrowLeftIcon /> Welcome
        </button>

        {loadError && <p className="pf__load-error">{loadError}</p>}

        {!loading && !loadError && profile !== null && (
          <>
            <ProfileHeader profile={profile} onEdit={() => { setEditOpen(true); }} />
            <StatsStrip memberSince={profile.memberSince} projectCount={projectCount} />
            <ContactSection profile={profile} onEdit={() => { setEditOpen(true); }} />
            <TeamsSection
              teams={teams}
              onJoin={() => { setJoinTeamOpen(true); }}
              onCreate={() => { setCreateTeamOpen(true); }}
              onLeave={(team) => { setLeaveTarget(team); }}
            />
            <ApiKeysSection onAdd={() => { comingSoon("AI provider keys"); }} />
          </>
        )}
      </main>

      {editOpen && profile !== null && (
        <EditProfileModal
          profile={profile}
          onCancel={() => { if (!mutating) setEditOpen(false); }}
          onSubmit={handleEditSubmit}
          pending={mutating}
        />
      )}

      {createTeamOpen && (
        <CreateTeamModal
          onCancel={() => { if (!mutating) setCreateTeamOpen(false); }}
          onSubmit={handleCreateTeamSubmit}
          pending={mutating}
        />
      )}

      {joinTeamOpen && (
        <JoinTeamModal
          onClose={() => { setJoinTeamOpen(false); }}
          onJoin={handleJoinSuccess}
          onError={flashError}
        />
      )}

      {leaveTarget !== null && (
        <ConfirmLeaveModal
          team={leaveTarget}
          onCancel={() => { if (!mutating) setLeaveTarget(null); }}
          onConfirm={handleLeaveConfirm}
          pending={mutating}
        />
      )}
    </div>
  );
}

export { ProfilePage };
