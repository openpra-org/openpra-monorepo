import React, { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import {
  BrowserTracing,
  init,
  reactRouterV6Instrumentation,
  Replay,
} from "@sentry/react";
import {
  createRoutesFromChildren,
  matchRoutes,
  useLocation,
  useNavigationType,
} from "react-router-dom";

import { App } from "./app/app";

/**
 * @remarks read environment variables
 */
const { NODE_ENV, BRANCH_SLUG, ENABLE_SENTRY } = process.env;

/**
 * Initializes Sentry to automatically track errors and performance issues.
 */
init({
  /**
   * @remarks DSN for openpra.org apps
   */
  dsn: "https://4e6f4dd638ec41368bed874cb17dde3a@o574983.ingest.sentry.io/4505489238982656",

  /**
   * Set 'tracePropagationTargets' to control for which URLs distributed
   * tracing should be enabled.
   * @remarks - `^` asserts the start of the string.
   * - `https:\/\/` matches the literal string "https://".
   * - `(?:.*\.)?` is a non-capturing group that matches any character (`.`) any number of times (`*`),
   * followed by a literal dot (`\.`), zero or one time (`?`). This part matches any subdomain, including cases where
   * there is no subdomain.
   * - `app\.openpra\.org` matches the literal string "app.openpra.org".
   */
  // eslint-disable-next-line security/detect-unsafe-regex
  tracePropagationTargets: [/^https:\/\/(?:.*\.)?app\.openpra\.org/],

  release: BRANCH_SLUG ?? "localhost",

  environment: NODE_ENV ?? "development",

  enabled: !!ENABLE_SENTRY || false,

  /**
   * @remarks Debug mode has been enabled by default to track sentry-related issues
   */
  debug: true,

  /** Attaches stack traces to pure capture message / log integrations */
  attachStacktrace: true,

  /**
   * @remarks If this is enabled, transactions and trace data will be generated and captured.
   * This will set the `tracesSampleRate` to the recommended default of `1.0` if `tracesSampleRate` is undefined.
   * Note that `tracesSampleRate` and `tracesSampler` take precedence over this option.
   */
  enableTracing: true,

  /**
   * Performance Monitoring configuration.
   * @remarks Capture 100% of the transactions for detailed insights.
   */
  tracesSampleRate: 1.0,
  /**
   * Session Replay configuration.
   * @remarks Set the session sample rate for capturing user sessions.
   */
  replaysSessionSampleRate: 1.0,
  /**
   * Error-based Session Replay configuration.
   * @remarks Increase the sample rate when errors occur to capture more information.
   */
  replaysOnErrorSampleRate: 1.0,

  integrations: [
    new BrowserTracing({
      /**
       * @remarks Trace fetch requests.
       */
      traceFetch: true,

      /**
       * Configures Sentry's routing instrumentation for React Router v6.
       */
      routingInstrumentation: reactRouterV6Instrumentation(
        React.useEffect,
        useLocation,
        useNavigationType,
        createRoutesFromChildren,
        matchRoutes,
      ),
    }),
    new Replay(),
  ],
});

// Select the DOM element where the React application will be attached.
const container = document.getElementById("root");

if (container instanceof HTMLElement) {
  // Create a root for the React application.
  const root = createRoot(container);

  // Render the React application within the StrictMode component for
  // highlighting potential problems.
  root.render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
} else {
  throw new Error("Element with id 'root' not found in document");
}
