import { JSX, KeyboardEvent, PointerEvent, useState } from "react";
import { useElementWidth } from "./daDistributionChart";
import { sciText } from "./daShared";

interface SurvivalSeries {
  key: string;
  label: string;
  values: number[];
}

const TOP = 18;
const PLOT_HEIGHT = 150;
const AXIS_BAND = 30;
const LEFT = 34;
const RIGHT = 16;

function probabilityText(value: number): string {
  return value >= 0.01 ? String(Number(value.toPrecision(3))) : sciText(value);
}

function hoursText(value: number): string {
  return value >= 0.01 && value < 1e5 ? `${Number(value.toPrecision(3))} h` : `${sciText(value)} h`;
}

function survivalGrid(window: number): number[] {
  const from = Math.log10(window / 200);
  const to = Math.log10(window * 5);
  const grid = Array.from({ length: 161 }, (_, index) => 10 ** (from + ((to - from) * index) / 160)).filter((value) => Math.abs(value - window) > 1e-9 * window);
  return [...grid, window].sort((a, b) => a - b);
}

function hourTicks(from: number, to: number): number[] {
  const ticks: number[] = [];
  for (let power = Math.floor(from); power <= Math.ceil(to); power += 1) {
    for (const step of [1, 3]) {
      const at = power + Math.log10(step);
      if (at >= from && at <= to) ticks.push(at);
    }
  }
  return ticks;
}

function SurvivalChart({ hours, series, window, subject }: { hours: readonly number[]; series: readonly SurvivalSeries[]; window: number; subject: string }): JSX.Element {
  const [ref, measured] = useElementWidth(560);
  const [cursor, setCursor] = useState<number | undefined>(undefined);
  const first = hours[0];
  const last = hours[hours.length - 1];
  if (series.length === 0 || first === undefined || last === undefined || !(first > 0) || !(last > first)) return <p className="posmuted">No curve to show yet.</p>;
  const width = Math.max(280, measured);
  const plotWidth = width - LEFT - RIGHT;
  const height = TOP + PLOT_HEIGHT + AXIS_BAND;
  const baseline = TOP + PLOT_HEIGHT;
  const from = Math.log10(first);
  const to = Math.log10(last);
  const scaleX = (value: number): number => LEFT + ((Math.log10(value) - from) / (to - from)) * plotWidth;
  const scaleY = (value: number): number => baseline - value * PLOT_HEIGHT;
  const path = (values: readonly number[]): string => values.map((value, index) => `${index === 0 ? "M" : "L"}${scaleX(hours[index] ?? first).toFixed(1)},${scaleY(Math.min(1, Math.max(0, value))).toFixed(1)}`).join(" ");
  const windowX = scaleX(window);
  const cursorX = cursor === undefined ? undefined : scaleX(10 ** cursor);
  const cursorFound = cursor === undefined ? -1 : hours.findIndex((value) => value >= 10 ** cursor);
  const cursorIndex = cursor === undefined ? undefined : cursorFound === -1 ? hours.length - 1 : cursorFound;
  const valueAt = (values: readonly number[], index: number): number | undefined => values[Math.min(values.length - 1, Math.max(0, index))];

  function moveTo(clientX: number, element: SVGSVGElement): void {
    const left = element.getBoundingClientRect().left;
    const at = from + ((clientX - left - LEFT) / plotWidth) * (to - from);
    setCursor(Math.min(to, Math.max(from, at)));
  }
  function onPointer(event: PointerEvent<SVGSVGElement>): void {
    moveTo(event.clientX, event.currentTarget);
  }
  function onKey(event: KeyboardEvent<SVGSVGElement>): void {
    const step = (to - from) / 50;
    const start = cursor ?? Math.log10(window);
    if (event.key === "ArrowRight") {
      event.preventDefault();
      setCursor(Math.min(to, start + step));
    } else if (event.key === "ArrowLeft") {
      event.preventDefault();
      setCursor(Math.max(from, start - step));
    } else if (event.key === "Escape") setCursor(undefined);
  }

  return (
    <div className="da-dist" ref={ref}>
      <svg
        className="da-dist__svg"
        width={width}
        height={height}
        style={{ width: "100%", height: "auto" }}
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={`Probability that ${subject} is not restored, against hours on a logarithmic axis, with the ${hoursText(window)} window marked`}
        tabIndex={0}
        onPointerMove={onPointer}
        onPointerDown={onPointer}
        onPointerLeave={() => setCursor(undefined)}
        onKeyDown={onKey}
        onBlur={() => setCursor(undefined)}
      >
        <text className="da-dist__caption" x={LEFT} y={11}>Probability not restored</text>
        {[0, 0.5, 1].map((value) => (
          <g key={value}>
            <line className="da-dist__tick" x1={LEFT - 4} x2={LEFT} y1={scaleY(value)} y2={scaleY(value)} />
            <text className="da-dist__ticklabel" x={LEFT - 7} y={scaleY(value) + 4} textAnchor="end">{value}</text>
          </g>
        ))}
        <line className="da-dist__axis" x1={LEFT} x2={LEFT} y1={TOP} y2={baseline} />
        {[...series].reverse().map((item, index) => (
          <path key={item.key} className={`da-dist__line${index === series.length - 1 ? " da-dist__line--focus" : ""}${item.key === "COMPARISON" ? " da-dist__line--dashed" : ""}`} d={path(item.values)} />
        ))}
        <line className="da-dist__cross" x1={windowX} x2={windowX} y1={TOP} y2={baseline} />
        <text className="da-dist__ticklabel" x={windowX + 4} y={TOP + 10}>window</text>
        <line className="da-dist__axis" x1={LEFT} x2={width - RIGHT} y1={baseline} y2={baseline} />
        {hourTicks(from, to).map((at) => (
          <g key={at}>
            <line className="da-dist__tick" x1={scaleX(10 ** at)} x2={scaleX(10 ** at)} y1={baseline} y2={baseline + 4} />
            <text className="da-dist__ticklabel" x={scaleX(10 ** at)} y={baseline + 17} textAnchor="middle">{hoursText(10 ** at)}</text>
          </g>
        ))}
        {cursorX !== undefined && <line className="da-dist__cross" x1={cursorX} x2={cursorX} y1={TOP} y2={baseline} />}
      </svg>
      {cursorX !== undefined && cursorIndex !== undefined && (
        <div className="da-dist__tip" style={{ left: `${Math.min(Math.max(cursorX + 12, 0), Math.max(0, width - 230))}px` }}>
          <div className="da-dist__tip-value">{hoursText(hours[cursorIndex] ?? first)}</div>
          {series.map((item, index) => {
            const value = valueAt(item.values, cursorIndex);
            return (
              <div key={item.key} className="da-dist__tip-row">
                <span className={`da-dist__key${index === 0 ? " da-dist__key--focus" : ""}${item.key === "COMPARISON" ? " da-dist__key--dashed" : ""}`} />
                <span className="da-dist__tip-share">{value === undefined ? "—" : probabilityText(value)}</span>
                <span>{series.length > 1 ? item.label : "not restored yet"}</span>
              </div>
            );
          })}
        </div>
      )}
      <ul className="da-dist__legend">
        {series.map((item, index) => {
          const at = item.values[hours.findIndex((value) => value >= window)];
          return (
            <li key={item.key}>
              <span className="da-dist__item">
                <span className={`da-dist__key${index === 0 ? " da-dist__key--focus" : ""}${item.key === "COMPARISON" ? " da-dist__key--dashed" : ""}`} />
                <span className="da-dist__item-label">{item.label}</span>
                <span className="da-dist__item-detail">{at === undefined ? "" : `${probabilityText(at)} not restored at ${hoursText(window)}`}</span>
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export { SurvivalChart, survivalGrid, type SurvivalSeries };
