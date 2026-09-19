"use strict";

/** Standard JSON for application data, retaining the numeric spelling -0.0. */
function stringifyJson(value, space) {
  const zeroSigns = [];
  const text = JSON.stringify(value, (_key, item) => {
    // JSON.stringify normally unboxes Number objects after calling a replacer.
    if (item instanceof Number) item = Number(item);
    if (typeof item === "number" && item === 0) zeroSigns.push(Object.is(item, -0));
    return item;
  }, space);
  if (!zeroSigns.includes(true)) return text;
  // Scan complete tokens without a recursive regular expression: large quoted
  // workbook fields must not exhaust the regexp stack when -0 is present.
  let zeroIndex = 0, copiedUntil = 0;
  const parts = [];
  for (let i = 0; i < text.length; i++) {
    if (text[i] === '"') {
      for (i++; i < text.length; i++) {
        if (text[i] === "\\") i++;
        else if (text[i] === '"') break;
      }
    } else if (text[i] === "-" || (text[i] >= "0" && text[i] <= "9")) {
      const start = i;
      while (i + 1 < text.length && "0123456789.eE+-".includes(text[i + 1])) i++;
      if (text[start] === "0" && start === i && zeroSigns[zeroIndex++]) {
        parts.push(text.slice(copiedUntil, start), "-0.0");
        copiedUntil = i + 1;
      }
    }
  }
  parts.push(text.slice(copiedUntil));
  return parts.join("");
}

/** Preserve signed zero in numeric XML and CSV cells too. */
function numberText(value) {
  return Object.is(value, -0) ? "-0" : String(value);
}

/** Express middleware shared by the web backend and Praetor. */
function jsonResponses(_request, response, next) {
  response.json = function (body) {
    let text = stringifyJson(body, this.app.get("json spaces"));
    if (text !== undefined && this.app.get("json escape")) {
      const escapes = { "<": "\\u003c", ">": "\\u003e", "&": "\\u0026" };
      text = text.replace(/[<>&]/g, (character) => escapes[character]);
    }
    if (!this.get("Content-Type")) this.type("application/json");
    return this.send(text);
  };
  next();
}

module.exports = { stringifyJson, numberText, jsonResponses };
