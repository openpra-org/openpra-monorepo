import { JSX } from "react";
import { type UserProfile } from "interfaces-shared-types";
import { EditIcon, LinkedinIcon, MailIcon, PhoneIcon } from "../welcome/icons";
import "./css/contactSection.css";

interface ContactRowProps {
  icon: JSX.Element;
  label: string;
  value: string | null;
  caption?: string;
  placeholder: string;
}

function ContactRow({ icon, label, value, caption, placeholder }: ContactRowProps): JSX.Element {
  const hasValue = value !== null && value.trim() !== "";
  return (
    <div className="pf__row">
      <span className="pf__row-icon">{icon}</span>
      <div className="pf__row-body">
        <div className="pf__row-label">
          {label}
          {caption !== undefined && <span className="pf__locked">{caption}</span>}
        </div>
        <div className="pf__row-value">
          {hasValue ? value : <span className="pf__empty">{placeholder}</span>}
        </div>
      </div>
    </div>
  );
}

function ContactSection({
  profile,
  onEdit,
}: {
  profile: UserProfile;
  onEdit: () => void;
}): JSX.Element {
  return (
    <section className="pf__section">
      <div className="pf__section-h">
        <div>
          <h2 className="pf__section-title">Contact information</h2>
          <p className="pf__section-sub">
            How collaborators can reach you. Sign-in email is set during signup.
          </p>
        </div>
        <button type="button" className="pf__edit-btn" onClick={onEdit}>
          <EditIcon /> Edit
        </button>
      </div>
      <div className="pf__rows">
        <ContactRow
          icon={<MailIcon />}
          label="Primary email"
          caption="Sign-in identity"
          value={profile.email}
          placeholder=""
        />
        <ContactRow
          icon={<MailIcon />}
          label="Alternate email"
          value={profile.altEmail}
          placeholder="Add an alternate email"
        />
        <ContactRow
          icon={<PhoneIcon />}
          label="Phone"
          value={profile.phone}
          placeholder="Add a phone number"
        />
        <ContactRow
          icon={<LinkedinIcon />}
          label="LinkedIn"
          value={profile.linkedin}
          placeholder="Add a LinkedIn profile URL"
        />
      </div>
    </section>
  );
}

export { ContactSection };
