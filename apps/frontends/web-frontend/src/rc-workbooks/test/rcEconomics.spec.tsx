import { readFileSync } from "fs";
import { resolve } from "path";
import { useState } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { createBlankRc } from "../../../../../backends/web-backend/src/rc-workbooks/blank-rc";
import { createPublishedRcSeed } from "../../../../../backends/web-backend/src/example-workbooks/seeds/rc-published-inputs-seed";
import { RcWorkbookProvider, type RcWorkbookData } from "../rcWorkbookContext";
import { RcEconomicsPanel } from "../rcEconomics";

it("imports the published site excerpt and shows only its supplied economic rows", async () => {
  const filename = "SecPop-Noah-published-site-excerpt.txt";
  const original = readFileSync(resolve(__dirname, "../../../../../backends/web-backend/example-documents/RC-Published-Inputs", filename), "utf8");
  const initial = createBlankRc("Economics", "analyst"), openEditor = jest.fn();
  function Harness() {
    const [rc, setRc] = useState(initial);
    return <RcWorkbookProvider data={{ rc, cc: {}, nms: [] } as unknown as RcWorkbookData} editable mutateRc={update => setRc(previous => update(previous))}>
      <RcEconomicsPanel openEditor={openEditor} />
      <output aria-label="Supplied regional rows">{rc.economicFactors.siteEconomyInput?.regions.length ?? 0}</output>
    </RcWorkbookProvider>;
  }
  render(<Harness />);
  const file = new File([original], filename, { type: "text/plain" });
  Object.defineProperty(file, "text", { value: async () => original });
  fireEvent.change(screen.getByLabelText("Import site economy file"), { target: { files: [file] } });
  await waitFor(() => expect(screen.getByLabelText("Supplied regional rows")).toHaveTextContent("2"));
  expect(screen.getByText("2 of 83")).toBeInTheDocument();
  expect(screen.getByRole("table", { name: "Regional economic data" })).toHaveTextContent("MIX_CNTY83");
  expect(screen.getByRole("table", { name: "Crop seasons and shares" })).toHaveTextContent("PASTURE");
  fireEvent.click(screen.getByRole("button", { name: "View file" }));
  expect(screen.getByLabelText("Original site economy file")).toHaveTextContent("REGIONAL ECONOMIC DATA");
  fireEvent.click(screen.getByRole("tab", { name: "Cost model" }));
  fireEvent.click(screen.getByRole("tab", { name: "Review" }));
  expect(screen.getByLabelText("Parameter values and site coverage reviewed")).toBeDisabled();
  fireEvent.click(screen.getByRole("tab", { name: "Cost model" }));
  fireEvent.click(screen.getByRole("button", { name: "Add parameter" }));
  expect(openEditor).toHaveBeenCalledWith("costparam", "0");
  expect(screen.getByRole("table", { name: "Cost parameters" })).toHaveTextContent("EVACST");
});

it("reuses the original Step 02 site file", async () => {
  const original = readFileSync(resolve(__dirname, "../../../../../backends/web-backend/example-documents/RC-Published-Inputs/SecPop-Noah-published-site-excerpt.txt"), "utf8");
  const initial = createPublishedRcSeed();
  initial.economicFactors.siteEconomyInput = undefined;
  const readOriginal = jest.fn().mockResolvedValue(original);
  function Harness() {
    const [rc, setRc] = useState(initial);
    return <RcWorkbookProvider data={{ rc, cc: {}, nms: [] } as unknown as RcWorkbookData} editable mutateRc={update => setRc(previous => update(previous))}
      siteReceptors={{ readOriginal } as any}>
      <RcEconomicsPanel openEditor={jest.fn()} />
      <output aria-label="Site file revision">{rc.economicFactors.siteEconomyInput?.sourceSiteRevision ?? "none"}</output>
    </RcWorkbookProvider>;
  }
  render(<Harness />);
  fireEvent.click(screen.getByRole("button", { name: "Use Step 02 site file" }));
  await waitFor(() => expect(screen.getByLabelText("Site file revision")).toHaveTextContent(String(initial.protectiveActionParameters.siteAndReceptors!.revision)));
  expect(readOriginal).toHaveBeenCalledWith(initial.protectiveActionParameters.siteAndReceptors!.geometryFile!.documentId);
  expect(screen.getByText("2 of 83")).toBeInTheDocument();
});
