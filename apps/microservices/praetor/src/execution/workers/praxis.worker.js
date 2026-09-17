"use strict";

// Canonical worker source, copied unchanged into dist by Nest's asset build.
// A process boundary allows the parent to stop synchronous native computation.
process.once("message", ({ operation, requestJson, addonPath }) => {
  try {
    if (operation !== "validate" && operation !== "execute") throw new Error("Invalid PRAXIS operation");
    const addon = require(addonPath);
    // Identify the binary actually loaded by the generated addon loader.
    const loaded = require.cache[require.resolve(addonPath)];
    const pending = [loaded];
    const seen = new Set();
    const binaries = new Set();
    while (pending.length) {
      const module = pending.pop();
      if (!module || seen.has(module.id)) continue;
      seen.add(module.id);
      if (module.filename.endsWith(".node")) binaries.add(module.filename);
      pending.push(...module.children);
    }
    let engine;
    if (binaries.size === 1) {
      const hash = require("node:crypto")
        .createHash("sha256")
        .update(require("node:fs").readFileSync([...binaries][0]))
        .digest("hex");
      engine = { name: "PRAXIS", version: `sha256:${hash}` };
    }
    // The addon calls the original TensorBayes compiler without constructing
    // dense potentials. Keep this inside the timed, cancellable child process.
    const preflight = JSON.parse(addon.preflight(requestJson, operation));
    const resourceFailure = require("praxis-node/protocol").checkCliqueMemory(preflight);
    const response = resourceFailure ?? JSON.parse(addon[operation](requestJson));
    if (engine && response !== null && typeof response === "object" && !Array.isArray(response))
      response.engine = engine;
    const resultJson = JSON.stringify(response);
    process.send({ resultJson });
  } catch (caught) {
    const error = caught instanceof Error ? caught : new Error(String(caught));
    process.send({ error: error.message });
  }
});
process.on("disconnect", () => process.exit(0));
