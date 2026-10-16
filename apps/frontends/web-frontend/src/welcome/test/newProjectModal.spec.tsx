import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NewProjectModal } from "../newProjectModal";

const fetchMock = jest.fn();

function projectResponse(name: string, overrides: Record<string, unknown> = {}): Response {
  return new Response(
    JSON.stringify({
      id: "abc",
      name,
      mode: "full-scope",
      modeLabel: "Full Scope",
      ownerUsername: "ada",
      ownerFullName: "Ada Lovelace",
      ownerInitials: "AL",
      myRole: "owner",
      sharedTeams: [],
      sharedUsers: [],
      pinned: false,
      state: "active",
      pageLayout: "modern",
      version: 1,
      updatedAt: new Date().toISOString(),
      ...overrides,
    }),
    { status: 201, headers: { "Content-Type": "application/json" } },
  );
}

function workbooksResponse(): Response {
  return new Response(
    JSON.stringify({ workbooks: [], failed: [], unlinked: [] }),
    { status: 201, headers: { "Content-Type": "application/json" } },
  );
}

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

  it("renders the heading and asks for a required workbook name instead of a risk mode", async () => {
    renderModal();
    expect(screen.getByRole("heading", { name: /create a new project/i })).toBeInTheDocument();
    expect(screen.queryByRole("radiogroup", { name: "Risk mode" })).not.toBeInTheDocument();
    expect(screen.getByLabelText("Workbook name")).toHaveAttribute("aria-required", "true");
    await userEvent.type(screen.getByLabelText("Project name"), "Real Project Name");
    await userEvent.click(screen.getByRole("button", { name: "Create project" }));
    expect(await screen.findByText("Workbook name is required")).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects submission when the name is shorter than 3 characters", async () => {
    renderModal();
    await userEvent.type(screen.getByLabelText(/project name/i), "ab");
    await userEvent.click(screen.getByRole("button", { name: /create project/i }));
    expect(await screen.findByText(/must be at least 3 characters/i)).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("posts the name and chosen layout to /api/projects, then creates the named workbook in every element", async () => {
    fetchMock.mockResolvedValueOnce(projectResponse("Real Project Name")).mockResolvedValueOnce(workbooksResponse());

    const { onCreated } = renderModal();
    await userEvent.type(screen.getByLabelText(/project name/i), "Real Project Name");
    await userEvent.type(screen.getByLabelText("Workbook name"), "Plant baseline");
    await userEvent.click(screen.getByRole("button", { name: /create project/i }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/projects",
        expect.objectContaining({ method: "POST" }),
      );
    });
    const body = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    expect(body).toEqual({ name: "Real Project Name", pageLayout: "modern" });
    await waitFor(() => { expect(onCreated).toHaveBeenCalledTimes(1); });
    expect(fetchMock).toHaveBeenCalledWith("/api/projects/abc/workbooks/common", expect.objectContaining({ method: "POST" }));
    expect(JSON.parse(fetchMock.mock.calls[1][1].body as string)).toEqual({ name: "Plant baseline" });
    expect(onCreated).toHaveBeenCalledWith(expect.objectContaining({ id: "abc", mode: "full-scope" }), { workbookName: "Plant baseline", failed: [], unlinked: [] });
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
    await userEvent.type(screen.getByLabelText("Workbook name"), "Plant baseline");
    await userEvent.click(screen.getByRole("button", { name: /create project/i }));
    await waitFor(() => { expect(onError).toHaveBeenCalledWith("Server exploded"); });
    expect(onCreated).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("closes when Escape is pressed", async () => {
    const { onClose } = renderModal();
    await userEvent.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
