import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { type UserProfile } from "interfaces-shared-types";
import { EditProfileModal } from "../editProfileModal";

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

describe("EditProfileModal", () => {
  it("pre-fills inputs with the current profile values", () => {
    render(
      <EditProfileModal
        profile={makeProfile({ title: "PhD Candidate", bio: "Researching PRA" })}
        onCancel={() => undefined}
        onSubmit={() => undefined}
        pending={false}
      />,
    );
    expect((screen.getByRole("textbox", { name: /^name$/i }) as HTMLInputElement).value).toBe("Ada Lovelace");
    expect((screen.getByRole("textbox", { name: /^title$/i }) as HTMLInputElement).value).toBe("PhD Candidate");
    expect((screen.getByRole("textbox", { name: /^bio$/i }) as HTMLTextAreaElement).value).toBe("Researching PRA");
  });

  it("locks the primary email field", () => {
    render(
      <EditProfileModal
        profile={makeProfile()}
        onCancel={() => undefined}
        onSubmit={() => undefined}
        pending={false}
      />,
    );
    const primary = screen.getByLabelText(/primary email/i) as HTMLInputElement;
    expect(primary.value).toBe("ada@example.com");
    expect(primary).toBeDisabled();
  });

  it("rejects an invalid alternate email", async () => {
    const onSubmit = jest.fn();
    render(
      <EditProfileModal
        profile={makeProfile()}
        onCancel={() => undefined}
        onSubmit={onSubmit}
        pending={false}
      />,
    );
    const alt = screen.getByLabelText(/alternate email/i);
    await userEvent.type(alt, "not-an-email");
    await userEvent.click(screen.getByRole("button", { name: /save changes/i }));
    expect(await screen.findByText(/invalid email format/i)).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("submits trimmed fields when the form is valid", async () => {
    const onSubmit = jest.fn();
    render(
      <EditProfileModal
        profile={makeProfile()}
        onCancel={() => undefined}
        onSubmit={onSubmit}
        pending={false}
      />,
    );
    await waitFor(() => {
      expect(document.activeElement).toBe(screen.getByRole("textbox", { name: /^name$/i }));
    });
    await userEvent.type(screen.getByRole("textbox", { name: /^title$/i }), "PhD Candidate");
    await userEvent.click(screen.getByRole("button", { name: /save changes/i }));
    expect(onSubmit).toHaveBeenCalledTimes(1);
    const payload = onSubmit.mock.calls[0][0] as { text: Record<string, string> | null };
    expect(payload.text?.title).toBe("PhD Candidate");
  });

  it("closes on Escape when not pending", async () => {
    const onCancel = jest.fn();
    render(
      <EditProfileModal
        profile={makeProfile()}
        onCancel={onCancel}
        onSubmit={() => undefined}
        pending={false}
      />,
    );
    await userEvent.keyboard("{Escape}");
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});
