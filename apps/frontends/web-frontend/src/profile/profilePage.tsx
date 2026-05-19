import { JSX, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  type CreateTeamRequest,
  type MyProfileResponse,
  type Team,
  type UpdateTeamRequest,
  type UserProfile,
} from "interfaces-shared-types";
import { useToast } from "../toast/toastProvider";
import { ArrowLeftIcon } from "../welcome/icons";
import { ThemePicker } from "../welcome/themePicker";
import { useTheme } from "../welcome/useTheme";
import {
  deleteAvatar,
  deleteCover,
  getMyProfile,
  updateMyProfile,
  uploadAvatar,
  uploadCover,
} from "../users/userApi";
import {
  acceptInvite,
  createTeam,
  declineInvite,
  deleteTeam,
  getMyInvitations,
  getMyTeams,
  leaveTeam,
  updateTeam,
} from "../teams/teamsApi";
import { ProfileHeader } from "./profileHeader";
import { StatsStrip } from "./statsStrip";
import { ContactSection } from "./contactSection";
import { TeamsSection } from "./teamsSection";
import { ApiKeysSection } from "./apiKeysSection";
import { InvitationsSection } from "./invitationsSection";
import { EditProfileModal, type EditProfilePayload } from "./editProfileModal";
import { CreateTeamModal } from "./createTeamModal";
import { JoinTeamModal } from "./joinTeamModal";
import { ConfirmLeaveModal } from "./confirmLeaveModal";
import { EditTeamModal } from "./editTeamModal";
import { ConfirmDeleteTeamModal } from "./confirmDeleteTeamModal";
import "./css/profilePage.css";

function ProfilePage(): JSX.Element {
  const [data, setData] = useState<MyProfileResponse | null>(null);
  const [teams, setTeams] = useState<Team[]>([]);
  const [invitations, setInvitations] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [createTeamOpen, setCreateTeamOpen] = useState(false);
  const [joinTeamOpen, setJoinTeamOpen] = useState(false);
  const [leaveTarget, setLeaveTarget] = useState<Team | null>(null);
  const [editTeamTarget, setEditTeamTarget] = useState<Team | null>(null);
  const [deleteTeamTarget, setDeleteTeamTarget] = useState<Team | null>(null);
  const [invitationBusyId, setInvitationBusyId] = useState<string | null>(null);
  const [mutating, setMutating] = useState(false);

  const { addToast } = useToast();
  const navigate = useNavigate();
  const [theme, setTheme] = useTheme();

  useEffect(() => {
    let cancelled = false;
    Promise.all([getMyProfile(), getMyTeams(), getMyInvitations()])
      .then(([profileRes, teamsRes, invRes]) => {
        if (cancelled) return;
        setData(profileRes);
        setTeams(teamsRes.teams);
        setInvitations(invRes.teams);
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

  async function handleEditSubmit(payload: EditProfilePayload): Promise<void> {
    setMutating(true);
    try {
      let nextProfile: UserProfile | null = null;
      if (payload.avatarFile !== null) {
        nextProfile = await uploadAvatar(payload.avatarFile);
      } else if (payload.removeAvatar) {
        nextProfile = await deleteAvatar();
      }
      if (payload.coverFile !== null) {
        nextProfile = await uploadCover(payload.coverFile);
      } else if (payload.removeCover) {
        nextProfile = await deleteCover();
      }
      if (payload.text !== null) {
        const res = await updateMyProfile(payload.text);
        setData(res);
      } else if (nextProfile !== null) {
        setData((prev) => prev === null ? prev : { ...prev, profile: nextProfile! });
      }
      setEditOpen(false);
      flashSuccess("Profile updated");
    } catch (err: unknown) {
      flashError((err as { message?: string }).message ?? "Could not save profile");
    } finally {
      setMutating(false);
    }
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
    flashSuccess(`Joined "${team.name}"`);
  }

  function handleLeaveConfirm(): void {
    if (leaveTarget === null) return;
    setMutating(true);
    const target = leaveTarget;
    leaveTeam(target.id)
      .then(() => {
        setTeams((prev) => prev.filter((t) => t.id !== target.id));
        flashSuccess(`Left "${target.name}"`);
        setLeaveTarget(null);
      })
      .catch((err: unknown) => {
        flashError((err as { message?: string }).message ?? "Could not leave team");
      })
      .finally(() => { setMutating(false); });
  }

  function handleTeamUpdated(updated: Team): void {
    setTeams((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
  }

  function handleEditTeamSubmit(payload: UpdateTeamRequest): void {
    if (editTeamTarget === null) return;
    setMutating(true);
    updateTeam(editTeamTarget.id, payload)
      .then((updated) => {
        handleTeamUpdated(updated);
        setEditTeamTarget(null);
        flashSuccess("Team updated");
      })
      .catch((err: unknown) => {
        flashError((err as { message?: string }).message ?? "Could not update team");
      })
      .finally(() => { setMutating(false); });
  }

  function handleDeleteTeamConfirm(): void {
    if (deleteTeamTarget === null) return;
    setMutating(true);
    const target = deleteTeamTarget;
    deleteTeam(target.id)
      .then(() => {
        setTeams((prev) => prev.filter((t) => t.id !== target.id));
        setDeleteTeamTarget(null);
        flashSuccess(`Deleted "${target.name}"`);
      })
      .catch((err: unknown) => {
        flashError((err as { message?: string }).message ?? "Could not delete team");
      })
      .finally(() => { setMutating(false); });
  }

  function handleAcceptInvitation(team: Team): void {
    setInvitationBusyId(team.id);
    acceptInvite(team.id)
      .then((joined) => {
        setInvitations((prev) => prev.filter((t) => t.id !== team.id));
        setTeams((prev) => {
          const idx = prev.findIndex((t) => t.id === joined.id);
          if (idx >= 0) {
            const next = prev.slice();
            next[idx] = joined;
            return next;
          }
          return [joined, ...prev];
        });
        flashSuccess(`Joined "${joined.name}"`);
      })
      .catch((err: unknown) => {
        flashError((err as { message?: string }).message ?? "Could not accept invitation");
      })
      .finally(() => { setInvitationBusyId(null); });
  }

  function handleDeclineInvitation(team: Team): void {
    setInvitationBusyId(team.id);
    declineInvite(team.id)
      .then(() => {
        setInvitations((prev) => prev.filter((t) => t.id !== team.id));
        flashSuccess(`Declined invitation to "${team.name}"`);
      })
      .catch((err: unknown) => {
        flashError((err as { message?: string }).message ?? "Could not decline invitation");
      })
      .finally(() => { setInvitationBusyId(null); });
  }

  const profile: UserProfile | null = data?.profile ?? null;
  const projectCount = data?.projectCount ?? 0;

  return (
    <div className="wp wp--compact ap pf">
      <div className="wp__bg" />
      <main className="wp__main pf__main">
        <div className="pf__topline">
          <button type="button" className="ap__back pf__back" onClick={() => { navigate("/"); }}>
            <ArrowLeftIcon /> Welcome
          </button>
          <ThemePicker theme={theme} setTheme={setTheme} />
        </div>

        {loadError && <p className="pf__load-error">{loadError}</p>}

        {!loading && !loadError && profile !== null && (
          <>
            <ProfileHeader profile={profile} onEdit={() => { setEditOpen(true); }} />
            <StatsStrip memberSince={profile.memberSince} projectCount={projectCount} />
            <InvitationsSection
              invitations={invitations}
              busyId={invitationBusyId}
              onAccept={handleAcceptInvitation}
              onDecline={handleDeclineInvitation}
            />
            <ContactSection profile={profile} onEdit={() => { setEditOpen(true); }} />
            <TeamsSection
              teams={teams}
              onJoin={() => { setJoinTeamOpen(true); }}
              onCreate={() => { setCreateTeamOpen(true); }}
              onLeave={(team) => { setLeaveTarget(team); }}
              onTeamUpdated={handleTeamUpdated}
              onEdit={(team) => { setEditTeamTarget(team); }}
              onDelete={(team) => { setDeleteTeamTarget(team); }}
              onError={flashError}
              onSuccess={flashSuccess}
            />
            <ApiKeysSection onAdd={() => { comingSoon("AI provider keys"); }} />
          </>
        )}
      </main>

      {editOpen && profile !== null && (
        <EditProfileModal
          profile={profile}
          onCancel={() => { if (!mutating) setEditOpen(false); }}
          onSubmit={(p) => { void handleEditSubmit(p); }}
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

      {editTeamTarget !== null && (
        <EditTeamModal
          team={editTeamTarget}
          onCancel={() => { if (!mutating) setEditTeamTarget(null); }}
          onSubmit={handleEditTeamSubmit}
          pending={mutating}
        />
      )}

      {deleteTeamTarget !== null && (
        <ConfirmDeleteTeamModal
          team={deleteTeamTarget}
          onCancel={() => { if (!mutating) setDeleteTeamTarget(null); }}
          onConfirm={handleDeleteTeamConfirm}
          pending={mutating}
        />
      )}
    </div>
  );
}

export { ProfilePage };
