import React, { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserTracing, init, reactRouterV6Instrumentation, Replay } from "@sentry/react";
import { createRoutesFromChildren, matchRoutes, useLocation, useNavigationType } from "react-router-dom";
import { App } from "./app/app";
const { NODE_ENV, BRANCH_SLUG, ENABLE_SENTRY } = process.env;
init({
  dsn: "https://4e6f4dd638ec41368bed874cb17dde3a@o574983.ingest.sentry.io/4505489238982656",
  tracePropagationTargets: [/^https:\/\/(?:.*\.)?app\.openpra\.org/],
  release: BRANCH_SLUG ?? "localhost",
  environment: NODE_ENV ?? "development",
  enabled: !!ENABLE_SENTRY || false,
  debug: true,
  attachStacktrace: true,
  enableTracing: true,
  tracesSampleRate: 1.0,
  replaysSessionSampleRate: 1.0,
  replaysOnErrorSampleRate: 1.0,
  integrations: [
    new BrowserTracing({
      traceFetch: true,
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
