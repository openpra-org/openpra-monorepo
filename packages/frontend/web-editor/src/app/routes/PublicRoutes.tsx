import React from "react";

import { RouteObject } from "react-router-dom";
import { LoginPage } from "../pages/LandingPage";
import { InvitePage } from "../pages/invitePage";

export const PublicRoutes: RouteObject[] = [
  {
    children: [
      {
        path: "",
        element: <LoginPage />,
      },
      {
        path: "invite/:inviteId/*",
        element: <InvitePage />,
      },
    ],
  },
];
