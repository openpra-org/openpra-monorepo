import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ProjectsToolbar } from "../projectsToolbar";

function setup(overrides: Partial<Parameters<typeof ProjectsToolbar>[0]> = {}) {
  const props: Parameters<typeof ProjectsToolbar>[0] = {
    query: "",
    setQuery: jest.fn(),
    modeFilter: "all",
    setModeFilter: jest.fn(),
    sort: "edited-desc",
    setSort: jest.fn(),
    view: "grid",
    setView: jest.fn(),
    showArchived: false,
    setShowArchived: jest.fn(),
    archivedCount: 0,
    ...overrides,
  };
  render(<ProjectsToolbar {...props} />);
  return props;
}

describe("ProjectsToolbar", () => {
  it("calls setQuery as the user types", async () => {
    const props = setup();
    await userEvent.type(screen.getByPlaceholderText(/search projects/i), "x");
    expect(props.setQuery).toHaveBeenCalledWith("x");
  });

  it("renders 'All modes' plus all four risk-mode chips", () => {
    setup();
    expect(screen.getByRole("button", { name: /^all modes$/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^internal events$/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^internal hazards$/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^external hazards$/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^full scope$/i })).toBeInTheDocument();
  });

  it("calls setModeFilter when a mode chip is clicked", async () => {
    const props = setup();
    await userEvent.click(screen.getByRole("button", { name: /^full scope$/i }));
    expect(props.setModeFilter).toHaveBeenCalledWith("full-scope");
  });

  it("disables the Archived toggle when count is 0", () => {
    setup({ archivedCount: 0 });
    expect(screen.getByRole("button", { name: /^archived$/i })).toBeDisabled();
  });

  it("enables the Archived toggle and shows its count when count > 0", () => {
    setup({ archivedCount: 3 });
    const btn = screen.getByRole("button", { name: /^archived 3$/i });
    expect(btn).toBeEnabled();
  });

  it("shows the clear button only when there is a query", async () => {
    const { rerender } = render(
      <ProjectsToolbar
        query=""
        setQuery={jest.fn()}
        modeFilter="all"
        setModeFilter={jest.fn()}
        sort="edited-desc"
        setSort={jest.fn()}
        view="grid"
        setView={jest.fn()}
        showArchived={false}
        setShowArchived={jest.fn()}
        archivedCount={0}
      />,
    );
    expect(screen.queryByRole("button", { name: /clear search/i })).not.toBeInTheDocument();

    const setQuery = jest.fn();
    rerender(
      <ProjectsToolbar
        query="abc"
        setQuery={setQuery}
        modeFilter="all"
        setModeFilter={jest.fn()}
        sort="edited-desc"
        setSort={jest.fn()}
        view="grid"
        setView={jest.fn()}
        showArchived={false}
        setShowArchived={jest.fn()}
        archivedCount={0}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: /clear search/i }));
    expect(setQuery).toHaveBeenCalledWith("");
  });
});
