import { render, screen } from "@testing-library/react";
import { WorkbookSaveIndicator } from "../workbookSaveIndicator";

describe("workbook save indicator", () => {
  test("renders every save state with an accessible live status", () => {
    const { rerender } = render(<WorkbookSaveIndicator status="saving" workbookVersion="3" />);

    expect(screen.getByRole("status")).toHaveTextContent("Saving · v3");

    rerender(<WorkbookSaveIndicator status="saved" workbookVersion="3" />);
    expect(screen.getByRole("status")).toHaveTextContent("Saved · v3");

    rerender(<WorkbookSaveIndicator status="failed" workbookVersion="3" />);
    expect(screen.getByRole("status")).toHaveTextContent("Save failed · v3");
  });
});
