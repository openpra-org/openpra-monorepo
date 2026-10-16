import { useState } from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import type { UncertainExpression } from "interfaces-mef-types/core/uncertainty";
import type { HclUncertaintySettings } from "interfaces-mef-types/modeling";
import { HclUncertaintySettingsSchema } from "interfaces-mef-types/zod/modeling";
import type { HclFaultTreeOption } from "../hclBindingTypes";
import { HclBasicEventControls, basicEventKey, type HclBasicEventChoice } from "../hclUncertaintyControls";

const EVENT_A = "40000000-0000-4000-8000-000000000001";
const EVENT_B = "40000000-0000-4000-8000-000000000002";
const EVENT_C = "40000000-0000-4000-8000-000000000003";

const typed: UncertainExpression = { node: "VALUE", value: { unit: "PROBABILITY", law: { family: "POINT", value: 0.004 } } };
const linked: UncertainExpression = { node: "PARAMETER", reference: { referenceType: "WORKBOOK_PARAMETER", workbookId: "da-1", entityId: "DA-BE-7" } };

const tree: HclFaultTreeOption = {
  workbookId: "sy-1",
  workbookName: "Systems",
  modelId: "ft-1",
  modelCode: "FT-CCW",
  modelName: "Cooling water",
  topGateId: "top",
  basicEvents: [
    { id: EVENT_A, code: "CCW-PMP-A", name: "Pump A fails", syValue: { expression: typed, text: "0.004", daLinks: [] } },
    { id: EVENT_B, code: "CCW-PMP-B", name: "Pump B fails", syValue: { expression: linked, text: "DA · Pump fails", daLinks: ["DA · Pump fails"] } },
    { id: EVENT_C, code: "CCW-VLV", name: "Valve fails" },
  ],
  parameterOptions: [{ reference: { referenceType: "WORKBOOK_PARAMETER", workbookId: "da-1", entityId: "DA-BE-7" }, label: "Plant DA · Pump fails", unit: "PROBABILITY" }],
};

const choices: HclBasicEventChoice[] = tree.basicEvents.map((event) => ({ key: basicEventKey(tree.workbookId, event.id), tree, event }));

const empty: HclUncertaintySettings = { sampleCount: 100, seed: 7, sampler: "MC", basicEvents: [], cptRows: [], cptGenerators: [] };

function Harness({ changed, editable = true, initial = empty }: { changed: jest.Mock; editable?: boolean; initial?: HclUncertaintySettings }) {
  const [settings, setSettings] = useState(initial);
  return <HclBasicEventControls choices={choices} settings={settings} editable={editable} onError={jest.fn()} onChange={(next) => { setSettings(next); changed(next); }} />;
}

function commit(input: HTMLElement, value: string): void {
  fireEvent.focus(input);
  fireEvent.change(input, { target: { value } });
  fireEvent.blur(input);
}

it("labels the events that take their SY value and their DA link", () => {
  render(<Harness changed={jest.fn()} />);
  fireEvent.click(screen.getByText("Events that take their SY value"));
  const list = screen.getByText("Events that take their SY value").closest("details")!;
  expect(within(list).getByText("FT-CCW / CCW-PMP-A").closest("li")).toHaveTextContent("Takes its Systems Analysis value, 0.004.");
  expect(within(list).getByText("FT-CCW / CCW-PMP-B").closest("li")).toHaveTextContent("Linked to DA DA · Pump fails.");
  expect(within(list).getByText("FT-CCW / CCW-VLV").closest("li")).toHaveTextContent("Takes its Systems Analysis value.");
});

it("starts an override from a typed SY value, edits it as a law and deletes it", () => {
  const changed = jest.fn();
  render(<Harness changed={changed} />);
  fireEvent.click(screen.getByRole("button", { name: "Add override" }));
  const added: HclUncertaintySettings = changed.mock.lastCall[0];
  expect(added.basicEvents).toEqual([{ faultTreeBasicEvent: { referenceType: "FAULT_TREE_BASIC_EVENT", workbookId: "sy-1", entityId: EVENT_A }, expression: typed }]);
  expect(screen.getByRole("combobox", { name: "Basic event to override" })).toHaveValue(basicEventKey("sy-1", EVENT_B));

  fireEvent.click(screen.getByText("Overrides"));
  const item = screen.getByText("FT-CCW / CCW-PMP-A").closest("details")!;
  commit(within(item).getByRole("textbox", { name: "Value" }), "0.006");
  expect(changed.mock.lastCall[0].basicEvents[0].expression).toEqual({ node: "VALUE", value: { unit: "PROBABILITY", law: { family: "POINT", value: 0.006 } } });
  fireEvent.change(within(item).getByRole("combobox", { name: "Law" }), { target: { value: "LOGNORMAL" } });
  const lognormal: HclUncertaintySettings = changed.mock.lastCall[0];
  expect(lognormal.basicEvents[0]?.expression).toEqual({ node: "VALUE", value: { unit: "PROBABILITY", law: { family: "LOGNORMAL", mean: 0.006, errorFactor: 3, level: 0.95 } } });
  expect(HclUncertaintySettingsSchema.safeParse(lognormal).success).toBe(true);
  expect(item.querySelector(".hcleditor__uncertainty-family")).toHaveTextContent("Lognormal (mean 6.00E-3, EF 3)");

  fireEvent.click(within(item).getByRole("button", { name: "Delete" }));
  expect(changed.mock.lastCall[0].basicEvents).toEqual([]);
});

it("keeps the DA link of the SY value and links a typed override to DA", () => {
  const changed = jest.fn();
  render(<Harness changed={changed} />);
  fireEvent.change(screen.getByRole("combobox", { name: "Basic event to override" }), { target: { value: basicEventKey("sy-1", EVENT_B) } });
  fireEvent.click(screen.getByRole("button", { name: "Add override" }));
  expect(changed.mock.lastCall[0].basicEvents[0].expression).toEqual(linked);
  fireEvent.click(screen.getByRole("button", { name: "Add override" }));
  fireEvent.click(screen.getByText("Overrides"));
  const item = screen.getByText("FT-CCW / CCW-PMP-A").closest("details")!;
  fireEvent.change(within(item).getByRole("combobox", { name: "Source" }), { target: { value: "da-1:DA-BE-7" } });
  const settings: HclUncertaintySettings = changed.mock.lastCall[0];
  expect(settings.basicEvents.find((entry) => entry.faultTreeBasicEvent.entityId === EVENT_A)?.expression).toEqual(linked);
  expect(HclUncertaintySettingsSchema.safeParse(settings).success).toBe(true);
});

it("shows overrides without edits in read-only mode", () => {
  render(<Harness changed={jest.fn()} editable={false} initial={{ ...empty, basicEvents: [{ faultTreeBasicEvent: { referenceType: "FAULT_TREE_BASIC_EVENT", workbookId: "sy-1", entityId: EVENT_C }, expression: typed }] }} />);
  expect(screen.queryByRole("button")).not.toBeInTheDocument();
  fireEvent.click(screen.getByText("Overrides"));
  expect(screen.getByRole("textbox", { name: "Value" })).toBeDisabled();
});
