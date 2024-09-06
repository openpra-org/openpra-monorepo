import {
  EuiCard,
  logicalStyle,
  EuiTabbedContent,
  EuiImage,
  EuiSplitPanel,
  EuiHideFor,
  EuiButton,
  EuiCode,
  EuiText,
  EuiTitle,
  EuiLink,
  EuiEmptyPrompt,
  useIsWithinBreakpoints,
  EuiPanel,
} from "@elastic/eui";
import React, { ReactElement } from "react";
import { LoginForm } from "../components/forms/loginForm";
import { SignUp } from "../components/login/signUp";
import OpenPRALogo from "../../assets/images/logos/OpenPRA_vs_0.1x.png";

//required to show version number!
const packageJson = require("../../../../../../package.json");

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

function AuthCardContent(): JSX.Element {
  return (
    <EuiTabbedContent
      tabs={tabs}
      expand={true}
      initialSelectedTab={tabs[0]}
      data-testid="Context"
    />
  );
}

export function AuthCard(): JSX.Element {
  const cardStyle = {
    ...logicalStyle("max-width", 420),
    ...logicalStyle("min-width", 300),
    ...logicalStyle("margin-horizontal", "auto"),
  };
  const version = "v0.1";
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
