import { render, screen } from "@testing-library/react";
import { ModelsScreen } from "../syScreens";

jest.mock("../syWorkbookContext", () => ({
  useSyWorkbook: () => ({
    sy: { systemDefinitions: [] },
    shortOf: (id: string) => id,
  }),
}));

describe("ModelsScreen", () => {
  it("shows an empty state when a new workbook has no system definitions", () => {
    render(<ModelsScreen sysId="" setSysId={jest.fn()} openDrawer={jest.fn()} />);

    expect(screen.getByText("No systems have been added to this workbook yet.")).toBeInTheDocument();
    expect(screen.getByText("Add or import a system definition before building its fault-tree logic model.")).toBeInTheDocument();
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
  });
});
