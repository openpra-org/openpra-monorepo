import type { RcSourceTermValues } from "interfaces-mef-types/rc/source-term";
import type { RcDepositionData, RcTransportInputs, RcTransportSettings } from "interfaces-mef-types/rc/transport";
export function nobleGasGroup(source: RcSourceTermValues, id: number): boolean {
  const members = source.inventory.filter(n => n.group === id);
  return members.length > 0 && members.every(n => /^(He|Ne|Ar|Kr|Xe|Rn)-\d+m?\d*$/i.test(n.name));
}
export function effectiveTransportSettings(source: RcSourceTermValues | undefined, saved?: RcTransportSettings): RcTransportSettings {
  return { decayMode: saved?.decayMode ?? "parent", groupVelocities: (source?.groups ?? []).map(g => {
    const previous = saved?.groupVelocities.find(v => v.groupId === g.id && v.name === g.name);
    if (nobleGasGroup(source!, g.id)) return { groupId: g.id, name: g.name, velocity: 0, basis: "noble_gas" };
    return previous && previous.basis !== "noble_gas" ? previous : { groupId: g.id, name: g.name, velocity: .003, basis: "openrc_default" };
  }) };
}
export function depositionMatchesSource(data: RcDepositionData, source: RcSourceTermValues): boolean {
  return data.groups.length === source.groups.length && source.groups.every(g => data.groups.some(d => d.id === g.id && d.name === g.name));
}
export function decayCoverage(inputs: RcTransportInputs | undefined, source: RcSourceTermValues | undefined) {
  const available = new Set(inputs?.decayFiles.flatMap(f => f.parents.filter(p => p.ground).map(p => p.nuclide.toLowerCase())) ?? []);
  const names = [...new Set(source?.inventory.map(n => n.name) ?? [])];
  return { found: names.filter(n => available.has(n.toLowerCase())), missing: names.filter(n => !available.has(n.toLowerCase())), total: names.length };
}
