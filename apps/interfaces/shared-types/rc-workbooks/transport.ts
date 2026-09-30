import type { RcSourceTermValues } from "interfaces-mef-types/rc/source-term";
import type { RcDecayParent, RcDepositionData, RcTransportInputs, RcTransportSettings } from "interfaces-mef-types/rc/transport";
export const RC_STANDARD_DECAY_LIBRARY = "NNDC-ENSDF-2023-04-03-standard-decay-library.txt";
export function nobleGasGroup(source: RcSourceTermValues, id: number): boolean {
  const members = source.inventory.filter(n => n.group === id);
  return members.length > 0 && members.every(n => /^(He|Ne|Ar|Kr|Xe|Rn)-\d+m?\d*$/i.test(n.name));
}
export function effectiveDepositionVelocity(data: RcDepositionData | undefined, groupId: number): number | undefined {
  const group = data?.groups.find(g => g.id === groupId);
  if (!data || !group || group.fractions.length !== data.velocities.length) return undefined;
  return group.fractions.reduce((total, fraction, index) => total + fraction * data.velocities[index], 0);
}
export function effectiveTransportSettings(source: RcSourceTermValues | undefined, saved?: RcTransportSettings, deposition?: RcDepositionData): RcTransportSettings {
  const matchingDeposition = source && deposition && depositionMatchesSource(deposition, source) ? deposition : undefined;
  return { decayMode: saved?.decayMode ?? "parent", groupVelocities: (source?.groups ?? []).map(g => {
    const previous = saved?.groupVelocities.find(v => v.groupId === g.id && v.name === g.name);
    if (nobleGasGroup(source!, g.id)) return { groupId: g.id, name: g.name, velocity: 0, basis: "noble_gas" };
    if (previous && previous.basis !== "noble_gas" && previous.basis !== "openrc_default") return previous;
    const velocity = effectiveDepositionVelocity(matchingDeposition, g.id);
    return velocity === undefined
      ? { groupId: g.id, name: g.name, velocity: Number.NaN, basis: "analyst" }
      : { groupId: g.id, name: g.name, velocity, basis: "source_file" };
  }) };
}
export function depositionMatchesSource(data: RcDepositionData, source: RcSourceTermValues): boolean {
  return data.groups.length === source.groups.length && source.groups.every(g => data.groups.some(d => d.id === g.id && d.name === g.name));
}
export function decayParentNames(parents: RcDecayParent[]): string[] {
  const lowest = new Map<string, number>();
  for (const parent of parents) {
    const energy = Number.parseFloat(parent.energy);
    if (!parent.ground && Number.isFinite(energy)) lowest.set(parent.nuclide, Math.min(lowest.get(parent.nuclide) ?? energy, energy));
  }
  return parents.flatMap(parent => {
    if (parent.ground) return [parent.nuclide];
    const energy = Number.parseFloat(parent.energy), first = lowest.get(parent.nuclide);
    return Number.isFinite(energy) && first !== undefined && energy - first <= 1 ? [`${parent.nuclide}m`] : [];
  });
}
export function decayCoverage(inputs: RcTransportInputs | undefined, source: RcSourceTermValues | undefined) {
  const available = new Set(decayParentNames(inputs?.decayFiles.flatMap(f => f.parents) ?? []).map(name => name.toLowerCase()));
  const names = [...new Set(source?.inventory.map(n => n.name) ?? [])];
  return { found: names.filter(n => available.has(n.toLowerCase())), missing: names.filter(n => !available.has(n.toLowerCase())), total: names.length };
}
export function depositionFlagNotes(treatment: { wet: boolean; dry: boolean }, data: RcDepositionData): { text: string; blocking: boolean }[] {
  const notes: { text: string; blocking: boolean }[] = [];
  for (const [kind, included] of [["wet", treatment.wet], ["dry", treatment.dry]] as const) {
    const flagged = data.groups.filter(group => group[kind] !== undefined), on = flagged.filter(group => group[kind]).length;
    if (included && flagged.length && !on) notes.push({ text: `${kind === "wet" ? "Wet" : "Dry"} deposition is included, but the deposition file turns it off for every group.`, blocking: true });
    if (!included && on) notes.push({ text: `The deposition file turns ${kind} deposition on for ${on} ${on === 1 ? "group" : "groups"}, but the removal treatments exclude it. The calculation follows the removal treatments.`, blocking: false });
  }
  return notes;
}
