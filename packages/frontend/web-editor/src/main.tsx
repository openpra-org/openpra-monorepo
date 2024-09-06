import React, { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { App } from "./app/app";

/**
 * The DOM element identifier where the React application will be mounted.
 */
const container = document.getElementById("root");

if (container instanceof HTMLElement) {
  /**
   * Creates a root container for the React application using the specified HTMLElement.
   * @param container - The HTMLElement where the React app will be mounted.
   */
  const root = createRoot(container);

  /**
   * Renders the React application within a `StrictMode` component.
   * `StrictMode` is a tool for highlighting potential problems in an application.
   * Just like `Fragment`, `StrictMode` does not render any visible UI.
   * It activates additional checks and warnings for its descendants.
   *
   * @remarks
   * This example uses `StrictMode` which will help in identifying components with unsafe lifecycles,
   * legacy string ref API usage, deprecated findDOMNode usage, and unexpected side effects in the component tree.
   */
  root.render(<App />);
} else {
  /**
   * Throws an error if the root element is not found in the document.
   * @throws Error When the element with id 'root' is not found.
   */
  throw new Error("Element with id 'root' not found in document");
}
