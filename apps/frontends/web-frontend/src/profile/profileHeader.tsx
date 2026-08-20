import { JSX } from "react";
import { type UserProfile } from "interfaces-shared-types";
import { EditIcon } from "../welcome/icons";
import "./css/profileHeader.css";

function ProfileHeader({
  profile,
  onEdit,
}: {
  profile: UserProfile;
  onEdit: () => void;
}): JSX.Element {
  const titleAndOrg: string[] = [];
  if (profile.title) titleAndOrg.push(profile.title);
  if (profile.organization) titleAndOrg.push(profile.organization);

  return (
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
            <button type="button" className="pf__edit-btn" onClick={onEdit}>
              <EditIcon /> Edit profile
            </button>
          </div>
          <div className="pf__title-row">
            {titleAndOrg.length === 0 ? (
              <span className="pf__empty">Add a title and organization</span>
            ) : (
              titleAndOrg.map((part, i) => (
                <span key={part}>
                  {i > 0 && <span className="pf__sep">·</span>} <span>{part}</span>
                </span>
              ))
            )}
          </div>
          <p className="pf__bio">
            {profile.bio || (
              <span className="pf__empty">Add a short bio so collaborators know what you work on…</span>
            )}
          </p>
        </div>
      </div>
    </div>
  );
}

export { ProfileHeader };
