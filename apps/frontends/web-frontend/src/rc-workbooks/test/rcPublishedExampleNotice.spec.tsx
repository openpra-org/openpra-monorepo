import { fireEvent, render, screen } from "@testing-library/react";
import { LoadExampleModal } from "../../workbooks/exampleWorkbookModal";
it("shows the published-data notice only for the published RC example", () => {
  render(<LoadExampleModal exampleName="RC" exampleOptions={[{ id: "generic", label: "Generic" }, { id: "published-rc-inputs", label: "Published RC inputs" }]} choiceLabel="Example" exampleNotices={{ "published-rc-inputs": "Numerical values are from cited published files." }} onCancel={jest.fn()} onConfirm={jest.fn()} />);
  expect(screen.getByText("LLM-generated")).toBeInTheDocument();
  fireEvent.change(screen.getByRole("combobox"), { target: { value: "published-rc-inputs" } });
  expect(screen.queryByText("LLM-generated")).not.toBeInTheDocument();
  expect(screen.getByText(/Numerical values are from cited published files\./)).toBeInTheDocument();
  fireEvent.change(screen.getByRole("combobox"), { target: { value: "generic" } });
  expect(screen.getByText("LLM-generated")).toBeInTheDocument();
});
