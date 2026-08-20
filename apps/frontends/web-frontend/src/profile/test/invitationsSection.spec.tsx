import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { type Team } from "interfaces-shared-types";
import { InvitationsSection } from "../invitationsSection";

function makeInvite(overrides: Partial<Team> = {}): Team {
  return {
    id: "t-inv-1",
    name: "Risk Research Group",
    organization: "NC State",
    description: "PRA collaboration",
    visibility: "private",
    adminUsername: "chen",
    memberCount: 3,
    role: "invited",
    avatarUrl: null,
    ...overrides,
  };
}

describe("InvitationsSection", () => {
  it("renders nothing when there are no invitations", () => {
    const { container } = render(
      <InvitationsSection
        invitations={[]}
        busyId={null}
        onAccept={() => undefined}
        onDecline={() => undefined}
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders the invitation header with the correct pluralization", () => {
    render(
      <InvitationsSection
        invitations={[makeInvite(), makeInvite({ id: "t-inv-2", name: "Other Team" })]}
        busyId={null}
        onAccept={() => undefined}
        onDecline={() => undefined}
      />,
    );
    expect(screen.getByText(/2 pending invitations to review/i)).toBeInTheDocument();
  });

  it("invokes onAccept with the team when Accept is clicked", async () => {
    const onAccept = jest.fn();
    render(
      <InvitationsSection
        invitations={[makeInvite()]}
        busyId={null}
        onAccept={onAccept}
        onDecline={() => undefined}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: /accept/i }));
    expect(onAccept).toHaveBeenCalledTimes(1);
    expect(onAccept.mock.calls[0][0].id).toBe("t-inv-1");
  });

  it("invokes onDecline with the team when Decline is clicked", async () => {
    const onDecline = jest.fn();
    render(
      <InvitationsSection
        invitations={[makeInvite()]}
        busyId={null}
        onAccept={() => undefined}
        onDecline={onDecline}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: /decline/i }));
    expect(onDecline).toHaveBeenCalledTimes(1);
  });

  it("disables both buttons while busyId is set", () => {
    render(
      <InvitationsSection
        invitations={[makeInvite()]}
        busyId="t-inv-1"
        onAccept={() => undefined}
        onDecline={() => undefined}
      />,
    );
    expect(screen.getByRole("button", { name: /accept/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /working/i })).toBeDisabled();
  });
});
