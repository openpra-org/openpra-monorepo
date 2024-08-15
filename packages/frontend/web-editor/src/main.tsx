import React, { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { init } from "@sentry/react";
import { assert } from "typia";

import { App } from "./app/app";
import { SentryOptions } from "./plugins/SentryOptions";

/**
 * Initializes Sentry to automatically track errors and performance issues.
 */
init(SentryOptions);

// Select the DOM element where the React application will be attached.
const container: HTMLElement = assert<HTMLElement>(document.getElementById("root"));

// Create a root for the React application.
const root = createRoot(container);

// Render the React application within the StrictMode component for
// highlighting potential problems.
root.render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// if (container instanceof HTMLElement) {
// } else {
//   throw new Error("Element with id 'root' not found in document");
// }
