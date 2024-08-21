import React, { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { init } from "@sentry/react";

import { App } from "./app/app";
import { SentryOptions } from "./plugins/SentryOptions";

/**
 * Initializes Sentry with the specified options to automatically track errors and performance issues.
 */
init(SentryOptions);

/**
 * The DOM element identifier where the React application will be mounted.
 */
const container = document.getElementById("root");

if (container instanceof HTMLElement) {
  /**
   * Creates a root container for the React application using the specified HTMLElement.
   */
  const root = createRoot(container);

  /**
   * Renders the React application within a `StrictMode` component.
   * `StrictMode` is a tool for highlighting potential problems in an application.
   * Just like `Fragment`, `StrictMode` does not render any visible UI.
   * It activates additional checks and warnings for its descendants.
   */
  root.render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
} else {
  /**
   * Throws an error if the root element is not found in the document.
   */
  throw new Error("Element with id 'root' not found in document");
}
