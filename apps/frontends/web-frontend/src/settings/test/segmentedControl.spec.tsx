import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SegmentedControl } from "../segmentedControl";

describe("SegmentedControl", () => {
  it("marks the active option with aria-checked=true", () => {
    render(
      <SegmentedControl
        ariaLabel="Density"
        value="compact"
        onChange={() => undefined}
        options={[{ id: "comfortable", label: "Comfortable" }, { id: "compact", label: "Compact" }]}
      />,
    );
    expect(screen.getByRole("radio", { name: /comfortable/i })).toHaveAttribute("aria-checked", "false");
    expect(screen.getByRole("radio", { name: /compact/i })).toHaveAttribute("aria-checked", "true");
  });

  it("invokes onChange with the chosen id", async () => {
    const onChange = jest.fn();
    render(
      <SegmentedControl
        ariaLabel="Density"
        value="comfortable"
        onChange={onChange}
        options={[{ id: "comfortable", label: "Comfortable" }, { id: "compact", label: "Compact" }]}
      />,
    );
    await userEvent.click(screen.getByRole("radio", { name: /compact/i }));
    expect(onChange).toHaveBeenCalledWith("compact");
  });
});
