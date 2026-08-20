import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { WorkbookInput, WorkbookTextarea } from "../commitOnDeactivateFields";

describe("commit-on-deactivation workbook fields", () => {
  test("keeps text keystrokes local and commits the final value once on blur", async () => {
    const user = userEvent.setup();
    const onChange = jest.fn();
    render(
      <>
        <WorkbookInput aria-label="Name" value="Pump" onChange={onChange} />
        <button type="button">Next field</button>
      </>,
    );

    const input = screen.getByRole("textbox", { name: "Name" });
    await user.click(input);
    await user.type(input, " house cooling train");

    expect(input).toHaveValue("Pump house cooling train");
    expect(onChange).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Next field" }));

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange.mock.calls[0][0].target.value).toBe("Pump house cooling train");
  });

  test("does not commit an unchanged field", async () => {
    const user = userEvent.setup();
    const onChange = jest.fn();
    render(
      <>
        <WorkbookTextarea aria-label="Basis" value="Walkdown confirmed" onChange={onChange} />
        <button type="button">Outside</button>
      </>,
    );

    await user.click(screen.getByRole("textbox", { name: "Basis" }));
    await user.click(screen.getByRole("button", { name: "Outside" }));

    expect(onChange).not.toHaveBeenCalled();
  });

  test("keeps a dirty draft when an earlier server response changes the external value", async () => {
    const user = userEvent.setup();

    function Harness(): JSX.Element {
      const [value, setValue] = useState("Original");
      return (
        <>
          <WorkbookInput aria-label="Description" value={value} onChange={(event) => setValue(event.target.value)} />
          <button type="button" onMouseDown={() => setValue("Earlier server response")}>Outside</button>
          <output>{value}</output>
        </>
      );
    }

    render(<Harness />);
    const input = screen.getByRole("textbox", { name: "Description" });
    await user.click(input);
    await user.clear(input);
    await user.type(input, "Final analyst entry");
    await user.click(screen.getByRole("button", { name: "Outside" }));

    expect(screen.getByText("Final analyst entry")).toBeInTheDocument();
  });

  test("keeps checkbox changes immediate", async () => {
    const user = userEvent.setup();
    const onChange = jest.fn();
    render(<WorkbookInput aria-label="Approved" type="checkbox" checked={false} onChange={onChange} />);

    await user.click(screen.getByRole("checkbox", { name: "Approved" }));

    expect(onChange).toHaveBeenCalledTimes(1);
  });

  test("updates a local editor draft before an explicit save button runs", async () => {
    const user = userEvent.setup();
    const onSave = jest.fn();

    function Editor(): JSX.Element {
      const [draft, setDraft] = useState("Existing basis");
      return (
        <>
          <WorkbookTextarea aria-label="Analysis basis" value={draft} onChange={(event) => setDraft(event.target.value)} />
          <button type="button" onClick={() => onSave(draft)}>Save changes</button>
        </>
      );
    }

    render(<Editor />);
    const field = screen.getByRole("textbox", { name: "Analysis basis" });
    await user.clear(field);
    await user.type(field, "Updated plant-specific basis");
    await user.click(screen.getByRole("button", { name: "Save changes" }));

    expect(onSave).toHaveBeenCalledWith("Updated plant-specific basis");
  });
});
