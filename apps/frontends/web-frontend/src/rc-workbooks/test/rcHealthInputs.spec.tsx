import { readFileSync } from "fs";
import { resolve } from "path";
import { useState } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { createBlankRc } from "../../../../../backends/web-backend/src/rc-workbooks/blank-rc";
import { RcWorkbookProvider, type RcWorkbookData } from "../rcWorkbookContext";
import { RcHealthPanel } from "../rcHealthInputs";

it("imports published health cards and uses the selected effects", async () => {
  const filename = "MACCS-Noah-health-settings-excerpt.inp";
  const original = readFileSync(resolve(__dirname, "../../../../../backends/web-backend/example-documents/RC-Published-Inputs", filename), "utf8");
  const initial = createBlankRc("Health inputs", "analyst");
  function Harness() {
    const [rc, setRc] = useState(initial);
    return <RcWorkbookProvider data={{ rc, cc: {}, nms: [] } as unknown as RcWorkbookData} editable mutateRc={update => setRc(previous => update(previous))}>
      <RcHealthPanel openEditor={jest.fn()} />
      <output aria-label="Selected early effects">{rc.healthEffects.earlyHealthEffects.join(", ")}</output>
    </RcWorkbookProvider>;
  }
  render(<Harness />);
  const file = new File([original], filename, { type: "text/plain" });
  Object.defineProperty(file, "text", { value: async () => original });
  fireEvent.change(screen.getByLabelText("Import health parameter file"), { target: { files: [file] } });
  await waitFor(() => expect(screen.getByRole("table", { name: "Early injury" })).toBeInTheDocument());
  expect(screen.getByRole("table", { name: "Latent cancer" })).toHaveTextContent("0.0111 /Sv");
  expect(screen.getByLabelText("Use A-RED MARR fatality")).toBeChecked();
  expect(screen.getByLabelText("Use PRODROMAL VOMIT")).not.toBeChecked();
  fireEvent.click(screen.getByLabelText("Use PRODROMAL VOMIT"));
  expect(screen.getByLabelText("Selected early effects")).toHaveTextContent("PRODROMAL VOMIT");
  fireEvent.click(screen.getByRole("button", { name: "View file" }));
  expect(screen.getByLabelText("Original health parameter file")).toHaveTextContent("EFATAGRP001");
});
