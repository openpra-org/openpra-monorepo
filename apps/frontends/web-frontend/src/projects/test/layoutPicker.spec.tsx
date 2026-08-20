import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LayoutPicker } from "../layoutPicker";

describe("LayoutPicker", () => {
  it("marks the selected layout's radio as checked", () => {
    render(<LayoutPicker value="modern" onChange={jest.fn()} />);
    const modern = screen.getByRole("radio", { name: /modern/i });
    const legacy = screen.getByRole("radio", { name: /legacy/i });
    expect(modern).toBeChecked();
    expect(legacy).not.toBeChecked();
  });

  it("invokes onChange with the picked layout", async () => {
    const onChange = jest.fn();
    render(<LayoutPicker value="modern" onChange={onChange} />);
    await userEvent.click(screen.getByRole("radio", { name: /legacy/i }));
    expect(onChange).toHaveBeenCalledWith("legacy");
  });
});
