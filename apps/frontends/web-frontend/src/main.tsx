import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./routing/router";

const container = document.getElementById("root");
if (container instanceof HTMLElement) {
  const root = createRoot(container);
  root.render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
} else {
  throw new Error("Element with id 'root' not found in document");
}
