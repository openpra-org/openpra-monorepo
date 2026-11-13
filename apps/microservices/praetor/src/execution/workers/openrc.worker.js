"use strict";

process.once("message", ({ operation, requestJson, addonPath }) => {
  try {
    if (operation !== "validate" && operation !== "execute") throw new Error("Invalid OpenRC operation");
    const addon = require(addonPath);
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
      engine = { name: "OPENRC", version: `sha256:${hash}` };
    }
    const responseJson = addon[operation](requestJson);
    const response = JSON.parse(responseJson);
    const fields = response !== null && typeof response === "object" && !Array.isArray(response) ? Object.keys(response) : [];
    const resultJson =
      engine !== undefined && fields.length > 0 && !fields.includes("engine")
        ? `${responseJson.slice(0, responseJson.lastIndexOf("}"))},"engine":${JSON.stringify(engine)}}`
        : responseJson;
    process.send({ resultJson });
  } catch (caught) {
    const error = caught instanceof Error ? caught : new Error(String(caught));
    process.send({ error: error.message });
  }
});
process.on("disconnect", () => process.exit(0));
