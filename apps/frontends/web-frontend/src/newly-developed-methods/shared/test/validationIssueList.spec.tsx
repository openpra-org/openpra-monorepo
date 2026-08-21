import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ValidationIssue } from "interfaces-shared-types";
import { ValidationIssueList } from "../validationIssueList";

const ENTITY_ID = "123e4567-e89b-42d3-a456-426614174020";

const issue: ValidationIssue = {
  code: "FT_NODE_LABEL_MISSING",
  severity: "ERROR",
  message: "Add a label",
  entityId: ENTITY_ID,
  fieldPath: ["gates", 0, "name"],
};

describe("ValidationIssueList", () => {
  let animationFrameSpy: jest.SpyInstance;

  beforeEach(() => {
    animationFrameSpy = jest.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
      callback(0);
      return 1;
    });
  });

  afterEach(() => {
    animationFrameSpy.mockRestore();
  });

  it("selects the affected entity and focuses its field", async () => {
    const onSelectEntity = jest.fn();
    const field = document.createElement("input");
    const entity = document.createElement("button");
    const scrollIntoView = jest.fn();
    field.scrollIntoView = scrollIntoView;
    document.body.append(field, entity);

    render(
      <ValidationIssueList
        issues={[issue]}
        onSelectEntity={onSelectEntity}
        resolveEntityTarget={() => entity}
        resolveFieldTarget={() => field}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: /add a label/i }));

    expect(onSelectEntity).toHaveBeenCalledWith(ENTITY_ID);
    expect(field).toHaveFocus();
    expect(scrollIntoView).toHaveBeenCalledWith({ block: "nearest" });
  });

  it("falls back to the affected node when no field target is available", async () => {
    const entity = document.createElement("div");
    const scrollIntoView = jest.fn();
    entity.scrollIntoView = scrollIntoView;
    document.body.append(entity);

    render(
      <ValidationIssueList
        issues={[issue]}
        onSelectEntity={jest.fn()}
        resolveEntityTarget={() => entity}
        resolveFieldTarget={() => null}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: /add a label/i }));

    expect(entity).toHaveFocus();
    expect(entity).toHaveAttribute("tabindex", "-1");
    expect(scrollIntoView).toHaveBeenCalledWith({ block: "nearest" });
  });

  it("focuses the entity directly for an entity-level issue", async () => {
    const entity = document.createElement("button");
    document.body.append(entity);
    const resolveFieldTarget = jest.fn();

    render(
      <ValidationIssueList
        issues={[{ ...issue, fieldPath: [] }]}
        onSelectEntity={jest.fn()}
        resolveEntityTarget={() => entity}
        resolveFieldTarget={resolveFieldTarget}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: /add a label/i }));

    expect(resolveFieldTarget).not.toHaveBeenCalled();
    expect(entity).toHaveFocus();
  });
});
