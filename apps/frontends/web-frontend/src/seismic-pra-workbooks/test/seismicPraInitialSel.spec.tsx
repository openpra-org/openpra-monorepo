import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createSeismicPraExample } from "../../../../../backends/web-backend/src/example-workbooks/seeds/seismic-pra-seed-factory";
import { InitialSelScreen } from "../seismicPraScreens";
import { SeismicPraWorkbookProvider, type SeismicPraVariant } from "../seismicPraWorkbookContext";

function renderInitialSel(variant: SeismicPraVariant = "htgr", mutate = jest.fn()): ReturnType<typeof jest.fn> {
  render(
    <SeismicPraWorkbookProvider
      mef={createSeismicPraExample(variant)}
      linkedInputs={null}
      editable
      mutate={mutate}
    >
      <InitialSelScreen />
    </SeismicPraWorkbookProvider>,
  );
  return mutate;
}

describe("Seismic PRA Step 04 initial SEL", () => {
  it.each([
    ["htgr", "Helium circulator HC-1", "Service-water header above electrical rooms", "Unit auxiliary transformer", "SEL-HTGR-RTS-CABINET"],
    ["sfr", "Primary sodium pump P-1", "Service-water header in electrical building", "Intermediate heat exchanger IHX-A", "SEL-SFR-RTS-CABINET"],
  ] as const)(
    "shows multidisciplinary SSC scope and failure consequences for %s",
    (variant, activeSsc, floodSource, fireSource, relayCabinetRef) => {
      renderInitialSel(variant);

      expect(screen.getByRole("heading", { name: "Initial seismic equipment list" })).toBeInTheDocument();
      expect(screen.getByRole("heading", { name: "Failure consequences" })).toBeInTheDocument();
      expect(screen.getAllByText(activeSsc).length).toBeGreaterThan(0);
      expect(screen.getAllByText(floodSource).length).toBeGreaterThan(0);
      expect(screen.getAllByText(fireSource).length).toBeGreaterThan(0);
      expect(screen.getAllByText(new RegExp(relayCabinetRef)).length).toBeGreaterThan(0);
      expect(screen.getByRole("columnheader", { name: "Credited function" })).toBeInTheDocument();
      expect(screen.getByRole("columnheader", { name: "Included from" })).toBeInTheDocument();
      expect(screen.getByRole("columnheader", { name: "Plant-model consequence" })).toBeInTheDocument();
      expect(screen.getByRole("columnheader", { name: "Basic event" })).toBeInTheDocument();
      expect(screen.getByRole("columnheader", { name: "Correlation group" })).toBeInTheDocument();
    },
  );

  it("keeps the initial-SEL explanation behind the help control", async () => {
    renderInitialSel();
    const explanation = "This is the first controlled list of SSCs that may matter to seismic risk. It begins with the baseline systems model, then adds structures, passive components, relays, cabinets, fire and flood sources, secondary-hazard SSCs, and operator-support equipment.";

    expect(screen.queryByText(explanation)).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "About Initial seismic equipment list" }));
    expect(screen.getByText(explanation)).toBeInTheDocument();
  });

  it("opens one flat SSC editor without downstream fragility-result fields", async () => {
    renderInitialSel();
    await userEvent.click(screen.getAllByText("Helium circulator HC-1")[0]!);

    const dialog = screen.getByRole("dialog", { name: "Helium circulator HC-1" });
    for (const label of [
      "System reference",
      "Parent structure or cabinet",
      "Building",
      "Mounting and anchorage",
      "Credited functions",
      "Source model references",
      "Failure mode 1",
      "Failure effect",
      "Disposition",
      "Correlation groups",
      "Disposition basis",
    ]) {
      expect(within(dialog).getAllByLabelText(new RegExp(`^${label}`)).length).toBeGreaterThan(0);
    }
    expect(screen.getAllByRole("dialog")).toHaveLength(1);
    expect(within(dialog).queryByLabelText("Fragility reference")).not.toBeInTheDocument();
    expect(within(dialog).queryByLabelText("Fragility mechanisms")).not.toBeInTheDocument();
  });

  it("keeps the SSC add action in the section header and removes the SEL-basis control", () => {
    renderInitialSel();
    const section = screen.getByRole("heading", { name: "Initial seismic equipment list" }).closest(".ssection");
    const sectionHeader = section?.querySelector(".ssection__head");

    expect(sectionHeader).not.toBeNull();
    expect(within(sectionHeader as HTMLElement).getByRole("button", { name: "Add SSC" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Edit initial SEL basis$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Selection inputs and checks" })).not.toBeInTheDocument();
  });
});
