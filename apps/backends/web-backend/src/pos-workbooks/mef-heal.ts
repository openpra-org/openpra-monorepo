function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function healMef(restored: unknown, template: unknown): unknown {
  if (isPlainObject(template)) {
    const restoredObj = isPlainObject(restored) ? restored : {};
    const out: Record<string, unknown> = {};
    const keys = new Set<string>([...Object.keys(template), ...Object.keys(restoredObj)]);
    for (const k of keys) {
      const tv = template[k];
      const rv = restoredObj[k];
      if (rv === undefined || rv === null) {
        if (tv !== undefined) out[k] = tv;
      } else {
        out[k] = healMef(rv, tv);
      }
    }
    return out;
  }
  if (Array.isArray(template)) {
    return Array.isArray(restored) ? restored : template;
  }
  return restored === undefined || restored === null ? template : restored;
}

export { healMef };
