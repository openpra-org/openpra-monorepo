import { logicalStyle, EuiTabbedContent, EuiPanel } from "@elastic/eui";
import React, { ReactElement } from "react";
import { SignUp } from "./signup/SignUp";
import { LoginForm } from "./LoginForm";

/**
 * Defines the structure of each tab used in the `AuthCardContent` component.
 */
const tabs = [
  {
    id: "signup",
    name: "Sign Up",
    content: <SignUp />,
  },
  {
    id: "login",
    name: "Login",
    content: <LoginForm />,
  },
];

/**
 * A functional component that renders tabbed content for authentication purposes.
 * It utilizes `EuiTabbedContent` to switch between Login and Sign Up forms.
 *
 * @returns A `ReactElement` representing the tabbed content for authentication.
 */
function AuthCardContent(): ReactElement {
  return (
    <EuiTabbedContent
      tabs={tabs}
      expand={true}
      initialSelectedTab={tabs[0]}
      data-testid="Context"
    />
  );
}

/**
 * A functional component that renders an `EuiPanel` containing the `AuthCardContent`.
 * It applies custom styling to ensure the panel is appropriately sized and centered.
 *
 * @returns A `ReactElement` representing a styled panel that contains the authentication forms.
 */
export function AuthCard(): ReactElement {
  // Applies logical styles for maximum and minimum width, and horizontal margin for centering.
  const cardStyle = {
    ...logicalStyle("max-width", 420),
    ...logicalStyle("min-width", 300),
    ...logicalStyle("margin-horizontal", "auto"),
  };

  return (
    <EuiPanel
      hasBorder
      color="plain"
      style={cardStyle}
    >
      <AuthCardContent />
    </EuiPanel>
  );
}
