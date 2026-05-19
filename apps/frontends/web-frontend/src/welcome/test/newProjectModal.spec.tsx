import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NewProjectModal } from "../newProjectModal";

const fetchMock = jest.fn();

function teamsResponse(teams: Array<{ id: string; name: string; role: string }> = []): Response {
  const body = {
    teams: teams.map((t) => ({
      id: t.id,
      name: t.name,
      organization: "",
      description: "",
      visibility: "public",
      adminUsername: "ada",
      memberCount: 1,
      role: t.role,
    })),
  };
  return new Response(JSON.stringify(body), { status: 200, headers: { "Content-Type": "application/json" } });
}

function projectResponse(name: string, overrides: Record<string, unknown> = {}): Response {
  return new Response(
    JSON.stringify({
      id: "abc",
      name,
      mode: "internal-events",
      modeLabel: "Internal Events",
      ownerUsername: "ada",
      ownerFullName: "Ada Lovelace",
      ownerInitials: "AL",
      ownerTeamId: null,
      ownerTeamName: null,
      collaborators: [],
      status: { POS: "not-started" },
      progress: 0,
      pinned: false,
      state: "active",
      updatedAt: new Date().toISOString(),
      ...overrides,
    }),
    { status: 201, headers: { "Content-Type": "application/json" } },
  );
}

describe("NewProjectModal", () => {
  beforeAll(() => {
    Object.defineProperty(globalThis, "fetch", { value: fetchMock, writable: true });
  });

  beforeEach(() => {
    fetchMock.mockReset();
    fetchMock.mockResolvedValue(teamsResponse([]));
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
    expect(fetchMock).not.toHaveBeenCalledWith(
      "/api/projects",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("posts to /api/projects with name and mode when submitting a valid form", async () => {
    fetchMock.mockResolvedValueOnce(teamsResponse([]));
    fetchMock.mockResolvedValueOnce(projectResponse("Real Project Name"));

    const { onCreated } = renderModal();
    await userEvent.type(screen.getByLabelText(/project name/i), "Real Project Name");
    await userEvent.click(screen.getByRole("button", { name: /create project/i }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/projects",
        expect.objectContaining({ method: "POST" }),
      );
    });
    const projectCall = fetchMock.mock.calls.find(([url]) => url === "/api/projects");
    const body = JSON.parse(projectCall![1].body as string);
    expect(body).toEqual({ name: "Real Project Name", mode: "internal-events", ownerTeamId: null });
    await waitFor(() => { expect(onCreated).toHaveBeenCalledTimes(1); });
  });

  it("submits ownerTeamId when a team is selected as owner", async () => {
    fetchMock.mockResolvedValueOnce(teamsResponse([{ id: "team-42", name: "Risk Group", role: "admin" }]));
    fetchMock.mockResolvedValueOnce(projectResponse("Team Project", { ownerTeamId: "team-42", ownerTeamName: "Risk Group" }));

    renderModal();
    await userEvent.type(screen.getByLabelText(/project name/i), "Team Project");
    await waitFor(() => {
      expect(screen.getByRole("option", { name: "Risk Group" })).toBeInTheDocument();
    });
    await userEvent.selectOptions(screen.getByLabelText(/^owner$/i), "team-42");
    await userEvent.click(screen.getByRole("button", { name: /create project/i }));

    await waitFor(() => {
      const projectCall = fetchMock.mock.calls.find(([url]) => url === "/api/projects");
      expect(projectCall).toBeDefined();
      const body = JSON.parse(projectCall![1].body as string);
      expect(body).toEqual({ name: "Team Project", mode: "internal-events", ownerTeamId: "team-42" });
    });
  });

  it("invokes onError when the API rejects creation", async () => {
    fetchMock.mockResolvedValueOnce(teamsResponse([]));
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
