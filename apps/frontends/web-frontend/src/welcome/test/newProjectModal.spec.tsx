import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NewProjectModal } from "../newProjectModal";

const fetchMock = jest.fn();

describe("NewProjectModal", () => {
  beforeAll(() => {
    Object.defineProperty(globalThis, "fetch", { value: fetchMock, writable: true });
  });

  beforeEach(() => {
    fetchMock.mockReset();
    localStorage.clear();
  });

  function renderModal() {
    const onClose = jest.fn();
    const onCreated = jest.fn();
    const onError = jest.fn();
    render(<NewProjectModal onClose={onClose} onCreated={onCreated} onError={onError} />);
    return { onClose, onCreated, onError };
  }

  it("renders the heading and all four risk modes", () => {
    renderModal();
    expect(screen.getByRole("heading", { name: /create a new project/i })).toBeInTheDocument();
    expect(screen.getByText("Internal Events")).toBeInTheDocument();
    expect(screen.getByText("Internal Hazards")).toBeInTheDocument();
    expect(screen.getByText("External Hazards")).toBeInTheDocument();
    expect(screen.getByText("Full Scope")).toBeInTheDocument();
  });

  it("rejects submission when the name is shorter than 3 characters", async () => {
    renderModal();
    await userEvent.type(screen.getByLabelText(/project name/i), "ab");
    await userEvent.click(screen.getByRole("button", { name: /create project/i }));
    expect(await screen.findByText(/must be at least 3 characters/i)).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("posts to /api/projects with name and mode when submitting a valid form", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          id: "abc",
          name: "Real Project Name",
          mode: "internal-events",
          modeLabel: "Internal Events",
          ownerUsername: "ada",
          ownerFullName: "Ada Lovelace",
          ownerInitials: "AL",
          collaborators: [],
          status: { POS: "not-started" },
          progress: 0,
          pinned: false,
          state: "active",
          updatedAt: new Date().toISOString(),
        }),
        { status: 201, headers: { "Content-Type": "application/json" } },
      ),
    );

    const { onCreated } = renderModal();
    await userEvent.type(screen.getByLabelText(/project name/i), "Real Project Name");
    await userEvent.click(screen.getByRole("button", { name: /create project/i }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/projects",
        expect.objectContaining({ method: "POST" }),
      );
    });
    const body = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    expect(body).toEqual({ name: "Real Project Name", mode: "internal-events" });
    await waitFor(() => { expect(onCreated).toHaveBeenCalledTimes(1); });
  });

  it("invokes onError when the API rejects creation", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ message: "Server exploded" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }),
    );
    const { onError, onCreated } = renderModal();
    await userEvent.type(screen.getByLabelText(/project name/i), "Real Project Name");
    await userEvent.click(screen.getByRole("button", { name: /create project/i }));
    await waitFor(() => { expect(onError).toHaveBeenCalledWith("Server exploded"); });
    expect(onCreated).not.toHaveBeenCalled();
  });

  it("closes when Escape is pressed", async () => {
    const { onClose } = renderModal();
    await userEvent.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
