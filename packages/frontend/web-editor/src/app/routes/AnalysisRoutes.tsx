import React from "react";

import { RouteObject } from "react-router-dom";
import { InternalEventsPage } from "../pages/routingPages/internalEventsPage";
import { InternalHazardsPage } from "../pages/routingPages/internalHazardsPage";
import { ExternalHazardsPage } from "../pages/routingPages/externalHazardsPage";
import { FullScopePage } from "../pages/routingPages/fullScope";
import { DataPage } from "../pages/routingPages/dataAnalysisPage";

export const AnalysisRoutes: RouteObject[] = [
  {
    children: [
      {
        path: "internal-events/*",
        element: <InternalEventsPage />,
      },
      {
        path: "internal-hazards/*",
        element: <InternalHazardsPage />,
      },
      {
        path: "external-hazards/*",
        element: <ExternalHazardsPage />,
      },
      {
        path: "full-scope/*",
        element: <FullScopePage />,
      },
      {
        path: "data-analysis/*",
        element: <DataPage />,
      },
      {
        path: "physical-security/*",
        element: <>WIP</>,
      },
      {
        path: "cybersecurity/*",
        element: <>WIP</>,
      },
    ],
  },
];
