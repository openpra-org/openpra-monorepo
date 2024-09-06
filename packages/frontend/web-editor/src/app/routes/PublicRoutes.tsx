import React from "react";

import { RouteObject } from "react-router-dom";
import { LandingPage } from "../pages/LandingPage";
import { InvitePage } from "../pages/invitePage";

export const PublicRoutes: RouteObject[] = [
  {
    children: [
      {
        path: "",
        element: <LandingPage />,
      },
      {
        path: "invite/:inviteId/*",
        element: <InvitePage />,
      },
    ],
  },
];
