import { fireEvent, render, screen, within } from "@testing-library/react";
import { PagedResults, ResultCsvButton, ResultNumber, formatResultNumber } from "../resultPresentation";
import { resultRecordsToCsv } from "../resultCsv";

describe("result presentation", () => {
  it.each([0, 1, 1e-7, 1e-15, 0.12345678901234568, 0.9999999])(
    "preserves the exact value %s alongside a readable display",
    (value) => {
      render(<ResultNumber value={value} />);
      const output = screen.getByRole("status");
      expect(output).toHaveAttribute("title", String(value));
      expect(Number(output.textContent)).toBeCloseTo(value, 12);
      if (value > 0) expect(output.textContent).not.toBe("0");
      if (value < 1) expect(output.textContent).not.toBe("1");
    },
  );

  it("uses source-style significant digits for rare probabilities", () => {
    expect(formatResultNumber(1e-7)).toBe("1e-7");
    expect(formatResultNumber(0.12345678901234568)).toBe("0.123456789012");
  });

  it("exports raw numbers, quoted multiline Unicode labels and blank missing values", () => {
    expect(
      resultRecordsToCsv([
        { label: 'Pump, "α"\nbackup', probability: 0.12345678901234568 },
        { label: "=SUM(A1:A2)", probability: 1e-15 },
        { label: "Failed", probability: null },
      ]),
    ).toBe(
      '\uFEFF"label","probability"\r\n"Pump, ""α""\nbackup","0.12345678901234568"\r\n"\'=SUM(A1:A2)","1e-15"\r\n"Failed",""\r\n',
    );
  });

  it("changes pages, resets for a new run, changes page size and clamps shrinking results", () => {
    const rows = Array.from({ length: 63 }, (_, index) => index + 1);
    const view = (items: number[], key: string) => (
      <PagedResults
        items={items}
        label="Examples"
        resetKey={key}
      >
        {(page) => (
          <ul>
            {page.map((row) => (
              <li key={row}>Result {row}</li>
            ))}
          </ul>
        )}
      </PagedResults>
    );
    const { rerender } = render(view(rows, "run-1"));
    expect(screen.getAllByRole("listitem")).toHaveLength(25);
    const nav = within(screen.getByRole("navigation", { name: "Examples pagination" }));
    expect(nav.getByRole("button", { name: "Previous" })).toBeDisabled();
    fireEvent.click(nav.getByRole("button", { name: "Next" }));
    expect(screen.getByText("Result 26")).toBeInTheDocument();
    fireEvent.click(nav.getByRole("button", { name: "Last" }));
    expect(screen.getAllByRole("listitem")).toHaveLength(13);
    expect(nav.getByRole("button", { name: "Next" })).toBeDisabled();
    rerender(view(rows, "run-2"));
    expect(screen.getByText("Result 1")).toBeInTheDocument();
    fireEvent.change(nav.getByLabelText("Rows per page"), { target: { value: "50" } });
    expect(screen.getAllByRole("listitem")).toHaveLength(50);
    fireEvent.click(nav.getByRole("button", { name: "Next" }));
    rerender(view(rows.slice(0, 3), "run-2"));
    expect(screen.getAllByRole("listitem")).toHaveLength(3);
    expect(screen.queryByRole("navigation")).not.toBeInTheDocument();
  });

  it("downloads all rows while another page is displayed, without rounding or mutating them", async () => {
    const rows = Array.from({ length: 63 }, (_, index) => ({ sequence: index + 1, probability: 1e-15 * (index + 1) }));
    const before = JSON.stringify(rows);
    let blob: Blob | undefined;
    const create = jest.fn((value: Blob) => {
      blob = value;
      return "blob:results";
    });
    const revoke = jest.fn();
    const oldCreate = URL.createObjectURL;
    const oldRevoke = URL.revokeObjectURL;
    URL.createObjectURL = create;
    URL.revokeObjectURL = revoke;
    const click = jest.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);
    try {
      render(
        <>
          <ResultCsvButton
            filename="all.csv"
            records={() => rows}
          />
          <PagedResults
            items={rows}
            label="Sequences"
            resetKey="run"
          >
            {(page) => (
              <ul>
                {page.map((row) => (
                  <li key={row.sequence}>{row.sequence}</li>
                ))}
              </ul>
            )}
          </PagedResults>
        </>,
      );
      fireEvent.click(screen.getByRole("button", { name: "Next" }));
      fireEvent.click(screen.getByRole("button", { name: "Export results CSV" }));
      expect(click.mock.instances[0]).toHaveAttribute("download", "all.csv");
      const text = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.readAsText(blob!);
      });
      expect(text.split("\r\n").filter(Boolean)).toHaveLength(64);
      expect(text).toContain('"1","1e-15"');
      expect(text).toContain(`"63","${String(rows[62]!.probability)}"`);
      expect(JSON.stringify(rows)).toBe(before);
    } finally {
      click.mockRestore();
      URL.createObjectURL = oldCreate;
      URL.revokeObjectURL = oldRevoke;
    }
  });

  it("shows empty results explicitly", () => {
    render(
      <PagedResults
        items={[]}
        label="Empty"
        resetKey="run"
      >
        {() => <p>Wrong</p>}
      </PagedResults>,
    );
    expect(screen.getByText("No result rows.")).toBeInTheDocument();
  });
});
