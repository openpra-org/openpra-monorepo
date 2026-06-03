import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RenameModal } from "../renameModal";

const setup = () => userEvent.setup({ delay: null });

describe("RenameModal", () => {
  it("focuses the input and pre-fills with the current name", async () => {
    render(
      <RenameModal
        initialName="Old Name"
        onCancel={() => undefined}
        onSubmit={() => undefined}
        pending={false}
      />,
    );
    const input = await screen.findByLabelText(/project name/i) as HTMLInputElement;
    expect(input.value).toBe("Old Name");
  });

  it("rejects names shorter than 3 characters", async () => {
    const user = setup();
    const onSubmit = jest.fn();
    render(
      <RenameModal
        initialName="Old Name"
        onCancel={() => undefined}
        onSubmit={onSubmit}
        pending={false}
      />,
    );
    const input = await screen.findByLabelText(/project name/i);
    await user.clear(input);
    await user.type(input, "xy");
    await user.click(screen.getByRole("button", { name: /save/i }));
    expect(await screen.findByText(/must be at least 3 characters/i)).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("calls onSubmit with the trimmed new name when the form is valid", async () => {
    const user = setup();
    const onSubmit = jest.fn();
    render(
      <RenameModal
        initialName="Old Name"
        onCancel={() => undefined}
        onSubmit={onSubmit}
        pending={false}
      />,
    );
    const input = await screen.findByLabelText(/project name/i);
    await user.clear(input);
    await user.type(input, "  New Title  ");
    await user.click(screen.getByRole("button", { name: /save/i }));
    expect(onSubmit).toHaveBeenCalledWith("New Title");
  });

  it("closes without calling onSubmit when the name is unchanged", async () => {
    const user = setup();
    const onSubmit = jest.fn();
    const onCancel = jest.fn();
    render(
      <RenameModal
        initialName="Same Name"
        onCancel={onCancel}
        onSubmit={onSubmit}
        pending={false}
      />,
    );
    await user.click(screen.getByRole("button", { name: /save/i }));
    expect(onSubmit).not.toHaveBeenCalled();
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});
