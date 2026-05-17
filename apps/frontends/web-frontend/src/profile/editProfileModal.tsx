import { JSX, useEffect, useRef, useState, FormEvent } from "react";
import {
  type UpdateUserProfileRequest,
  type UserProfile,
  UpdateUserProfileRequestSchema,
} from "interfaces-shared-types";
import { CloseIcon } from "../welcome/icons";
import "./css/editProfileModal.css";

const FIELD_KEYS = ["fullName", "title", "organization", "bio", "altEmail", "phone", "linkedin"] as const;
type FieldKey = (typeof FIELD_KEYS)[number];
type FieldErrors = Partial<Record<FieldKey, string>>;

function EditProfileModal({
  profile,
  onCancel,
  onSubmit,
  pending,
}: {
  profile: UserProfile;
  onCancel: () => void;
  onSubmit: (payload: UpdateUserProfileRequest) => void;
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
  const nameRef = useRef<HTMLInputElement | null>(null);

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

  function submit(e: FormEvent<HTMLFormElement>): void {
    e.preventDefault();
    const candidate: Record<string, string> = {
      fullName: fullName.trim(),
      title: title.trim(),
      organization: organization.trim(),
      bio: bio.trim(),
      altEmail: altEmail.trim(),
      phone: phone.trim(),
      linkedin: linkedin.trim(),
    };
    const parsed = UpdateUserProfileRequestSchema.safeParse(candidate);
    if (!parsed.success) {
      const next: FieldErrors = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0] as FieldKey;
        if (!next[key]) next[key] = issue.message;
      }
      setErrors(next);
      return;
    }
    setErrors({});
    onSubmit(parsed.data);
  }

  const bioLen = bio.length;

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
