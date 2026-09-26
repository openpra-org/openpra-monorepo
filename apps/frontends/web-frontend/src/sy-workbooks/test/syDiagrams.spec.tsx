import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { SystemDiagram, SystemsAnalysis } from "interfaces-mef-types/sy/systems-analysis";
import { DrawerContent } from "../syScreens2";
import { SySystemDiagrams } from "../SySystemDiagrams";
import { SyFaultTreeDiagrams } from "../SyFaultTreeDiagrams";
import { diagramDocuments, loadDiagramSource, matchPage, pageAspect, rankHits, renderDiagram, resolveDiagramDocument, roundRegion, searchPdf, type SyDiagramSource } from "../syDiagrams";
import { listSyDocuments, type SyDocumentEntry } from "../syWorkbookApi";

jest.mock("../syDiagrams", () => ({
  ...jest.requireActual<typeof import("../syDiagrams")>("../syDiagrams"),
  loadDiagramSource: jest.fn(),
  renderDiagram: jest.fn(),
  searchPdf: jest.fn(),
  pageAspect: jest.fn(),
}));

jest.mock("../syWorkbookApi", () => ({
  listSyDocuments: jest.fn(),
  syDocumentContentPath: (workbookId: string, documentId: string) => `/api/sy-workbooks/${workbookId}/documents/${documentId}/content`,
}));

type DiagramAnalysis = Pick<SystemsAnalysis, "systemDefinitions" | "exampleDocuments">;

interface MockContext {
  sy: DiagramAnalysis;
  editable: boolean;
  mutateSy: jest.Mock;
  runtime: { workbookId: string | null; projectId: string | null; revision: number | null; saveStatus: "saved" };
}

class TestPointerEvent extends MouseEvent {
  readonly pointerId: number;

  constructor(type: string, init: MouseEventInit & { pointerId?: number } = {}) {
    super(type, init);
    this.pointerId = init.pointerId ?? 1;
  }
}

const SYSTEM_ID = "SYS-SCS";
const DIAGRAM: SystemDiagram = {
  uuid: "diagram-1",
  title: "Figure 4-2. Shutdown cooling system flow diagram",
  documentId: "doc-pdf",
  filename: "scs-design.pdf",
  page: 9,
  region: { x: 0.1, y: 0.2, width: 0.7, height: 0.5 },
};
const BITMAP: ImageBitmap = { width: 800, height: 1000, close: () => undefined };
const SOURCE: SyDiagramSource = { kind: "image", image: BITMAP, pageCount: 24 };
const UPLOADED: SyDocumentEntry[] = [
  { documentId: "doc-pdf", filename: "scs-design.pdf", mimeType: "application/pdf", size: 4096, uploadedBy: "ada", uploadedAt: "2026-09-26T10:00:00.000Z" },
  { documentId: "doc-docx", filename: "notes.docx", mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", size: 1024, uploadedBy: "ada", uploadedAt: "2026-09-26T10:00:00.000Z" },
  { documentId: "doc-png", filename: "scs-sketch.png", mimeType: "image/png", size: 2048, uploadedBy: "ada", uploadedAt: "2026-09-26T10:00:00.000Z" },
];

function makeAnalysis(diagrams: SystemDiagram[] = []): DiagramAnalysis {
  return {
    systemDefinitions: [{
      uuid: SYSTEM_ID,
      name: "Shutdown cooling system",
      abbreviation: "SCS",
      boundaries: [],
      diagrams,
      successCriteriaIds: [],
      modeledComponentsAndFailures: {},
      informationBasis: "as-designed-as-intended",
      implementsSrs: [],
    }],
    exampleDocuments: [
      { id: "SY-DOC-01", name: "Protection system design description", kind: "doc", sizeLabel: "Design", uploadedLabel: "Example", extracted: "Protection logic", linked: 1, url: "/api/example-documents/sy/protection" },
      { id: "SY-DOC-03", name: "Failure data dossier", kind: "sheet", sizeLabel: "Data", uploadedLabel: "Example", extracted: "Rates", linked: 1 },
    ],
  };
}

let mockContext: MockContext;
const originalWidth = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "clientWidth");
const originalHeight = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "clientHeight");
const originalPointerEvent = Object.getOwnPropertyDescriptor(window, "PointerEvent");

jest.mock("../syWorkbookContext", () => ({
  useSyWorkbook: () => mockContext,
}));

function setContext(sy: DiagramAnalysis, editable = true, workbookId: string | null = "sy-1"): void {
  mockContext = { sy, editable, mutateSy: jest.fn(), runtime: { workbookId, projectId: "project-1", revision: 4, saveStatus: "saved" } };
}

function applyLastMutation(): DiagramAnalysis {
  const calls = mockContext.mutateSy.mock.calls;
  const mutator = calls[calls.length - 1]![0] as (draft: DiagramAnalysis) => DiagramAnalysis;
  return mutator(mockContext.sy);
}

describe("SY diagrams", () => {
  beforeAll(() => {
    Object.defineProperty(HTMLElement.prototype, "clientWidth", { configurable: true, get: () => 800 });
    Object.defineProperty(HTMLElement.prototype, "clientHeight", { configurable: true, get: () => 600 });
    Object.defineProperty(window, "PointerEvent", { configurable: true, writable: true, value: TestPointerEvent });
  });

  afterAll(() => {
    if (originalWidth === undefined) Reflect.deleteProperty(HTMLElement.prototype, "clientWidth");
    else Object.defineProperty(HTMLElement.prototype, "clientWidth", originalWidth);
    if (originalHeight === undefined) Reflect.deleteProperty(HTMLElement.prototype, "clientHeight");
    else Object.defineProperty(HTMLElement.prototype, "clientHeight", originalHeight);
    if (originalPointerEvent === undefined) Reflect.deleteProperty(window, "PointerEvent");
    else Object.defineProperty(window, "PointerEvent", originalPointerEvent);
  });

  beforeEach(() => {
    jest.clearAllMocks();
    window.localStorage.clear();
    jest.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
    jest.mocked(loadDiagramSource).mockResolvedValue(SOURCE);
    jest.mocked(renderDiagram).mockImplementation(() => ({ done: Promise.resolve(document.createElement("canvas")), cancel: jest.fn() }));
    jest.mocked(pageAspect).mockResolvedValue(1.25);
    jest.mocked(listSyDocuments).mockResolvedValue(UPLOADED);
    jest.mocked(searchPdf).mockResolvedValue({
      pagesWithText: 24,
      hits: [
        { page: 9, lines: ["Figure 4-2. Shutdown Cooling System Flow Diagram"], caption: "Figure 4-2. Shutdown Cooling System Flow Diagram" },
        { page: 3, lines: ["The shutdown cooling system has two trains."], caption: null },
      ],
    });
  });

  it("finds the pages that match and puts figure captions first", () => {
    const hits = rankHits([
      matchPage(3, ["The shutdown cooling system has two trains."], "Shutdown cooling"),
      matchPage(9, ["Legend", "Figure 4-2. Shutdown Cooling System Flow Diagram"], "Shutdown cooling"),
      matchPage(12, ["Reactor cavity cooling"], "Shutdown cooling"),
    ].flatMap((hit) => (hit === null ? [] : [hit])));

    expect(hits.map((hit) => hit.page)).toEqual([9, 3]);
    expect(hits[0]?.caption).toBe("Figure 4-2. Shutdown Cooling System Flow Diagram");
  });

  it("offers uploaded PDFs and images and the example documents", () => {
    const documents = diagramDocuments(makeAnalysis(), "sy-1", UPLOADED);

    expect(documents.map(({ filename, kind, url }) => [filename, kind, url])).toEqual([
      ["scs-design.pdf", "pdf", "/api/sy-workbooks/sy-1/documents/doc-pdf/content"],
      ["scs-sketch.png", "image", "/api/sy-workbooks/sy-1/documents/doc-png/content"],
      ["Protection system design description", "pdf", "/api/example-documents/sy/protection"],
    ]);
  });

  it("finds the document behind a saved diagram", () => {
    const sy = makeAnalysis();

    expect(resolveDiagramDocument(sy, "sy-1", DIAGRAM)?.url).toBe("/api/sy-workbooks/sy-1/documents/doc-pdf/content");
    expect(resolveDiagramDocument(sy, null, { documentId: "SY-DOC-01", filename: "Protection system design description" })?.url).toBe("/api/example-documents/sy/protection");
    expect(resolveDiagramDocument(sy, null, DIAGRAM)).toBeNull();
  });

  it("keeps a crop inside the page", () => {
    expect(roundRegion({ x: 0.9, y: -0.1, width: 0.5, height: 0.33333 })).toEqual({ x: 0.9, y: 0, width: 0.1, height: 0.3333 });
  });

  it("lists a system's diagrams and shows one on request", async () => {
    setContext(makeAnalysis([DIAGRAM]));
    const openDrawer = jest.fn();
    render(<SySystemDiagrams systemId={SYSTEM_ID} openDrawer={openDrawer} />);

    const table = screen.getByRole("table", { name: "Diagrams" });
    expect(within(table).getByText("scs-design.pdf")).toBeInTheDocument();
    expect(within(table).getByText("Page 9")).toBeInTheDocument();

    fireEvent.click(within(table).getByRole("button", { name: `View ${DIAGRAM.title}` }));
    expect(await screen.findByRole("img", { name: DIAGRAM.title })).toBeInTheDocument();
    expect(loadDiagramSource).toHaveBeenCalledWith({ url: "/api/sy-workbooks/sy-1/documents/doc-pdf/content", kind: "pdf" });
    expect(renderDiagram).toHaveBeenCalledWith(SOURCE, 9, DIAGRAM.region, 776);

    fireEvent.click(within(table).getByRole("button", { name: `Edit ${DIAGRAM.title}` }));
    expect(openDrawer).toHaveBeenCalledWith({ kind: "diagram", id: SYSTEM_ID, diagramId: DIAGRAM.uuid });
    fireEvent.click(screen.getByRole("button", { name: "Add diagram" }));
    expect(openDrawer).toHaveBeenCalledWith({ kind: "diagram", id: SYSTEM_ID });
    fireEvent.click(within(table).getByRole("button", { name: `Remove ${DIAGRAM.title}` }));
    expect(applyLastMutation().systemDefinitions[0]!.diagrams).toEqual([]);
  });

  it("searches a PDF for the system and saves the cropped figure", async () => {
    setContext(makeAnalysis());
    render(<DrawerContent context={{ kind: "diagram", id: SYSTEM_ID }} onClose={jest.fn()} />);

    const documents = await screen.findByRole("table", { name: "Documents" });
    expect(within(documents).queryByText("notes.docx")).not.toBeInTheDocument();
    fireEvent.click(within(documents).getByRole("button", { name: "Choose scs-design.pdf" }));

    const matches = await screen.findByRole("table", { name: "Matching pages" });
    expect(searchPdf).toHaveBeenCalledWith(SOURCE, "Shutdown cooling system", expect.any(Function), expect.any(Function));
    fireEvent.click(within(matches).getByRole("button", { name: "Open page 9" }));

    expect(screen.getByText("Drag across the page to select the diagram.")).toBeInTheDocument();
    expect(screen.queryByRole("textbox", { name: "Title" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save diagram" })).toBeDisabled();
    const area = await screen.findByTestId("diagram-crop-area");
    jest.spyOn(area, "getBoundingClientRect").mockReturnValue(new DOMRect(0, 0, 400, 500));
    fireEvent.pointerDown(area, { button: 0, clientX: 40, clientY: 100, pointerId: 1 });
    fireEvent.pointerMove(area, { clientX: 360, clientY: 350, pointerId: 1 });
    fireEvent.pointerUp(area, { clientX: 360, clientY: 350, pointerId: 1 });

    expect(screen.queryByTestId("diagram-crop-area")).not.toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Title" })).toHaveValue("Figure 4-2. Shutdown Cooling System Flow Diagram");
    expect(screen.getByRole("button", { name: "Re-crop" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Choose another page" })).toBeInTheDocument();
    expect(await screen.findByRole("img", { name: "Figure 4-2. Shutdown Cooling System Flow Diagram" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Save diagram" }));

    const saved = applyLastMutation().systemDefinitions[0]!.diagrams;
    expect(saved).toEqual([{
      uuid: expect.any(String),
      title: "Figure 4-2. Shutdown Cooling System Flow Diagram",
      documentId: "doc-pdf",
      filename: "scs-design.pdf",
      page: 9,
      region: { x: 0.1, y: 0.2, width: 0.8, height: 0.5 },
    }]);
  });

  it("browses pages when a PDF has no searchable text", async () => {
    jest.mocked(searchPdf).mockResolvedValue({ pagesWithText: 0, hits: [] });
    setContext(makeAnalysis());
    render(<DrawerContent context={{ kind: "diagram", id: SYSTEM_ID }} onClose={jest.fn()} />);

    fireEvent.click(await screen.findByRole("button", { name: "Choose scs-design.pdf" }));

    const empty = await screen.findByText("This PDF has no searchable text. Browse the pages instead.");
    const pages = screen.getByRole("region", { name: "Pages" });
    expect(pages.compareDocumentPosition(empty) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(within(pages).getByText("Pages 1 to 12 of 24")).toBeInTheDocument();
    const goTo = within(pages).getByRole("spinbutton", { name: "Go to page" });
    fireEvent.change(goTo, { target: { value: "30" } });
    expect(within(pages).getByRole("button", { name: "Go" })).toBeDisabled();
    fireEvent.change(goTo, { target: { value: "5" } });
    fireEvent.click(within(pages).getByRole("button", { name: "Go" }));
    expect(within(pages).getByText("Pages 5 to 16 of 24")).toBeInTheDocument();
    expect(within(pages).getAllByRole("button", { name: "Open page 5" })).toHaveLength(1);
    expect(within(pages).queryByRole("button", { name: "Open page 4" })).not.toBeInTheDocument();
    fireEvent.change(goTo, { target: { value: "24" } });
    fireEvent.submit(goTo);
    expect(within(pages).getByText("Pages 13 to 24 of 24")).toBeInTheDocument();
    expect(within(pages).getByRole("button", { name: "Open page 24" })).toBeInTheDocument();
    fireEvent.click(within(pages).getByRole("button", { name: "Previous pages" }));
    expect(within(pages).getByText("Pages 1 to 12 of 24")).toBeInTheDocument();
    fireEvent.click(within(pages).getByRole("button", { name: "Next pages" }));
    fireEvent.click(within(pages).getByRole("button", { name: "Open page 14" }));
    expect(screen.getByText("Page 14 of 24")).toBeInTheDocument();
    expect(await screen.findByTestId("diagram-crop-area")).toBeInTheDocument();
  });

  it("re-crops and removes a saved diagram", async () => {
    setContext(makeAnalysis([DIAGRAM]));
    const onClose = jest.fn();
    const { unmount } = render(<DrawerContent context={{ kind: "diagram", id: SYSTEM_ID, diagramId: DIAGRAM.uuid }} onClose={onClose} />);

    expect(await screen.findByRole("textbox", { name: "Title" })).toHaveValue(DIAGRAM.title);
    expect(await screen.findByRole("img", { name: DIAGRAM.title })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Re-crop" }));
    expect(screen.getByText("Page 9 of 24")).toBeInTheDocument();
    await screen.findByTestId("diagram-crop-area");
    fireEvent.click(screen.getByRole("button", { name: "Use whole page" }));
    await screen.findByRole("img", { name: DIAGRAM.title });
    fireEvent.click(screen.getByRole("button", { name: "Rotate" }));
    fireEvent.click(screen.getByRole("button", { name: "Save diagram" }));
    expect(applyLastMutation().systemDefinitions[0]!.diagrams).toEqual([{ ...DIAGRAM, region: { x: 0, y: 0, width: 1, height: 1 }, rotation: 90 }]);
    unmount();

    render(<DrawerContent context={{ kind: "diagram", id: SYSTEM_ID, diagramId: DIAGRAM.uuid }} onClose={onClose} />);
    await screen.findByRole("img", { name: DIAGRAM.title });
    fireEvent.click(screen.getByRole("button", { name: "Remove diagram" }));
    expect(applyLastMutation().systemDefinitions[0]!.diagrams).toEqual([]);
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it("fits the whole diagram in the diagram view", async () => {
    setContext(makeAnalysis([DIAGRAM]));
    render(<SyFaultTreeDiagrams systemId={SYSTEM_ID}><div>Fault tree editor</div></SyFaultTreeDiagrams>);

    expect(screen.getAllByRole("radio").map((option) => option.textContent)).toEqual(["Fault tree", "Diagram"]);
    expect(screen.getByRole("radio", { name: "Fault tree" })).toHaveAttribute("aria-checked", "true");
    expect(screen.queryByRole("region", { name: "Diagrams" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("radio", { name: "Diagram" }));
    const panel = screen.getByRole("region", { name: "Diagrams" });
    expect(await within(panel).findByRole("img", { name: DIAGRAM.title })).toBeInTheDocument();
    await waitFor(() => expect(renderDiagram).toHaveBeenLastCalledWith(SOURCE, 9, DIAGRAM.region, 645));
    expect(within(panel).getByRole("button", { name: "Zoom out" })).toBeDisabled();
    expect(within(panel).getByRole("button", { name: "Fit" })).toBeDisabled();

    fireEvent.click(within(panel).getByRole("button", { name: "Zoom in" }));
    expect(within(panel).getByText("150%")).toBeInTheDocument();
    await waitFor(() => expect(renderDiagram).toHaveBeenLastCalledWith(SOURCE, 9, DIAGRAM.region, 967));
    fireEvent.click(within(panel).getByRole("button", { name: "Fit" }));
    expect(within(panel).getByText("100%")).toBeInTheDocument();
    await waitFor(() => expect(renderDiagram).toHaveBeenLastCalledWith(SOURCE, 9, DIAGRAM.region, 645));
  });

  it("switches the fault tree out for the diagram and back", async () => {
    window.localStorage.setItem("sy.faultTreeView", "split");
    setContext(makeAnalysis([DIAGRAM]));
    render(<SyFaultTreeDiagrams systemId={SYSTEM_ID}><div>Fault tree editor</div></SyFaultTreeDiagrams>);

    expect(screen.getByRole("radio", { name: "Fault tree" })).toHaveAttribute("aria-checked", "true");
    fireEvent.click(screen.getByRole("radio", { name: "Diagram" }));
    expect(screen.getByRole("radio", { name: "Diagram" })).toHaveAttribute("aria-checked", "true");
    expect(await screen.findByRole("img", { name: DIAGRAM.title })).toBeInTheDocument();
    expect(screen.getByText("Fault tree editor")).not.toBeVisible();
    expect(window.localStorage.getItem("sy.faultTreeView")).toBe("diagram");

    const view = screen.getByRole("radiogroup", { name: "Fault tree view" });
    screen.getByRole("radio", { name: "Diagram" }).focus();
    fireEvent.keyDown(view, { key: "Home" });
    expect(screen.getByRole("radio", { name: "Fault tree" })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("radio", { name: "Fault tree" })).toHaveFocus();
    expect(screen.getByText("Fault tree editor")).toBeVisible();
    expect(screen.queryByRole("region", { name: "Diagrams" })).not.toBeInTheDocument();
    fireEvent.keyDown(view, { key: "ArrowLeft" });
    expect(screen.getByRole("radio", { name: "Diagram" })).toHaveAttribute("aria-checked", "true");
    fireEvent.keyDown(view, { key: "ArrowRight" });
    expect(screen.getByRole("radio", { name: "Fault tree" })).toHaveAttribute("aria-checked", "true");
    fireEvent.keyDown(view, { key: "End" });
    expect(screen.getByRole("radio", { name: "Diagram" })).toHaveAttribute("aria-checked", "true");
    expect(await screen.findByRole("img", { name: DIAGRAM.title })).toBeInTheDocument();
    expect(screen.getByText("Fault tree editor")).not.toBeVisible();
  });

  it("edits and removes the shown diagram from the fault tree panel", async () => {
    window.localStorage.setItem("sy.faultTreeView", "diagram");
    setContext(makeAnalysis([DIAGRAM]));
    const onAddDiagram = jest.fn();
    const onEditDiagram = jest.fn();
    render(<SyFaultTreeDiagrams systemId={SYSTEM_ID} onAddDiagram={onAddDiagram} onEditDiagram={onEditDiagram}><div>Fault tree editor</div></SyFaultTreeDiagrams>);

    const panel = screen.getByRole("region", { name: "Diagrams" });
    await within(panel).findByRole("img", { name: DIAGRAM.title });
    fireEvent.click(within(panel).getByRole("button", { name: "Add diagram" }));
    expect(onAddDiagram).toHaveBeenCalled();
    fireEvent.click(within(panel).getByRole("button", { name: `Edit ${DIAGRAM.title}` }));
    expect(onEditDiagram).toHaveBeenCalledWith(DIAGRAM.uuid);
    fireEvent.click(within(panel).getByRole("button", { name: `Remove ${DIAGRAM.title}` }));
    expect(applyLastMutation().systemDefinitions[0]!.diagrams).toEqual([]);
  });

  it("hides the edit actions from reviewers", async () => {
    window.localStorage.setItem("sy.faultTreeView", "diagram");
    setContext(makeAnalysis([DIAGRAM]), false);
    render(<SyFaultTreeDiagrams systemId={SYSTEM_ID}><div>Fault tree editor</div></SyFaultTreeDiagrams>);

    const panel = screen.getByRole("region", { name: "Diagrams" });
    await within(panel).findByRole("img", { name: DIAGRAM.title });
    expect(within(panel).queryByRole("button", { name: `Remove ${DIAGRAM.title}` })).not.toBeInTheDocument();
    expect(within(panel).getByRole("button", { name: "Zoom in" })).toBeInTheDocument();
  });

  it("turns a sideways figure upright", async () => {
    window.localStorage.setItem("sy.faultTreeView", "diagram");
    setContext(makeAnalysis([{ ...DIAGRAM, rotation: 90 }]));
    render(<SyFaultTreeDiagrams systemId={SYSTEM_ID}><div>Fault tree editor</div></SyFaultTreeDiagrams>);

    const image = await screen.findByRole("img", { name: DIAGRAM.title });
    await waitFor(() => expect(image).toHaveAttribute("width", "150"));
    expect(image).toHaveAttribute("height", "300");
    expect(renderDiagram).toHaveBeenLastCalledWith(SOURCE, 9, DIAGRAM.region, 514);
  });

  it("offers to add a diagram from the fault tree when there is none", async () => {
    window.localStorage.setItem("sy.faultTreeView", "diagram");
    setContext(makeAnalysis());
    const onAddDiagram = jest.fn();
    render(<SyFaultTreeDiagrams systemId={SYSTEM_ID} onAddDiagram={onAddDiagram}><div>Fault tree editor</div></SyFaultTreeDiagrams>);

    expect(screen.getByText("No diagrams for this system yet.")).toBeInTheDocument();
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Add diagram" })); });
    expect(onAddDiagram).toHaveBeenCalled();
  });
});
