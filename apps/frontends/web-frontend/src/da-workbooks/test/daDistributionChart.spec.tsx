import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DistributionType } from "interfaces-mef-types/core/events";
import { DistributionChart } from "../daDistributionChart";

function tickLabels(container: HTMLElement): string[] {
  return [...container.querySelectorAll(".da-dist__ticklabel")].map((tick) => tick.textContent ?? "");
}

describe("DistributionChart", () => {
  it("draws a wide lognormal on a log axis with its 90% band and mean", () => {
    const { container } = render(<DistributionChart series={[{ key: "A", label: "ALR-NR-I", detail: "", distribution: { type: DistributionType.LOGNORMAL, median: 1.126e-5, errorFactor: 10 } }]} unit="per hour" />);
    expect(container.querySelector(".da-dist__caption")?.textContent).toBe("Density per decade");
    expect(tickLabels(container)).toEqual(expect.arrayContaining(["1E-6", "1E-5", "1E-4"]));
    expect(container.querySelector("path.da-dist__band")).not.toBeNull();
    expect(container.querySelectorAll("circle.da-dist__dot")).toHaveLength(1);
    expect(screen.getByText(/^Mean 3E-5 · 5th 1.13E-6 · median 1.13E-5 · 95th 1.13E-4 · per hour$/)).toBeInTheDocument();
  });

  it("uses one plain number style on a linear axis that crosses zero", () => {
    const { container } = render(<DistributionChart series={[{ key: "N", label: "EDG-EPS", detail: "", distribution: { type: DistributionType.NORMAL, mean: 0.0151, stdDev: 0.00704 } }]} unit="fraction" />);
    expect(container.querySelector(".da-dist__caption")?.textContent).toBe("Density");
    expect(tickLabels(container)).toEqual(expect.arrayContaining(["0", "0.01", "0.02"]));
    expect(tickLabels(container).some((label) => label.includes("E"))).toBe(false);
  });

  it("draws a point value as a spike and reports the share below the cursor", () => {
    const { container } = render(<DistributionChart series={[{ key: "P", label: "MLE", detail: "", distribution: { type: DistributionType.POINT_ESTIMATE, value: 0.0055 } }]} unit="probability" />);
    expect(container.querySelectorAll("line.da-dist__line")).toHaveLength(1);
    expect(screen.getByText("Point value 5.5E-3 · probability")).toBeInTheDocument();
    const svg = container.querySelector("svg.da-dist__svg");
    if (svg === null) throw new Error("no chart");
    fireEvent.keyDown(svg, { key: "ArrowRight" });
    expect(container.querySelector(".da-dist__tip-share")?.textContent).toBe("100.0%");
  });

  it("lists every series and moves the focus from the legend", async () => {
    const onFocus = jest.fn();
    render(
      <DistributionChart
        series={[
          { key: "U-1", label: "SRC-01 · CTG-FTS", detail: "Prior", distribution: { type: DistributionType.BETA, alpha: 21.5, betaParam: 1012 } },
          { key: "U-2", label: "SRC-01 · EDG-FTS", detail: "Rejected", distribution: { type: DistributionType.BETA, alpha: 2.15, betaParam: 1045 } },
        ]}
        focusKey="U-1"
        unit="per demand"
        onFocus={onFocus}
      />,
    );
    expect(screen.getByRole("button", { name: /CTG-FTS/ })).toHaveAttribute("aria-pressed", "true");
    await userEvent.click(screen.getByRole("button", { name: /EDG-FTS/ }));
    expect(onFocus).toHaveBeenCalledWith("U-2");
  });
});
