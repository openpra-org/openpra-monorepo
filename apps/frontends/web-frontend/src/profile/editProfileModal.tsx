import { JSX, useEffect, useMemo, useRef, useState, FormEvent } from "react";
import {
  type UpdateUserProfileRequest,
  type UserProfile,
  UpdateUserProfileRequestSchema,
} from "interfaces-shared-types";
import { CloseIcon, TrashIcon } from "../welcome/icons";
import "./css/editProfileModal.css";

const FIELD_KEYS = ["fullName", "title", "organization", "bio", "altEmail", "phone", "linkedin"] as const;
type FieldKey = (typeof FIELD_KEYS)[number];
type FieldErrors = Partial<Record<FieldKey, string>>;

const ALLOWED_MIME_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);
const AVATAR_MAX_BYTES = 5 * 1024 * 1024;
const COVER_MAX_BYTES = 10 * 1024 * 1024;
const ACCEPT = "image/png,image/jpeg,image/webp";

interface EditProfilePayload {
  text: UpdateUserProfileRequest | null;
  avatarFile: File | null;
  removeAvatar: boolean;
  coverFile: File | null;
  removeCover: boolean;
}

function isAllowedMime(type: string): boolean {
  return ALLOWED_MIME_TYPES.has(type);
}

function formatBytes(n: number): string {
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function diffTextFields(profile: UserProfile, current: Record<FieldKey, string>): Record<string, string> {
  const out: Record<string, string> = {};
  if (current.fullName !== profile.fullName) out.fullName = current.fullName;
  if (current.title !== profile.title) out.title = current.title;
  if (current.organization !== profile.organization) out.organization = current.organization;
  if (current.bio !== profile.bio) out.bio = current.bio;
  if (current.altEmail !== profile.altEmail) out.altEmail = current.altEmail;
  if (current.phone !== profile.phone) out.phone = current.phone;
  if (current.linkedin !== profile.linkedin) out.linkedin = current.linkedin;
  return out;
}

function EditProfileModal({
  profile,
  onCancel,
  onSubmit,
  pending,
}: {
  profile: UserProfile;
  onCancel: () => void;
  onSubmit: (payload: EditProfilePayload) => void;
  pending: boolean;
}): JSX.Element {
  const [fullName, setFullName] = useState(profile.fullName);
  const [title, setTitle] = useState(profile.title);
  const [organization, setOrganization] = useState(profile.organization);
  const [bio, setBio] = useState(profile.bio);
  const [altEmail, setAltEmail] = useState(profile.altEmail);
  const [phone, setPhone] = useState(profile.phone);
  const [linkedin, setLinkedin] = useState(profile.linkedin);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [removeAvatar, setRemoveAvatar] = useState(false);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [removeCover, setRemoveCover] = useState(false);
  const [avatarError, setAvatarError] = useState("");
  const [coverError, setCoverError] = useState("");
  const nameRef = useRef<HTMLInputElement | null>(null);
  const avatarInputRef = useRef<HTMLInputElement | null>(null);
  const coverInputRef = useRef<HTMLInputElement | null>(null);

  const avatarPreviewUrl = useMemo(() => (avatarFile === null ? null : URL.createObjectURL(avatarFile)), [avatarFile]);
  const coverPreviewUrl = useMemo(() => (coverFile === null ? null : URL.createObjectURL(coverFile)), [coverFile]);

  useEffect(() => {
    return () => { if (avatarPreviewUrl !== null) URL.revokeObjectURL(avatarPreviewUrl); };
  }, [avatarPreviewUrl]);

  useEffect(() => {
    return () => { if (coverPreviewUrl !== null) URL.revokeObjectURL(coverPreviewUrl); };
  }, [coverPreviewUrl]);

  useEffect(() => {
    const id = window.setTimeout(() => { nameRef.current?.focus(); }, 50);
    return () => { window.clearTimeout(id); };
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent): void {
      if (e.key === "Escape" && !pending) onCancel();
    }
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("keydown", onKey); };
  }, [onCancel, pending]);

  function pickAvatar(e: React.ChangeEvent<HTMLInputElement>): void {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!isAllowedMime(file.type)) {
      setAvatarError("Only PNG, JPEG, or WebP images are allowed");
      e.target.value = "";
      return;
    }
    if (file.size > AVATAR_MAX_BYTES) {
      setAvatarError(`Avatar must be ${formatBytes(AVATAR_MAX_BYTES)} or smaller`);
      e.target.value = "";
      return;
    }
    setAvatarError("");
    setAvatarFile(file);
    setRemoveAvatar(false);
  }

  function pickCover(e: React.ChangeEvent<HTMLInputElement>): void {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!isAllowedMime(file.type)) {
      setCoverError("Only PNG, JPEG, or WebP images are allowed");
      e.target.value = "";
      return;
    }
    if (file.size > COVER_MAX_BYTES) {
      setCoverError(`Cover must be ${formatBytes(COVER_MAX_BYTES)} or smaller`);
      e.target.value = "";
      return;
    }
    setCoverError("");
    setCoverFile(file);
    setRemoveCover(false);
  }

  function markAvatarRemoval(): void {
    setAvatarFile(null);
    setAvatarError("");
    if (avatarInputRef.current) avatarInputRef.current.value = "";
    setRemoveAvatar(true);
  }

  function markCoverRemoval(): void {
    setCoverFile(null);
    setCoverError("");
    if (coverInputRef.current) coverInputRef.current.value = "";
    setRemoveCover(true);
  }

  function submit(e: FormEvent<HTMLFormElement>): void {
    e.preventDefault();
    const current = {
      fullName: fullName.trim(),
      title: title.trim(),
      organization: organization.trim(),
      bio: bio.trim(),
      altEmail: altEmail.trim(),
      phone: phone.trim(),
      linkedin: linkedin.trim(),
    };
    const diff = diffTextFields(profile, current);
    const hasPhotoChange = avatarFile !== null || removeAvatar || coverFile !== null || removeCover;
    if (Object.keys(diff).length === 0 && !hasPhotoChange) {
      onCancel();
      return;
    }
    let text: UpdateUserProfileRequest | null = null;
    if (Object.keys(diff).length > 0) {
      const parsed = UpdateUserProfileRequestSchema.safeParse(diff);
      if (!parsed.success) {
        const next: FieldErrors = {};
        for (const issue of parsed.error.issues) {
          const key = issue.path[0] as FieldKey;
          if (!next[key]) next[key] = issue.message;
        }
        setErrors(next);
        return;
      }
      text = parsed.data;
    }
    setErrors({});
    onSubmit({ text, avatarFile, removeAvatar, coverFile, removeCover });
  }

  const bioLen = bio.length;
  const avatarSrc = avatarPreviewUrl ?? (removeAvatar ? null : profile.avatarUrl);
  const coverSrc = coverPreviewUrl ?? (removeCover ? null : profile.coverUrl);

  return (
    <div
      className="modal__backdrop"
      onClick={(e) => { if (e.target === e.currentTarget && !pending) onCancel(); }}
    >
      <div className="modal modal--lg" role="dialog" aria-modal="true" aria-labelledby="ep-modal-title">
        <div className="modal__head">
          <div>
            <h2 className="modal__title" id="ep-modal-title">Edit profile</h2>
            <p className="modal__sub">
              Update your identity and contact information.
            </p>
          </div>
          <button
            type="button"
            className="modal__close"
            onClick={onCancel}
            aria-label="Close"
            disabled={pending}
          >
            <CloseIcon />
          </button>
        </div>
        <form onSubmit={submit} noValidate>
          <div className="modal__body">
            <div className="pf__edit-section">
              <h3 className="pf__edit-section-title">Photos</h3>

              <div className="pf__edit-photo">
                <div className="pf__edit-photo-label">Avatar</div>
                <div className="pf__edit-photo-row">
                  <span className="pf__edit-avatar-preview">
                    {avatarSrc !== null
                      ? <img src={avatarSrc} alt="Avatar preview" />
                      : <span className="pf__edit-avatar-fallback">{profile.initials}</span>}
                  </span>
                  <div className="pf__edit-photo-actions">
                    <input
                      ref={avatarInputRef}
                      id="ep-avatar"
                      type="file"
                      accept={ACCEPT}
                      onChange={pickAvatar}
                      className="pf__edit-photo-input"
                      disabled={pending}
                    />
                    <label htmlFor="ep-avatar" className="btn btn--ghost btn--sm">
                      Upload avatar
                    </label>
                    {(profile.avatarUrl !== null || avatarFile !== null) && !removeAvatar && (
                      <button
                        type="button"
                        className="btn btn--ghost btn--sm pf__edit-photo-remove"
                        onClick={markAvatarRemoval}
                        disabled={pending}
                      >
                        <TrashIcon /> Remove
                      </button>
                    )}
                    <div className="pf__edit-photo-hint">PNG, JPEG, or WebP. Up to 5&nbsp;MB.</div>
                    {avatarError && <div className="field__error">{avatarError}</div>}
                  </div>
                </div>
              </div>

              <div className="pf__edit-photo">
                <div className="pf__edit-photo-label">Cover</div>
                <div className="pf__edit-photo-row pf__edit-photo-row--stack">
                  <span className="pf__edit-cover-preview">
                    {coverSrc !== null
                      ? <img src={coverSrc} alt="Cover preview" />
                      : <span className="pf__edit-cover-fallback" />}
                  </span>
                  <div className="pf__edit-photo-actions">
                    <input
                      ref={coverInputRef}
                      id="ep-cover"
                      type="file"
                      accept={ACCEPT}
                      onChange={pickCover}
                      className="pf__edit-photo-input"
                      disabled={pending}
                    />
                    <label htmlFor="ep-cover" className="btn btn--ghost btn--sm">
                      Upload cover
                    </label>
                    {(profile.coverUrl !== null || coverFile !== null) && !removeCover && (
                      <button
                        type="button"
                        className="btn btn--ghost btn--sm pf__edit-photo-remove"
                        onClick={markCoverRemoval}
                        disabled={pending}
                      >
                        <TrashIcon /> Remove
                      </button>
                    )}
                    <div className="pf__edit-photo-hint">PNG, JPEG, or WebP. Up to 10&nbsp;MB.</div>
                    {coverError && <div className="field__error">{coverError}</div>}
                  </div>
                </div>
              </div>
            </div>

            <div className="pf__edit-section">
              <h3 className="pf__edit-section-title">Identity</h3>
              <div className="field">
                <label className="field__label" htmlFor="ep-name">Name</label>
                <input
                  ref={nameRef}
                  id="ep-name"
                  type="text"
                  value={fullName}
                  onChange={(e) => { setFullName(e.target.value); }}
                  className={`field__input${errors.fullName ? " field__input--error" : ""}`}
                  autoComplete="name"
                  disabled={pending}
                />
                {errors.fullName && <div className="field__error">{errors.fullName}</div>}
              </div>
              <div className="pf__edit-grid">
                <div className="field">
                  <label className="field__label" htmlFor="ep-title">Title</label>
                  <input
                    id="ep-title"
                    type="text"
                    value={title}
                    onChange={(e) => { setTitle(e.target.value); }}
                    className="field__input"
                    placeholder="PhD Candidate"
                    disabled={pending}
                  />
                </div>
                <div className="field">
                  <label className="field__label" htmlFor="ep-org">Organization</label>
                  <input
                    id="ep-org"
                    type="text"
                    value={organization}
                    onChange={(e) => { setOrganization(e.target.value); }}
                    className="field__input"
                    placeholder="NC State University"
                    disabled={pending}
                  />
                </div>
              </div>
              <div className="field">
                <label className="field__label" htmlFor="ep-bio">Bio</label>
                <textarea
                  id="ep-bio"
                  value={bio}
                  onChange={(e) => { setBio(e.target.value.slice(0, 400)); }}
                  className={`field__input field__input--textarea${errors.bio ? " field__input--error" : ""}`}
                  placeholder="A short bio so collaborators know what you work on…"
                  disabled={pending}
                />
                <div className="pf__char-count">{bioLen} / 400</div>
                {errors.bio && <div className="field__error">{errors.bio}</div>}
              </div>
            </div>

            <div className="pf__edit-section">
              <h3 className="pf__edit-section-title">Contact</h3>
              <div className="field">
                <label className="field__label" htmlFor="ep-primary-email">Primary email</label>
                <div className="field__hint">
                  Locked here — this is your sign-in identity.
                </div>
                <input
                  id="ep-primary-email"
                  type="email"
                  value={profile.email}
                  className="field__input field__input--locked"
                  readOnly
                  disabled
                />
              </div>
              <div className="pf__edit-grid">
                <div className="field">
                  <label className="field__label" htmlFor="ep-alt-email">Alternate email</label>
                  <input
                    id="ep-alt-email"
                    type="email"
                    value={altEmail}
                    onChange={(e) => { setAltEmail(e.target.value); }}
                    className={`field__input${errors.altEmail ? " field__input--error" : ""}`}
                    autoComplete="email"
                    disabled={pending}
                  />
                  {errors.altEmail && <div className="field__error">{errors.altEmail}</div>}
                </div>
                <div className="field">
                  <label className="field__label" htmlFor="ep-phone">Phone</label>
                  <input
                    id="ep-phone"
                    type="tel"
                    value={phone}
                    onChange={(e) => { setPhone(e.target.value); }}
                    className="field__input"
                    autoComplete="tel"
                    disabled={pending}
                  />
                </div>
              </div>
              <div className="field">
                <label className="field__label" htmlFor="ep-linkedin">LinkedIn</label>
                <input
                  id="ep-linkedin"
                  type="url"
                  value={linkedin}
                  onChange={(e) => { setLinkedin(e.target.value); }}
                  className="field__input"
                  placeholder="https://www.linkedin.com/in/you"
                  disabled={pending}
                />
              </div>
            </div>
          </div>
          <div className="modal__foot">
            <button type="button" className="btn btn--ghost" onClick={onCancel} disabled={pending}>
              Cancel
            </button>
            <button type="submit" className="btn btn--primary" disabled={pending}>
              {pending ? "Saving…" : "Save changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export { EditProfileModal };
export type { EditProfilePayload };
