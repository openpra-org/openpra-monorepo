export const pdfWorkerUrl = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();

export const pdfWasmUrls = {
  "jbig2.wasm": new URL("pdfjs-dist/wasm/jbig2.wasm", import.meta.url).toString(),
  "openjpeg.wasm": new URL("pdfjs-dist/wasm/openjpeg.wasm", import.meta.url).toString(),
};
