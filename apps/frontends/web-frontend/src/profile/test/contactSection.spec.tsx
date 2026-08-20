import { render, screen } from "@testing-library/react";
import { type UserProfile } from "interfaces-shared-types";
import { ContactSection } from "../contactSection";

function makeProfile(overrides: Partial<UserProfile> = {}): UserProfile {
  return {
    username: "ada",
    email: "ada@example.com",
    fullName: "Ada Lovelace",
    organization: "OpenPRA",
    title: "",
    bio: "",
    altEmail: "",
    phone: "",
    linkedin: "",
    initials: "AL",
    memberSince: "March 2026",
    twoFactorEnabled: false,
    hasPassword: true,
    connectedAccounts: [],
    ...overrides,
  };
}

describe("ContactSection", () => {
  it("renders the primary email and the 'Sign-in identity' caption", () => {
    render(<ContactSection profile={makeProfile()} onEdit={() => undefined} />);
    expect(screen.getByText("ada@example.com")).toBeInTheDocument();
    expect(screen.getByText(/sign-in identity/i)).toBeInTheDocument();
  });

  it("shows an italic placeholder for empty alternate email + phone + linkedin", () => {
    render(<ContactSection profile={makeProfile()} onEdit={() => undefined} />);
    expect(screen.getByText(/add an alternate email/i)).toBeInTheDocument();
    expect(screen.getByText(/add a phone number/i)).toBeInTheDocument();
    expect(screen.getByText(/add a linkedin profile url/i)).toBeInTheDocument();
  });

  it("renders the alternate email value when set", () => {
    render(<ContactSection profile={makeProfile({ altEmail: "apatel@example.com" })} onEdit={() => undefined} />);
    expect(screen.getByText("apatel@example.com")).toBeInTheDocument();
  });
});
