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

function useTransferTrail<P>(isCurrent: (place: P) => boolean): TransferTrail<P> {
  const [trail, setTrail] = useState<{ steps: TransferStep<P>[]; index: number }>({ steps: [], index: 0 });
  const here = trail.steps[trail.index];
  const active = trail.steps.length > 1 && here !== undefined && isCurrent(here.place);

  function follow(from: TransferStep<P>, to: TransferStep<P>): void {
    const kept = active ? trail.steps.slice(0, trail.index) : [];
    const steps = [...kept, from, to];
    setTrail({ steps, index: steps.length - 1 });
  }

  function go(index: number, current: P): P | undefined {
    const target = trail.steps[index];
    if (!active || target === undefined || index === trail.index) return undefined;
    setTrail({ steps: trail.steps.map((step, at) => (at === trail.index ? { ...step, place: current } : step)), index });
    return target.place;
  }

  function reset(): void {
    setTrail({ steps: [], index: 0 });
  }

  return { steps: trail.steps, index: trail.index, active, follow, go, reset };
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

export { transferBreadcrumb, useTransferTrail, type TransferBreadcrumb, type TransferStep, type TransferTrail };
