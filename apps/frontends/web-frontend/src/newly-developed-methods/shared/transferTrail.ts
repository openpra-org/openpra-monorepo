import { useState } from "react";

interface TransferStep<P> {
  place: P;
  label: string;
}

interface TransferTrail<P> {
  steps: readonly TransferStep<P>[];
  index: number;
  active: boolean;
  follow: (from: TransferStep<P>, to: TransferStep<P>) => void;
  go: (index: number, current: P) => P | undefined;
  reset: () => void;
}

interface TransferBreadcrumb {
  steps: readonly string[];
  current: number;
  onSelect: (index: number) => void;
}

interface TrailState<P> {
  steps: TransferStep<P>[];
  index: number;
}

function useTransferTrail<P>(
  isCurrent: (place: P) => boolean,
  leadsTo: (from: P, to: P, live: boolean) => boolean,
  held?: readonly [TrailState<P>, (next: TrailState<P>) => void],
): TransferTrail<P> {
  const own = useState<TrailState<P>>({ steps: [], index: 0 });
  const [trail, setTrail] = held ?? own;
  const here = trail.steps[trail.index];
  const onPath = here !== undefined && isCurrent(here.place);
  const broken = trail.steps.findIndex((step, at) => {
    const previous = trail.steps[at - 1];
    return at > trail.index && previous !== undefined && !leadsTo(previous.place, step.place, at - 1 === trail.index);
  });
  const steps = trail.steps.slice(0, broken === -1 ? trail.steps.length : broken);
  const active = onPath && steps.length > 1;

  function follow(from: TransferStep<P>, to: TransferStep<P>): void {
    const kept = onPath ? trail.steps.slice(0, trail.index) : [];
    const path = [...kept, from, to];
    setTrail({ steps: path, index: path.length - 1 });
  }

  function go(index: number, current: P): P | undefined {
    const target = steps[index];
    if (!active || target === undefined || index === trail.index) return undefined;
    setTrail({ steps: trail.steps.map((step, at) => (at === trail.index ? { ...step, place: current } : step)), index });
    return target.place;
  }

  function reset(): void {
    setTrail({ steps: [], index: 0 });
  }

  return { steps, index: trail.index, active, follow, go, reset };
}

function transferBreadcrumb<P>(trail: TransferTrail<P>, currentPlace: () => P, onGo: (place: P) => void): TransferBreadcrumb | undefined {
  if (!trail.active) return undefined;
  return {
    steps: trail.steps.map((step) => step.label),
    current: trail.index,
    onSelect: (index) => {
      const place = trail.go(index, currentPlace());
      if (place !== undefined) onGo(place);
    },
  };
}

export { transferBreadcrumb, useTransferTrail, type TrailState, type TransferBreadcrumb, type TransferStep, type TransferTrail };
