globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const { TextEncoder, TextDecoder } = require("util");
if (typeof globalThis.TextEncoder === "undefined") globalThis.TextEncoder = TextEncoder;
if (typeof globalThis.TextDecoder === "undefined") globalThis.TextDecoder = TextDecoder;

class MockResponse {
  constructor(body, init) {
    this.status = (init && init.status) || 200;
    this.ok = this.status >= 200 && this.status < 300;
    this.statusText = (init && init.statusText) || (this.ok ? "OK" : "Error");
    this.headers = new Headers((init && init.headers) || {});
    this._body = body == null ? "" : body;
  }
  async text() { return this._body; }
  async json() { return JSON.parse(this._body); }
}

if (typeof globalThis.Response === "undefined") {
  globalThis.Response = MockResponse;
}
