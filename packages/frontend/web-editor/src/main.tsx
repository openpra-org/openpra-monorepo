import React, { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./app/app";

import * as Sentry from "@sentry/react";
import {
  createRoutesFromChildren,
  matchRoutes,
  useLocation,
  useNavigationType,
} from "react-router-dom";

/**
 * Initializes Sentry to automatically track errors and performance issues.
 */
Sentry.init({
  dsn: "https://4e6f4dd638ec41368bed874cb17dde3a@o574983.ingest.sentry.io/4505489238982656",
  integrations: [
    new Sentry.BrowserTracing({
      /**
       * Set 'tracePropagationTargets' to control for which URLs distributed tracing should be enabled.
       */
      tracePropagationTargets: ["localhost", /^https:\/\/app.openpra\.org/],
      /**
       * Configures Sentry's routing instrumentation for React Router v6.
       */
      routingInstrumentation: Sentry.reactRouterV6Instrumentation(
        React.useEffect,
        useLocation,
        useNavigationType,
        createRoutesFromChildren,
        matchRoutes,
      ),
    }),
    new Sentry.Replay(),
  ],
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
});

// Select the DOM element where the React application will be attached.
const container = document.getElementById("root") as HTMLElement;

// Create a root for the React application.
const root = createRoot(container);

// Render the React application within the StrictMode component for highlighting potential problems.
root.render(
  <StrictMode>
    <App />
  </StrictMode>,
);
