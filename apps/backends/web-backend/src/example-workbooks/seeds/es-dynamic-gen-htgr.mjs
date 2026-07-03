import { writeFileSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));

const TAU = 2.0;
const P_ATWS = 0.05;

const DET_RESULTS = JSON.parse(readFileSync(join(HERE, "es-det-results-htgr.json"), "utf8"));
const RUN_DATE = DET_RESULTS.runDate;
const ENGINE_VERSION = DET_RESULTS.engineVersion;

function pathKey(states) {
  return Object.entries(states).map(([fn, st]) => fn + ":" + st).sort().join("|");
}

const DET_LOOKUP = {};
for (const cellKey of Object.keys(DET_RESULTS.cells)) {
  const m = new Map();
  for (const s of DET_RESULTS.cells[cellKey]) m.set(pathKey(s.path), s.conditional);
  DET_LOOKUP[cellKey] = m;
}

function detConditional(ie, pos, pathStates) {
  const cellKey = ie + "-" + pos;
  const m = DET_LOOKUP[cellKey];
  if (!m) throw new Error("no DET results for cell " + cellKey);
  const p = m.get(pathKey(pathStates));
  if (p === undefined) throw new Error("no DET result for path " + pathKey(pathStates) + " in " + cellKey);
  return p;
}

const decay0 = {
  "POS-01": 0.06,
  "POS-02": 0.04,
  "POS-03": 0.0091,
  "POS-04": 0.0046,
  "POS-05": 0.0026,
  "POS-06": 0.0019,
  "POS-07": 0.01,
  "POS-08": 0.0016,
  "POS-09": 0.0016,
};

const CAPACITY = { SCS: 0.04, RCCS: 0.06 };
const HEAT_REMOVAL = new Set(["SCS", "RCCS"]);
const BOUNDARY = new Set(["ISOL", "DETECT", "MAKEUP"]);
const DEMAND_MIN = { RT: 0.5, SCS: 20, RCCS: 45, ISOL: 15, DETECT: 5, MAKEUP: 30, CONF: 20 };

const RELY = {
  RT: 0.99999,
  SCS: 0.98,
  RCCS: 0.9995,
  ISOL: 0.99,
  CONF: 0.99,
  DETECT: 0.995,
  MAKEUP: 0.98,
};

const FE_META = {
  RT: { name: "Reactor trip", desc: "RPS / inherent feedback" },
  SCS: { name: "Shutdown cooling", desc: "SCS forced circulation" },
  RCCS: { name: "Passive cavity cooling", desc: "RCCS conduction cooldown" },
  ISOL: { name: "Isolation", desc: "Detect + isolate" },
  CONF: { name: "Confinement", desc: "Filtered building" },
  DETECT: { name: "Detect & stop", desc: "Monitors + action" },
  MAKEUP: { name: "Inventory control", desc: "Helium make-up / pump-down" },
};

const INITIATORS = {
  "IEG-01": { prefix: "EHP", short: "PLOFC", label: "Pressurized loss of forced cooling", functions: ["RT", "SCS", "RCCS", "CONF"] },
  "IEG-02": { prefix: "EHB", short: "SCSL", label: "Loss of shutdown cooling in shutdown", functions: ["SCS", "RCCS", "CONF"] },
  "IEG-03": { prefix: "EHL", short: "HLOOP", label: "Loss of offsite power", functions: ["RT", "SCS", "RCCS", "CONF"] },
  "IEG-04": { prefix: "EHD", short: "LODC", label: "Loss of vital DC and instrument power", functions: ["RT", "SCS", "RCCS", "CONF"] },
  "IEG-05": { prefix: "EHM", short: "LOSC", label: "Loss of mechanical support cooling", functions: ["RT", "SCS", "RCCS", "CONF"] },
  "IEG-06": { prefix: "EHO", short: "HTOP", label: "Transient overpower (rod withdrawal)", functions: ["RT", "SCS", "RCCS", "CONF"] },
  "IEG-07": { prefix: "EHR", short: "RPD", label: "Power-distribution and overcooling reactivity", functions: ["RT", "SCS", "RCCS", "CONF"] },
  "IEG-08": { prefix: "EHS", short: "SUMIS", label: "Startup reactivity mis-positioning", functions: ["RT", "SCS", "RCCS", "CONF"] },
  "IEG-09": { prefix: "EHK", short: "SHEL", label: "Small helium leak", functions: ["RT", "ISOL", "RCCS", "CONF"] },
  "IEG-10": { prefix: "EHI", short: "IDEP", label: "Intermediate depressurization break", functions: ["RT", "SCS", "RCCS", "CONF"] },
  "IEG-11": { prefix: "EHG", short: "LDEP", label: "Large break depressurized loss of forced cooling", functions: ["RT", "SCS", "RCCS", "CONF"] },
  "IEG-12": { prefix: "EHV", short: "ODEP", label: "Operator inadvertent depressurization in shutdown", functions: ["DETECT", "MAKEUP", "RCCS", "CONF"], confContains: true },
  "IEG-13": { prefix: "EHW", short: "SMI", label: "Slow moisture ingress", functions: ["RT", "ISOL", "SCS", "RCCS", "CONF"] },
  "IEG-14": { prefix: "EHT", short: "HSGTR", label: "Moderate water ingress (SGTR)", functions: ["RT", "ISOL", "SCS", "RCCS", "CONF"] },
  "IEG-15": { prefix: "EHU", short: "LSGTR", label: "Large SGTR water ingress with relief lift", functions: ["RT", "ISOL", "RCCS", "CONF"] },
  "IEG-16": { prefix: "EHX", short: "SCSI", label: "SCS heat-exchanger water ingress in shutdown", functions: ["ISOL", "RCCS", "CONF"] },
  "IEG-17": { prefix: "EHY", short: "IFR", label: "Ex-boundary interfacing release", functions: ["RT", "ISOL", "CONF"] },
  "IEG-18": { prefix: "EHF", short: "FHE", label: "Fuel-handling source event", functions: ["DETECT", "ISOL", "CONF"], confContains: true },
  "IEG-19": { prefix: "EHZ", short: "SFC", label: "Loss of cooling to stored fuel", functions: ["SCS", "RCCS", "CONF"] },
  "IEG-20": { prefix: "EHQ", short: "WDEP", label: "Wet depressurization SGTR breach", functions: ["RT", "ISOL", "RCCS", "CONF"] },
  "IEG-21": { prefix: "EHN", short: "HINV", label: "Loss of helium inventory and pressure control", functions: ["RT", "MAKEUP", "RCCS", "CONF"] },
};

const CELLS = {
  "IEG-01": ["POS-01", "POS-02", "POS-03", "POS-04", "POS-07"],
  "IEG-02": ["POS-04", "POS-05", "POS-07", "POS-09"],
  "IEG-03": ["POS-01", "POS-02", "POS-03", "POS-04", "POS-05", "POS-06", "POS-07", "POS-08"],
  "IEG-04": ["POS-01", "POS-02", "POS-03", "POS-04", "POS-05", "POS-06", "POS-08"],
  "IEG-05": ["POS-01", "POS-02", "POS-03", "POS-04", "POS-05", "POS-08"],
  "IEG-06": ["POS-01", "POS-02", "POS-03"],
  "IEG-07": ["POS-01", "POS-02", "POS-03"],
  "IEG-08": ["POS-03", "POS-05", "POS-06"],
  "IEG-09": ["POS-01", "POS-02", "POS-03", "POS-04", "POS-05", "POS-08"],
  "IEG-10": ["POS-01", "POS-02", "POS-03", "POS-04", "POS-05", "POS-08"],
  "IEG-11": ["POS-01", "POS-02", "POS-03", "POS-04", "POS-05", "POS-08"],
  "IEG-12": ["POS-04", "POS-05", "POS-08"],
  "IEG-13": ["POS-01", "POS-02", "POS-03", "POS-04"],
  "IEG-14": ["POS-01", "POS-02", "POS-03", "POS-04", "POS-05"],
  "IEG-15": ["POS-01", "POS-02", "POS-03", "POS-04"],
  "IEG-16": ["POS-04", "POS-05", "POS-06", "POS-08"],
  "IEG-17": ["POS-01", "POS-02", "POS-03", "POS-04", "POS-05", "POS-06"],
  "IEG-18": ["POS-06"],
  "IEG-19": ["POS-05", "POS-06", "POS-08"],
  "IEG-20": ["POS-01", "POS-02", "POS-03"],
  "IEG-21": ["POS-01", "POS-02", "POS-03", "POS-04", "POS-05", "POS-08"],
};

const SUBCRITICAL = new Set(["POS-04", "POS-05", "POS-06", "POS-07", "POS-08", "POS-09"]);

const IE_GROUP_FREQ = {
  "IEG-01": 2.943,
  "IEG-02": 0.054,
  "IEG-03": 0.0975,
  "IEG-04": 0.023,
  "IEG-05": 0.12,
  "IEG-06": 0.015,
  "IEG-07": 0.0165,
  "IEG-08": 0.0145,
  "IEG-09": 0.01,
  "IEG-10": 0.003,
  "IEG-11": 5e-5,
  "IEG-12": 0.018,
  "IEG-13": 0.01363,
  "IEG-14": 0.0055,
  "IEG-15": 8e-5,
  "IEG-16": 0.006,
  "IEG-17": 0.008,
  "IEG-18": 0.008,
  "IEG-19": 0.01,
  "IEG-20": 8e-4,
  "IEG-21": 0.03,
};

const POS_ANNUAL_HOURS = {
  "POS-01": 7300,
  "POS-02": 60,
  "POS-03": 900,
  "POS-04": 450,
  "POS-05": 60,
  "POS-06": 120,
  "POS-07": 105.6,
  "POS-08": 88,
  "POS-09": 64,
};

const LEGACY_ET = {
  "IEG-01": "ET-PLOFC",
  "IEG-02": "ET-SCSL",
  "IEG-03": "ET-HLOOP",
  "IEG-04": "ET-LODC",
  "IEG-05": "ET-LOSC",
  "IEG-06": "ET-HTOP",
  "IEG-07": "ET-RPD",
  "IEG-08": "ET-SUMIS",
  "IEG-09": "ET-SHEL",
  "IEG-10": "ET-IDEP",
  "IEG-11": "ET-LDEP",
  "IEG-12": "ET-ODEP",
  "IEG-13": "ET-SMI",
  "IEG-14": "ET-HSGTR",
  "IEG-15": "ET-LSGTR",
  "IEG-16": "ET-SCSI",
  "IEG-17": "ET-IFR",
  "IEG-18": "ET-FHE",
  "IEG-19": "ET-SFC",
  "IEG-20": "ET-WDEP",
  "IEG-21": "ET-HINV",
};

const POS_LABEL = {
  "POS-01": "full power",
  "POS-02": "load follow",
  "POS-03": "hot standby",
  "POS-04": "forced cooldown on SCS",
  "POS-05": "cold shutdown",
  "POS-06": "refuelling, vessel open",
  "POS-07": "post-trip passive cooling",
  "POS-08": "SCS out of service",
  "POS-09": "primary open for maintenance",
};

const MISSION_TIME = {
  "POS-01": 72,
  "POS-02": 96,
  "POS-03": 96,
  "POS-04": 120,
  "POS-05": 72,
  "POS-06": 24,
  "POS-07": 120,
  "POS-08": 72,
  "POS-09": 24,
};

const OUTCOME_PHRASE = {
  "ESF-OK": "safe stable state",
  "ESF-LEAK": "intact-confinement leak (RC-3)",
  "ESF-LATE": "late filtered release (RC-2)",
  "ESF-EARLY": "early unfiltered release (RC-1)",
  "ESF-ATWS": "unprotected release (RC-1)",
};

function ieFreq(ie, pos) {
  const totalHours = CELLS[ie].reduce((a, p) => a + POS_ANNUAL_HOURS[p], 0);
  return IE_GROUP_FREQ[ie] * (POS_ANNUAL_HOURS[pos] / totalHours);
}

function functionsForCell(ie, pos) {
  let fns = INITIATORS[ie].functions.slice();
  if (SUBCRITICAL.has(pos)) fns = fns.filter((f) => f !== "RT");
  if (pos === "POS-08") fns = fns.filter((f) => f !== "SCS");
  return fns;
}

function relyForCell(fn, pos) {
  return RELY[fn];
}

function fmt(x) {
  if (!isFinite(x)) return "never";
  if (x >= 100) return x.toFixed(0);
  if (x >= 10) return x.toFixed(1);
  return x.toFixed(1);
}

function bestCapacity(succeededHR) {
  let best = 0;
  for (const fn of succeededHR) {
    const c = CAPACITY[fn] ?? 0;
    if (c > best) best = c;
  }
  return best;
}

function raceOutcome(d0, bestC) {
  const tCross = bestC > 0 ? Math.pow(d0 / bestC, 5.0) : Infinity;
  const tLimit = TAU / Math.max(d0 - bestC, 1e-4);
  let mitigated;
  if (bestC >= d0) mitigated = true;
  else if (tCross < tLimit) mitigated = true;
  else mitigated = false;
  return { tCross, tLimit, mitigated, bestC };
}

function raceTiming(race) {
  if (race.mitigated) {
    if (race.bestC <= 0) return "decay heat removed immediately";
    if (isFinite(race.tCross)) return "DHR sufficient by " + fmt(race.tCross) + " h";
    return "decay heat removed immediately";
  }
  return "fuel limit at " + fmt(race.tLimit) + " h";
}

function releaseCategory(unprotected, confSuccess, tLimit) {
  if (unprotected) return { rc: "RC-1", family: "ESF-ATWS" };
  if (!confSuccess) return { rc: "RC-1", family: "ESF-EARLY" };
  if (tLimit < 48) return { rc: "RC-2", family: "ESF-LATE" };
  return { rc: "RC-3", family: "ESF-LEAK" };
}

function raceConditionText(d0, bestC, succeededHR, unprotected) {
  const src = succeededHR.length ? succeededHR.join("+") + " (" + bestC.toFixed(3) + ")" : "no credited DHR (0)";
  const race = raceOutcome(d0, bestC);
  const head = "decay " + d0.toFixed(3) + " vs " + src;
  if (race.mitigated) {
    if (bestC >= d0) return head + ": heat removed with margin";
    return head + ": DHR sufficient at " + fmt(race.tCross) + " h before the fuel limit at " + fmt(race.tLimit) + " h";
  }
  return head + ": fuel limit at " + fmt(race.tLimit) + " h before DHR sufficient at " + fmt(race.tCross) + " h";
}

function boundaryFnsFor(ie) {
  return INITIATORS[ie].functions.filter((f) => BOUNDARY.has(f));
}

function initiatorHasHeat(ie) {
  return INITIATORS[ie].functions.some((f) => HEAT_REMOVAL.has(f));
}

function thermalStatus(ie, d0, pathStates, succeededHR) {
  if (!initiatorHasHeat(ie)) {
    return { thermalOK: true, race: null, bestC: 0, noHeatChallenge: true };
  }
  const bestC = bestCapacity(succeededHR);
  const race = raceOutcome(d0, bestC);
  return { thermalOK: race.mitigated, race, bestC, noHeatChallenge: false };
}

function boundaryStatus(ie, pathStates) {
  const req = boundaryFnsFor(ie);
  const failed = req.filter((f) => pathStates[f] === "FAILURE");
  return { boundaryOK: failed.length === 0, required: req, failed };
}

function classifyLeaf(ie, d0, pathStates, succeededHR, atwsRole) {
  if (atwsRole === "SURVIVE") {
    const drRace = raceOutcome(P_ATWS, CAPACITY.RCCS);
    return {
      endState: "SUCCESSFUL_MITIGATION",
      rc: null,
      family: "ESF-OK",
      timing: "inherent feedback caps power at " + P_ATWS.toFixed(3) + "; RCCS " + raceTiming(drRace),
      race: drRace,
      bestC: CAPACITY.RCCS,
      tMitigateH: drRace.tCross,
      tBreachH: null,
    };
  }
  if (atwsRole === "RELEASE") {
    const drRace = raceOutcome(P_ATWS, 0);
    return {
      endState: "RADIONUCLIDE_RELEASE",
      rc: "RC-1",
      family: "ESF-ATWS",
      timing: "unprotected, passive DHR lost; " + raceTiming(drRace),
      race: drRace,
      bestC: 0,
      tMitigateH: null,
      tBreachH: drRace.tLimit,
    };
  }

  const thermal = thermalStatus(ie, d0, pathStates, succeededHR);
  const bnd = boundaryStatus(ie, pathStates);
  const confSuccess = pathStates.CONF === "SUCCESS";

  if (thermal.thermalOK && bnd.boundaryOK) {
    let timing;
    if (thermal.noHeatChallenge) timing = "boundary contained, normal cooling intact";
    else timing = raceTiming(thermal.race) + "; boundary contained";
    return { endState: "SUCCESSFUL_MITIGATION", rc: null, family: "ESF-OK", timing, race: thermal.race, bestC: thermal.bestC, tMitigateH: thermal.race ? thermal.race.tCross : null, tBreachH: null };
  }

  if (!thermal.thermalOK) {
    const tLimit = TAU / d0;
    let rc;
    let family;
    if (!confSuccess) {
      rc = "RC-1";
      family = "ESF-EARLY";
    } else if (tLimit < 48) {
      rc = "RC-2";
      family = "ESF-LATE";
    } else {
      rc = "RC-3";
      family = "ESF-LEAK";
    }
    return { endState: "RADIONUCLIDE_RELEASE", rc, family, timing: "thermal breach, fuel limit at " + fmt(tLimit) + " h", race: thermal.race, bestC: thermal.bestC, tMitigateH: null, tBreachH: tLimit };
  }

  if (INITIATORS[ie].confContains) {
    if (confSuccess) {
      return { endState: "SUCCESSFUL_MITIGATION", rc: null, family: "ESF-OK", timing: "activity retained by the filtered reactor building", race: thermal.race, bestC: thermal.bestC, tMitigateH: null, tBreachH: null };
    }
    return { endState: "RADIONUCLIDE_RELEASE", rc: "RC-3", family: "ESF-LEAK", timing: "activity vents through failed building isolation", race: thermal.race, bestC: thermal.bestC, tMitigateH: null, tBreachH: null };
  }
  const rc = confSuccess ? "RC-3" : "RC-1";
  const family = confSuccess ? "ESF-LEAK" : "ESF-EARLY";
  const breach = bnd.failed.length ? bnd.failed.join("+") + " boundary breach" : "boundary breach";
  return { endState: "RADIONUCLIDE_RELEASE", rc, family, timing: "cooling intact; release via " + breach, race: thermal.race, bestC: thermal.bestC, tMitigateH: null, tBreachH: null };
}

function buildDet(ie, pos) {
  const info = INITIATORS[ie];
  const d0 = decay0[pos];
  const fns = functionsForCell(ie, pos);
  const hasRt = fns.includes("RT");
  const hasConf = fns.includes("CONF");
  const boundaryOrder = fns.filter((f) => BOUNDARY.has(f));
  const heatOrder = fns.filter((f) => HEAT_REMOVAL.has(f));
  const challenged = boundaryOrder.concat(heatOrder);

  const usedFes = new Set();

  function makeNode(kind, fn, pathStates, prob, succeededHR, unprotected) {
    return { kind, fn, pathStates, prob, succeededHR, unprotected, children: [] };
  }

  function makeLeaf(spec) {
    const cls = classifyLeaf(ie, d0, spec.pathStates, spec.succeededHR, spec.atwsRole);
    return {
      kind: "leaf",
      pathStates: spec.pathStates,
      prob: spec.prob,
      succeededHR: spec.succeededHR,
      atwsRole: spec.atwsRole,
      cls,
    };
  }

  function finalize(pathStates, prob, succeededHR) {
    const provisional = makeLeaf({ pathStates, prob, succeededHR, atwsRole: null });
    if (provisional.cls.endState === "SUCCESSFUL_MITIGATION" || !hasConf) {
      return provisional;
    }
    usedFes.add("CONF");
    const node = makeNode("branch", "CONF", pathStates, prob, succeededHR, false);
    const succLeaf = makeLeaf({ pathStates: { ...pathStates, CONF: "SUCCESS" }, prob: prob * relyForCell("CONF", pos), succeededHR, atwsRole: null });
    const failLeaf = makeLeaf({ pathStates: { ...pathStates, CONF: "FAILURE" }, prob: prob * (1 - relyForCell("CONF", pos)), succeededHR, atwsRole: null });
    node.children.push({ outcome: "SUCCESS", leaf: succLeaf });
    node.children.push({ outcome: "FAILURE", leaf: failLeaf });
    return node;
  }

  function expandBody(idx, pathStates, prob, succeededHR) {
    if (idx >= challenged.length) {
      return finalize(pathStates, prob, succeededHR);
    }

    const fn = challenged[idx];
    const isHR = HEAT_REMOVAL.has(fn);

    if (isHR) {
      const race = raceOutcome(d0, bestCapacity(succeededHR));
      if (race.mitigated) {
        return finalize(pathStates, prob, succeededHR);
      }
    }

    usedFes.add(fn);
    const rely = relyForCell(fn, pos);
    const node = makeNode("branch", fn, pathStates, prob, succeededHR, false);

    const succHRnext = isHR ? succeededHR.concat([fn]) : succeededHR;
    const successChild = expandBody(idx + 1, { ...pathStates, [fn]: "SUCCESS" }, prob * rely, succHRnext);
    const failChild = expandBody(idx + 1, { ...pathStates, [fn]: "FAILURE" }, prob * (1 - rely), succeededHR);

    node.children.push({ outcome: "SUCCESS", child: successChild });
    node.children.push({ outcome: "FAILURE", child: failChild });
    return node;
  }

  function buildAtwsLeg(prob) {
    usedFes.add("RCCS");
    const rccsRely = relyForCell("RCCS", pos);
    const node = makeNode("branch", "RCCS", { RT: "FAILURE" }, prob, [], true);
    const surviveLeaf = makeLeaf({ pathStates: { RT: "FAILURE", RCCS: "SUCCESS" }, prob: prob * rccsRely, succeededHR: ["RCCS"], atwsRole: "SURVIVE" });
    const releaseLeaf = makeLeaf({ pathStates: { RT: "FAILURE", RCCS: "FAILURE" }, prob: prob * (1 - rccsRely), succeededHR: [], atwsRole: "RELEASE" });
    node.children.push({ outcome: "SUCCESS", leaf: surviveLeaf });
    node.children.push({ outcome: "FAILURE", leaf: releaseLeaf });
    return node;
  }

  const atwsCreditsDracs = INITIATORS[ie].functions.includes("RCCS");

  let root;
  if (hasRt) {
    usedFes.add("RT");
    const rtNode = makeNode("branch", "RT", {}, 1, [], false);
    const successChild = expandBody(0, { RT: "SUCCESS" }, 1 * relyForCell("RT", pos), []);
    const atwsProb = 1 * (1 - relyForCell("RT", pos));
    const atwsChild = atwsCreditsDracs
      ? buildAtwsLeg(atwsProb)
      : makeLeaf({ pathStates: { RT: "FAILURE" }, prob: atwsProb, succeededHR: [], atwsRole: "RELEASE" });
    rtNode.children.push({ outcome: "SUCCESS", child: successChild });
    rtNode.children.push({ outcome: "FAILURE", child: atwsChild });
    root = rtNode;
  } else {
    root = expandBody(0, {}, 1, []);
  }

  const orderedFes = fns.filter((f) => usedFes.has(f));
  return { ie, pos, d0, root, orderedFes, hasConf, hasRt, info };
}

function emitCell(ie, pos, det) {
  const info = det.info;
  const etId = pos === "POS-01" ? LEGACY_ET[ie] : "ET-" + info.short + "-P" + pos.slice(4);
  const seqPrefix = pos === "POS-01" ? info.prefix : info.prefix + "-P" + pos.slice(4);
  const bPrefix = pos === "POS-01" ? info.short : info.short + "-P" + pos.slice(4);
  const drId = "DR-" + info.short + "-P" + pos.slice(4);

  const branches = {};
  const treeSequences = {};
  const esdNodes = {};
  const eventSequences = [];

  let branchCounter = 0;
  let leafCounter = 0;

  function nextBranchId() {
    const id = bPrefix + "-b" + branchCounter;
    branchCounter += 1;
    return id;
  }
  function nextSeqId() {
    leafCounter += 1;
    return seqPrefix + "-" + leafCounter;
  }

  function pathBrief(leaf) {
    const parts = [];
    for (const fn of det.orderedFes) {
      if (leaf.pathStates[fn]) {
        parts.push(fn + (leaf.pathStates[fn] === "SUCCESS" ? "✓" : "✗"));
      }
    }
    return parts.join(" ");
  }

  function seqName(leaf) {
    const posText = POS_LABEL[pos];
    const phrase = OUTCOME_PHRASE[leaf.cls.family];
    const trace = pathBrief(leaf);
    return info.label + " (" + posText + ") · " + trace + " → " + phrase;
  }

  const ifreq = ieFreq(ie, pos);
  const modelBasis = "es-dynamic-model-htgr.json#" + ie + "-" + pos;

  function seqTimings(leaf, seqId) {
    const entries = [];
    let n = 0;
    function push(minutes, event, category) {
      n += 1;
      entries.push({
        uuid: seqId + "-t" + n,
        event,
        timeAfterInitiator: Math.round(minutes * 10) / 10,
        category,
        basis: modelBasis,
      });
    }
    push(0, info.label, "INITIATOR");
    let lastDemand = 0;
    for (const fn of det.orderedFes) {
      const st = leaf.pathStates[fn];
      if (!st) continue;
      const t = DEMAND_MIN[fn];
      if (fn === "RT") {
        if (st === "SUCCESS") {
          push(t, "Reactor trip (RPS / inherent)", "AUTOMATIC");
        } else {
          push(t, "Reactor trip fails (ATWS)", "AUTOMATIC");
          push(2, "Negative temperature feedback caps power at " + P_ATWS.toFixed(3) + " of nominal", "AUTOMATIC");
        }
        continue;
      }
      const name = FE_META[fn].name;
      if (HEAT_REMOVAL.has(fn)) {
        push(t, st === "SUCCESS" ? name + " established" : name + " unavailable", "AUTOMATIC");
        if (st === "SUCCESS" && t > lastDemand) lastDemand = t;
      } else if (fn === "CONF") {
        push(t, st === "SUCCESS" ? "Confinement isolated + filtration aligned" : "Confinement isolation fails", "AUTOMATIC");
      } else {
        push(t, st === "SUCCESS" ? name + " succeeds" : name + " fails", "AUTOMATIC");
      }
    }
    const cls = leaf.cls;
    if (cls.tMitigateH !== null && cls.tMitigateH !== undefined && isFinite(cls.tMitigateH)) {
      const tm = Math.max(cls.tMitigateH * 60, lastDemand + 2);
      push(tm, "Decay heat below removal capacity, safe stable state", "AUTOMATIC");
    }
    if (cls.tBreachH !== null && cls.tBreachH !== undefined && isFinite(cls.tBreachH)) {
      push(cls.tBreachH * 60, "Fuel temperature limit reached", "DAMAGE_LIMIT");
    }
    entries.sort((a, b) => a.timeAfterInitiator - b.timeAfterInitiator);
    return entries;
  }

  function makeSeqRecord(leaf) {
    const seqId = nextSeqId();
    const rec = {
      uuid: seqId,
      name: seqName(leaf),
      initiatingEventId: ie,
      plantOperatingStateId: pos,
      eventTreeId: etId,
      functionalEventStates: { ...leaf.pathStates },
      timing: seqTimings(leaf, seqId),
      endState: leaf.cls.endState,
      sequenceFamilyId: leaf.cls.family,
      meanFrequency: ifreq * detConditional(ie, pos, leaf.pathStates),
      implementsSrs: [],
    };
    if (leaf.cls.rc) rec.releaseCategoryId = leaf.cls.rc;
    eventSequences.push(rec);
    treeSequences[seqId] = {
      uuid: seqId,
      name: seqId,
      endState: leaf.cls.endState,
      eventSequenceId: seqId,
      functionalEventStates: { ...leaf.pathStates },
    };
    leaf.seqId = seqId;
    return seqId;
  }

  const BOUNDARY_CONDITION = {
    ISOL: "Affected path detected and isolated so the ingress or release is contained",
    DETECT: "Fault detected and stopped so the challenge is contained",
    MAKEUP: "Helium inventory and pressure control restored",
  };

  function conditionText(node) {
    const fn = node.fn;
    if (node.unprotected && fn === "RCCS") {
      return "Passive cavity cooling absorbs the feedback-capped ATWS power (" + P_ATWS.toFixed(3) + ") at " + pos;
    }
    if (HEAT_REMOVAL.has(fn)) {
      const cap = CAPACITY[fn];
      return FE_META[fn].name + " removes decay heat (" + cap.toFixed(3) + ") vs decay " + det.d0.toFixed(3) + " at " + pos;
    }
    if (BOUNDARY.has(fn)) {
      return BOUNDARY_CONDITION[fn] + " at " + pos;
    }
    if (fn === "RT") return "Reactor trip on demand (inherent + RPS) at " + pos;
    if (fn === "CONF") {
      return "Confinement isolation + filtration holds as the final barrier";
    }
    return FE_META[fn].name + " succeeds on demand at " + pos;
  }

  function branchOutcomeTiming(node, outcome, child) {
    if (child.kind === "leaf") {
      return child.cls.timing;
    }
    if (outcome === "SUCCESS") {
      if (HEAT_REMOVAL.has(node.fn)) return "heat-removal path established";
      if (BOUNDARY.has(node.fn)) return "release path contained";
      return node.fn + " restores the function";
    }
    return node.fn + " fails, challenge continues";
  }

  function walk(node) {
    if (node.kind === "leaf") {
      const seqId = node.seqId || makeSeqRecord(node);
      return { targetType: "SEQUENCE", target: seqId };
    }

    const bId = nextBranchId();
    const nodeId = bId;
    branches[bId] = {
      uuid: bId,
      name: FE_META[node.fn].name,
      functionalEventId: node.fn,
      paths: [],
    };
    const esdBranches = [];

    for (const edge of node.children) {
      const child = edge.child || edge.leaf;
      let targetInfo;
      let childNodeId = null;
      if (child.kind === "leaf") {
        if (!child.seqId) makeSeqRecord(child);
        targetInfo = { targetType: "SEQUENCE", target: child.seqId };
      } else {
        const res = walk(child);
        targetInfo = res;
        childNodeId = res.nodeId;
      }
      branches[bId].paths.push({ state: edge.outcome, target: targetInfo.target, targetType: targetInfo.targetType });

      const prob = edge.outcome === "SUCCESS" ? relyForCell(node.fn, pos) : 1 - relyForCell(node.fn, pos);
      const esdEdge = {
        outcome: edge.outcome === "SUCCESS" ? "Success" : "Failure",
        probability: prob,
        timing: branchOutcomeTiming(node, edge.outcome, child),
      };
      if (child.kind === "leaf") {
        esdEdge.sequenceId = child.seqId;
      } else {
        esdEdge.targetNodeId = childNodeId;
      }
      esdBranches.push(esdEdge);
    }

    esdNodes[nodeId] = {
      id: nodeId,
      condition: conditionText(node),
      challengedFunctionId: node.fn,
      branches: esdBranches,
    };

    return { targetType: "BRANCH", target: bId, nodeId };
  }

  const rootRes = walk(det.root);
  const rootBranchId = rootRes.target;

  const functionalEvents = {};
  det.orderedFes.forEach((fn, i) => {
    functionalEvents[fn] = {
      uuid: fn,
      name: FE_META[fn].name,
      label: fn,
      order: i,
      description: FE_META[fn].desc,
    };
  });

  const posText = POS_LABEL[pos];
  const etName = pos === "POS-01" ? info.label : info.label + " (" + posText + ")";
  const eventTree = {
    uuid: etId,
    name: etName,
    initiatingEventId: ie,
    plantOperatingStateId: pos,
    missionTime: MISSION_TIME[pos],
    missionTimeUnits: "h",
    description:
      "Discrete dynamic event tree for " + info.label.toLowerCase() + " at " + posText +
      " (decay heat " + det.d0.toFixed(3) + " of nominal), generated by the reduced-order dynamic PRA; branches carry the heat-removal-vs-decay race and fuel-limit timing.",
    mitigationStrategy:
      "Each credited heat-removal path is raced against the decaying heat load; forced cooling on the SCS catches the decay curve within hours, an available RCCS bounds the conduction cooldown below the fuel limit, and the filtered building sets the release category on breach.",
    functionalEvents,
    sequences: treeSequences,
    branches,
    initialState: { branchId: rootBranchId },
    implementsSrs: [],
  };

  const dynamicRun = {
    uuid: drId,
    tool: "DDET",
    toolVersion: ENGINE_VERSION,
    modelRef: "es-dynamic-model-htgr.json#" + ie + "-" + pos,
    runDate: RUN_DATE,
    initiatingEventId: ie,
    plantOperatingStateId: pos,
    esdNodes,
    rootNodeId: rootBranchId,
    eventTreeId: etId,
  };

  return { eventTree, dynamicRun, eventSequences, esdNodes, rootBranchId, etId, drId };
}

const KEYSTATE_META = {
  "ESF-OK": { key: "Safe", label: "Safe stable state" },
  "ESF-LEAK": { key: "RC3", label: "RC-3 intact-confinement leak" },
  "ESF-LATE": { key: "RC2", label: "RC-2 late filtered release" },
  "ESF-EARLY": { key: "RC1", label: "RC-1 early unfiltered release" },
  "ESF-ATWS": { key: "RC1atws", label: "RC-1 unprotected release" },
};

function buildScenarioDiagram(ie, pos, emitted, det) {
  const info = det.info;
  const key = ie + "-" + pos;
  const dgName = "Scenario_" + key;
  const states = [];
  const events = [];
  const actions = [];

  const seqById = {};
  for (const s of emitted.eventSequences) seqById[s.uuid] = s;

  const startName = "Init_" + key;
  states.push({
    name: startName,
    stateType: "stStart",
    diagramName: dgName,
    desc: info.label + " at " + POS_LABEL[pos] + "; decay heat " + det.d0.toFixed(3) + " of nominal at t=0.",
    immediateActions: ["To_" + emitted.rootBranchId],
    events: [],
    eventActions: [],
  });

  const keyStates = {};
  function keyStateFor(seq) {
    const meta = KEYSTATE_META[seq.sequenceFamilyId];
    const kName = "End_" + meta.key + "_" + key;
    if (!keyStates[kName]) {
      keyStates[kName] = true;
      states.push({
        name: kName,
        stateType: "stKeyState",
        diagramName: dgName,
        desc: meta.label + " (" + (seq.releaseCategoryId || "no release") + ").",
        immediateActions: ["Terminate_" + key],
        events: [],
        eventActions: [],
      });
    }
    return kName;
  }

  for (const nodeId of Object.keys(emitted.esdNodes)) {
    const node = emitted.esdNodes[nodeId];
    const stName = "Phase_" + nodeId;
    const evName = "Ev_" + nodeId;
    const branchActions = [];
    for (const br of node.branches) {
      let targetState;
      if (br.sequenceId) {
        targetState = keyStateFor(seqById[br.sequenceId]);
      } else {
        targetState = "Phase_" + br.targetNodeId;
      }
      const actName = "To_" + nodeId + "_" + (br.outcome === "Success" ? "S" : "F");
      actions.push({
        name: actName,
        actionType: "atTransition",
        desc: node.challengedFunctionId + " " + br.outcome + " (" + (br.timing || "") + ")",
        mutExcl: true,
        newStates: [{ toState: targetState, prob: br.probability }],
      });
      branchActions.push({ outcome: br.outcome, probability: br.probability, action: actName });
    }
    events.push({
      name: evName,
      evType: "etComponentDemand",
      desc: node.condition,
      challengedFunction: node.challengedFunctionId,
    });
    states.push({
      name: stName,
      stateType: "stStandard",
      diagramName: dgName,
      desc: node.condition,
      immediateActions: [],
      events: [evName],
      eventActions: [{ event: evName, actions: branchActions.map((b) => b.action) }],
    });
  }

  const termName = "Term_" + key;
  states.push({
    name: termName,
    stateType: "stTerminal",
    diagramName: dgName,
    desc: "Run ends.",
    immediateActions: [],
    events: [],
    eventActions: [],
  });
  actions.push({ name: "Terminate_" + key, actionType: "atTransition", desc: "End the run.", mutExcl: true, newStates: [{ toState: termName, prob: 1 }] });
  actions.push({ name: "To_" + emitted.rootBranchId, actionType: "atTransition", desc: "Enter first challenged function.", mutExcl: true, newStates: [{ toState: "Phase_" + emitted.rootBranchId, prob: 1 }] });

  const diagram = {
    name: dgName,
    diagramType: "dtSingle",
    diagramLabel: "Scenario",
    desc: info.label + " at " + POS_LABEL[pos],
    initiatingEventId: ie,
    plantOperatingStateId: pos,
    eventTreeId: emitted.etId,
    dynamicRunId: emitted.drId,
    states: states.map((s) => s.name),
  };

  return { diagram, states, events, actions };
}

function buildSystemDiagrams(usedFns) {
  const diagrams = [];
  const states = [];
  const events = [];
  const actions = [];
  for (const fn of usedFns) {
    const dg = "Sys_" + fn;
    const okName = fn + "_Operating";
    const failName = fn + "_Failed";
    const cap = CAPACITY[fn];
    diagrams.push({
      name: dg,
      diagramType: "dtComponent",
      diagramLabel: "System",
      desc: FE_META[fn].name + (cap ? " (capacity " + cap.toFixed(3) + " of nominal)" : " (gating function)"),
      states: [okName, failName],
    });
    states.push({ name: okName, stateType: "stStart", diagramName: dg, desc: FE_META[fn].name + " available on demand.", immediateActions: [], events: [fn + "_Demand"], eventActions: [{ event: fn + "_Demand", actions: [fn + "_Fail"] }] });
    states.push({ name: failName, stateType: "stStandard", diagramName: dg, desc: FE_META[fn].name + " failed on demand.", immediateActions: [], events: [], eventActions: [] });
    events.push({ name: fn + "_Demand", evType: "etFailOnDemand", desc: FE_META[fn].name + " demand; per-demand failure probability.", failProbability: Number((1 - RELY[fn]).toExponential(6)) });
    actions.push({ name: fn + "_Fail", actionType: "atTransition", desc: FE_META[fn].name + " transitions to failed.", mutExcl: true, newStates: [{ toState: failName, prob: Number((1 - RELY[fn]).toExponential(6)) }] });
  }
  return { diagrams, states, events, actions };
}

const genEventTrees = [];
const genEventSequences = [];
const genDynamicRuns = [];
const familyMembers = { "ESF-OK": [], "ESF-LEAK": [], "ESF-LATE": [], "ESF-EARLY": [], "ESF-ATWS": [] };

const scenarioDiagrams = [];
const scenarioStates = [];
const scenarioEvents = [];
const scenarioActions = [];
const usedSystems = new Set();

let cellCount = 0;
for (const ie of Object.keys(CELLS)) {
  for (const pos of CELLS[ie]) {
    const det = buildDet(ie, pos);
    const emitted = emitCell(ie, pos, det);
    genEventTrees.push(emitted.eventTree);
    genDynamicRuns.push(emitted.dynamicRun);
    for (const seq of emitted.eventSequences) {
      genEventSequences.push(seq);
      familyMembers[seq.sequenceFamilyId].push(seq.uuid);
    }
    for (const fn of det.orderedFes) usedSystems.add(fn);
    const scen = buildScenarioDiagram(ie, pos, emitted, det);
    scenarioDiagrams.push(scen.diagram);
    scenarioStates.push(...scen.states);
    scenarioEvents.push(...scen.events);
    scenarioActions.push(...scen.actions);
    cellCount += 1;
  }
}

const sysOrder = ["RT", "SCS", "RCCS", "ISOL", "DETECT", "MAKEUP", "CONF"].filter((f) => usedSystems.has(f));
const sys = buildSystemDiagrams(sysOrder);
const dynamicModel = {
  id: "es-dynamic-model-htgr",
  name: "HTGR Event-Sequence Dynamic PRA Model",
  desc:
    "State-diagram model of the helium-cooled reactor mitigation systems and accident scenarios for the Event Sequence Analysis example. Component diagrams model each safety function as Operating/Failed with a per-demand failure event; scenario diagrams (one per initiating-event x plant-operating-state) start at the initiator with its initial decay-heat state, progress through the challenged functions, and end in key states (safe, RC-1, RC-2, RC-3) that mirror the discrete dynamic event tree. Reference an individual scenario as es-dynamic-model.json#<IE>-<POS>.",
  version: "unofficial-sim",
  runDate: RUN_DATE,
  DiagramList: [...sys.diagrams, ...scenarioDiagrams],
  StateList: [...sys.states, ...scenarioStates],
  ActionList: [...sys.actions, ...scenarioActions],
  EventList: [...sys.events, ...scenarioEvents],
  VariableList: [
    { name: "DecayHeatFraction", varScope: "gtGlobal", type: "double", value: 0, desc: "Decay-heat fraction of nominal at the current time, decaying as decay0*(t/1h)^-0.2." },
    { name: "TimeHours", varScope: "gtGlobal", type: "double", value: 0, desc: "Scenario clock in hours since the initiating event." },
    { name: "BestHeatRemovalCapacity", varScope: "gtGlobal", type: "double", value: 0, desc: "Best capacity (fraction of nominal) among credited heat-removal paths that have succeeded." },
  ],
  LogicNodeList: [],
};

function serializeSequence(seq) {
  const parts = [];
  parts.push('uuid: ' + JSON.stringify(seq.uuid));
  parts.push('name: ' + JSON.stringify(seq.name));
  parts.push('initiatingEventId: ' + JSON.stringify(seq.initiatingEventId));
  parts.push('plantOperatingStateId: ' + JSON.stringify(seq.plantOperatingStateId));
  parts.push('eventTreeId: ' + JSON.stringify(seq.eventTreeId));
  parts.push('functionalEventStates: ' + JSON.stringify(seq.functionalEventStates));
  parts.push('timing: ' + JSON.stringify(seq.timing));
  parts.push('endState: EndState.' + seq.endState);
  if (seq.releaseCategoryId) parts.push('releaseCategoryId: ' + JSON.stringify(seq.releaseCategoryId));
  parts.push('sequenceFamilyId: ' + JSON.stringify(seq.sequenceFamilyId));
  parts.push('meanFrequency: ' + seq.meanFrequency);
  parts.push('implementsSrs: []');
  return '  { ' + parts.join(', ') + ' },';
}

const seqLines = genEventSequences.map(serializeSequence).join("\n");

const treesLiteral = genEventTrees
  .map((t) => {
    const raw = JSON.stringify(t, null, 2);
    return raw;
  })
  .join(",\n");

const runsLiteral = genDynamicRuns
  .map((r) => JSON.stringify(r, null, 2))
  .join(",\n");

const familyLiteral = JSON.stringify(familyMembers, null, 2);

function withEndStateEnums(literal) {
  return literal
    .split('"endState": "SUCCESSFUL_MITIGATION"').join('"endState": EndState.SUCCESSFUL_MITIGATION')
    .split('"endState": "RADIONUCLIDE_RELEASE"').join('"endState": EndState.RADIONUCLIDE_RELEASE');
}

const rcMembers = {};
const rcFrequency = {};
for (const s of genEventSequences) {
  if (!s.releaseCategoryId) continue;
  rcMembers[s.releaseCategoryId] = rcMembers[s.releaseCategoryId] ?? [];
  rcMembers[s.releaseCategoryId].push(s.uuid);
  rcFrequency[s.releaseCategoryId] = (rcFrequency[s.releaseCategoryId] ?? 0) + s.meanFrequency;
}

const familyFrequency = {};
for (const s of genEventSequences) {
  familyFrequency[s.sequenceFamilyId] = (familyFrequency[s.sequenceFamilyId] ?? 0) + s.meanFrequency;
}

const header =
  'import type {\n' +
  '  EventTree,\n' +
  '  EventSequence,\n' +
  '  DynamicRun,\n' +
  '} from "interfaces-mef-types/es/event-sequence-analysis";\n' +
  'import { EndState } from "interfaces-mef-types/core/events";\n\n';

const out =
  header +
  "export const GEN_EVENT_TREES: EventTree[] = [\n" +
  withEndStateEnums(treesLiteral) +
  "\n];\n\n" +
  "export const GEN_EVENT_SEQUENCES: EventSequence[] = [\n" +
  seqLines +
  "\n];\n\n" +
  "export const GEN_DYNAMIC_RUNS: DynamicRun[] = [\n" +
  runsLiteral +
  "\n];\n\n" +
  "export const GEN_FAMILY_MEMBERS: Record<string, string[]> = " +
  familyLiteral +
  ";\n\n" +
  "export const GEN_FAMILY_FREQUENCY: Record<string, number> = " +
  JSON.stringify(familyFrequency, null, 1) +
  ";\n\n" +
  "export const GEN_RC_MEMBERS: Record<string, string[]> = " +
  JSON.stringify(rcMembers, null, 1) +
  ";\n\n" +
  "export const GEN_RC_FREQUENCY: Record<string, number> = " +
  JSON.stringify(rcFrequency, null, 1) +
  ";\n";

const outPath = join(HERE, "es-seed-dynamic-htgr.generated.ts");
writeFileSync(outPath, out, "utf8");

const modelPath = join(HERE, "es-dynamic-model-htgr.json");
writeFileSync(modelPath, JSON.stringify(dynamicModel, null, 2) + "\n", "utf8");

const releaseCdf = genEventSequences
  .filter((s) => s.endState === "RADIONUCLIDE_RELEASE")
  .reduce((a, s) => a + s.meanFrequency, 0);

const byFamily = {};
for (const s of genEventSequences) {
  byFamily[s.sequenceFamilyId] = (byFamily[s.sequenceFamilyId] || 0) + 1;
}

console.log("cells:", cellCount);
console.log("event trees:", genEventTrees.length);
console.log("event sequences:", genEventSequences.length);
console.log("dynamic runs:", genDynamicRuns.length);
console.log("family counts:", JSON.stringify(byFamily));
console.log("release CDF (sum of release-seq freq):", releaseCdf.toExponential(3));
console.log("wrote:", outPath);
console.log("wrote:", modelPath, "(" + dynamicModel.DiagramList.length + " diagrams, " + dynamicModel.StateList.length + " states)");
