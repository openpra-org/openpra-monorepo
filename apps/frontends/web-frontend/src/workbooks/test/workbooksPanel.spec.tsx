import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { WorkbooksPanel } from "../workbooksPanel";

const fetchMock = jest.fn();

function workbook(name: string, overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: `wb-${name}`,
    projectId: "proj-1",
    elementCode: "ES",
    toolId: "event-tree",
    name,
    status: "draft",
    version: 1,
    ownerUsername: "ada",
    ownerFullName: "Ada Lovelace",
    ownerInitials: "AL",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

function listResponse(workbooks: Record<string, unknown>[]): Response {
  return new Response(JSON.stringify({ workbooks }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

const PROPS = {
  projectId: "proj-1",
  element: { code: "ES", name: "Event Sequence Analysis" },
  tool: { id: "event-tree" as const, name: "Event trees" },
};

describe("WorkbooksPanel", () => {
  beforeAll(() => {
    Object.defineProperty(globalThis, "fetch", { value: fetchMock, writable: true });
  });

  beforeEach(() => {
    fetchMock.mockReset();
    localStorage.clear();
  });

  function renderPanel(readOnly = false) {
    const onClose = jest.fn();
    const onOpenWorkbook = jest.fn();
    const onError = jest.fn();
    render(
      <WorkbooksPanel
        {...PROPS}
        readOnly={readOnly}
        onClose={onClose}
        onOpenWorkbook={onOpenWorkbook}
        onError={onError}
      />,
    );
    return { onClose, onOpenWorkbook, onError };
  }

  it("shows the element/tool breadcrumb and loads the workbooks", async () => {
    fetchMock.mockResolvedValue(listResponse([workbook("ET-LOOP"), workbook("ET-SLOCA")]));
    renderPanel();
    expect(screen.getByText("Event Sequence Analysis")).toBeInTheDocument();
    expect(await screen.findByText("ET-LOOP")).toBeInTheDocument();
    expect(screen.getByText("ET-SLOCA")).toBeInTheDocument();
  });

  it("filters the list by the search query", async () => {
    fetchMock.mockResolvedValue(listResponse([workbook("ET-LOOP"), workbook("ET-SLOCA")]));
    renderPanel();
    await screen.findByText("ET-LOOP");
    await userEvent.type(screen.getByPlaceholderText(/search event trees/i), "sloca");
    expect(screen.queryByText("ET-LOOP")).not.toBeInTheDocument();
    expect(screen.getByText("ET-SLOCA")).toBeInTheDocument();
  });

  it("creates a workbook and prepends it to the list", async () => {
    fetchMock.mockImplementation((_url: string, init?: RequestInit) => {
      if ((init?.method ?? "GET") === "POST") {
        return Promise.resolve(
          new Response(JSON.stringify(workbook("ET-MLOCA", { id: "wb-new" })), {
            status: 201,
            headers: { "Content-Type": "application/json" },
          }),
        );
      }
      return Promise.resolve(listResponse([workbook("ET-LOOP")]));
    });
    renderPanel();
    await screen.findByText("ET-LOOP");
    await userEvent.click(screen.getByRole("button", { name: /new workbook/i }));
    await userEvent.type(screen.getByPlaceholderText(/name your event trees workbook/i), "ET-MLOCA");
    await userEvent.click(screen.getByRole("button", { name: /^create$/i }));
    expect(await screen.findByText("ET-MLOCA")).toBeInTheDocument();
  });

  it("hides the create affordance for read-only viewers", async () => {
    fetchMock.mockResolvedValue(listResponse([workbook("ET-LOOP")]));
    renderPanel(true);
    await screen.findByText("ET-LOOP");
    expect(screen.queryByRole("button", { name: /new workbook/i })).not.toBeInTheDocument();
  });
});
