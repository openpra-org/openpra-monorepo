import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { WorkbooksPanel } from "../workbooksPanel";

const fetchMock = jest.fn();

function workbook(name: string, overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: `wb-${name}`,
    projectId: "proj-1",
    elementCode: "POS",
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
  element: { code: "POS", name: "Plant Operating State Analysis" },
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

  it("shows the element breadcrumb and loads the workbooks", async () => {
    fetchMock.mockResolvedValue(listResponse([workbook("Aurora-1"), workbook("Aurora-2")]));
    renderPanel();
    expect(screen.getAllByText("Plant Operating State Analysis").length).toBeGreaterThan(0);
    expect(await screen.findByText("Aurora-1")).toBeInTheDocument();
    expect(screen.getByText("Aurora-2")).toBeInTheDocument();
  });

  it("filters the list by the search query", async () => {
    fetchMock.mockResolvedValue(listResponse([workbook("Aurora-1"), workbook("Aurora-2")]));
    renderPanel();
    await screen.findByText("Aurora-1");
    await userEvent.type(screen.getByPlaceholderText(/search workbooks/i), "aurora-2");
    expect(screen.queryByText("Aurora-1")).not.toBeInTheDocument();
    expect(screen.getByText("Aurora-2")).toBeInTheDocument();
  });

  it("creates a workbook and prepends it to the list", async () => {
    fetchMock.mockImplementation((_url: string, init?: RequestInit) => {
      if ((init?.method ?? "GET") === "POST") {
        return Promise.resolve(
          new Response(JSON.stringify(workbook("Aurora-3", { id: "wb-new" })), {
            status: 201,
            headers: { "Content-Type": "application/json" },
          }),
        );
      }
      return Promise.resolve(listResponse([workbook("Aurora-1")]));
    });
    renderPanel();
    await screen.findByText("Aurora-1");
    await userEvent.click(screen.getByRole("button", { name: /new workbook/i }));
    await userEvent.type(screen.getByPlaceholderText(/name your workbook/i), "Aurora-3");
    await userEvent.click(screen.getByRole("button", { name: /^create$/i }));
    expect(await screen.findByText("Aurora-3")).toBeInTheDocument();
  });

  it("hides the create affordance for read-only viewers", async () => {
    fetchMock.mockResolvedValue(listResponse([workbook("Aurora-1")]));
    renderPanel(true);
    await screen.findByText("Aurora-1");
    expect(screen.queryByRole("button", { name: /new workbook/i })).not.toBeInTheDocument();
  });
});
