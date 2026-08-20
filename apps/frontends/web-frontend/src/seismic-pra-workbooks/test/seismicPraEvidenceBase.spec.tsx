import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createSeismicPraExample } from "../../../../../backends/web-backend/src/example-workbooks/seeds/seismic-pra-seed-factory";
import { EvidenceBaseScreen } from "../seismicPraScreens";
import { SeismicPraWorkbookProvider } from "../seismicPraWorkbookContext";

function renderEvidenceBase(variant: "htgr" | "sfr" = "htgr"): void {
  const mef = createSeismicPraExample(variant);
  render(
    <SeismicPraWorkbookProvider mef={mef} linkedInputs={null} editable mutate={jest.fn()}>
      <EvidenceBaseScreen />
    </SeismicPraWorkbookProvider>,
  );
}

describe("Seismic PRA Step 02 qualified evidence base", () => {
  it("uses real public MHTGR records and truthful gaps for the HTGR example", () => {
    renderEvidenceBase("htgr");

    for (const evidence of [
      "MHTGR PRA model basis report",
      "MHTGR overall plant design specification",
      "MHTGR protection and instrumentation system design description",
      "MHTGR reactor cavity cooling system design description",
      "NRC MHTGR preapplication seismic design review",
      "Site-specific seismic design calculations",
      "Installed equipment seismic qualification register",
      "Site-specific geotechnical and geophysical investigation",
      "Validated operating and maintenance procedures",
      "As-built seismic walkdown and configuration reconciliation",
      "Non-LWR PRA standard seismic requirements",
      "NRC SSHAC implementation guidance",
    ]) {
      expect(screen.getAllByText(evidence).length).toBeGreaterThan(0);
    }

    expect(screen.queryByText("Generic HTGR baseline internal-events PRA model")).not.toBeInTheDocument();
    expect(screen.queryByText("Generic HTGR seismic hazard report")).not.toBeInTheDocument();
    expect(screen.queryByText("Generic HTGR seismic response and fragility calculations")).not.toBeInTheDocument();
    expect(screen.queryByText("Generic HTGR seismic equipment list")).not.toBeInTheDocument();
  });

  it("retains the seeded SFR source-evidence classes", () => {
    renderEvidenceBase("sfr");

    for (const evidence of [
      "Generic SFR baseline internal-events PRA model",
      "Generic SFR controlled design drawing package",
      "Generic SFR seismic design-basis calculations",
      "Generic SFR equipment seismic qualification register",
      "Generic SFR operating and maintenance procedure set",
      "Generic SFR seismic operating-experience review",
      "Generic SFR walkdown and configuration reconciliation",
    ]) {
      expect(screen.getAllByText(evidence).length).toBeGreaterThan(0);
    }
    expect(screen.queryByRole("link", { name: "Evidence guide" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "View evidence" })).not.toBeInTheDocument();
  });

  it("links the HTGR guide and source records without opening the record editor", async () => {
    renderEvidenceBase("htgr");

    expect(screen.getByRole("link", { name: "Evidence guide" })).toHaveAttribute(
      "href",
      "/api/example-documents/seismic-pra/mhtgr-evidence-guide",
    );
    expect(screen.getAllByRole("link", { name: "View evidence" })).toHaveLength(5);

    const praRow = screen.getAllByText("MHTGR PRA model basis report")[0]!.closest("tr");
    expect(praRow).not.toBeNull();
    const praLink = within(praRow as HTMLElement).getByRole("link", { name: "View evidence" });
    expect(praLink).toHaveAttribute("href", "/api/example-documents/seismic-pra/mhtgr-pra-model");
    expect(praLink.closest("td")).toBe(praRow!.querySelectorAll("td")[2]);
    await userEvent.click(praLink);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("keeps plain-language purpose and workflow guidance behind help controls", async () => {
    renderEvidenceBase();

    expect(screen.queryByRole("note")).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "About Source evidence" }));
    expect(screen.getByRole("note")).toHaveTextContent(
      "register the existing records that the Seismic PRA will rely on",
    );
    expect(screen.getByRole("note")).toHaveTextContent("For example");
    await userEvent.click(screen.getByRole("button", { name: "About Open evidence gaps" }));
    const notes = screen.getAllByRole("note");
    const gapNote = notes[notes.length - 1];
    expect(gapNote).toHaveTextContent(
      "source records are provisional, incomplete, or still need confirmation",
    );
    expect(gapNote).toHaveTextContent("For example");
  });

  it("puts the add action beside source evidence and opens one flat editor", async () => {
    renderEvidenceBase();

    const sourceHeading = screen.getByText("Source evidence").closest(".ssection__head");
    expect(sourceHeading).not.toBeNull();
    const addButton = within(sourceHeading as HTMLElement).getByRole("button", { name: "Add source evidence" });
    await userEvent.click(addButton);

    const dialog = screen.getByRole("dialog", { name: "New source evidence" });
    for (const field of [
      "Name",
      "Evidence type",
      "Source reference",
      "Revision",
      "Effective date",
      "Owner",
      "Applicable subelements",
      "Applicability",
      "Quality and limitations",
      "File reference",
      "Status",
    ]) {
      expect(within(dialog).getByText(field)).toBeInTheDocument();
    }
  });

  it("displays applicable subelement choices as technical acronyms", async () => {
    renderEvidenceBase();

    await userEvent.click(screen.getAllByText("MHTGR PRA model basis report")[0]!);
    const dialog = screen.getByRole("dialog", { name: "MHTGR PRA model basis report" });

    for (const acronym of ["SHA", "SFR", "SPR"]) {
      expect(within(dialog).getAllByRole("option", { name: acronym }).length).toBeGreaterThan(0);
    }
    expect(within(dialog).queryByRole("option", { name: "Sha" })).not.toBeInTheDocument();
    expect(within(dialog).queryByRole("option", { name: "Sfr" })).not.toBeInTheDocument();
    expect(within(dialog).queryByRole("option", { name: "Spr" })).not.toBeInTheDocument();
  });

  it("shows unresolved source limitations without mixing in later results", () => {
    renderEvidenceBase();

    expect(screen.getByText("Open evidence gaps")).toBeInTheDocument();
    expect(screen.getAllByText(/not a site-specific as-built drawing set/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/final supplier records.*unavailable/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/does not contain validated as-operated procedures/i).length).toBeGreaterThan(0);
  });
});
