import { EuiCard, EuiTabbedContent, logicalStyle } from "@elastic/eui";

import OpenPRALogo from "../../../assets/images/logos/OpenPRA_vs_0.1x.png";
import { LoginForm } from "../forms/loginForm";
import { SignUp } from "../login/signUp";

//required to show version number!
const packageJson = require("../../../../../../../package.json");

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

const AuthCardContent = (): JSX.Element => {
  return (
    <EuiTabbedContent
      tabs={tabs}
      expand
      initialSelectedTab={tabs[0]}
      data-testid="Context"
    />
  );
};

const AuthCard = (): JSX.Element => {
  const cardStyle = {
    ...logicalStyle("width", 300),
    ...logicalStyle("margin-horizontal", "auto"),
  };
  const version = "v" + packageJson.version;
  return (
    <EuiCard
      style={cardStyle}
      title={`OpenPRA App`}
      icon={
        <img
          src={OpenPRALogo}
          alt="OpenPRA Logo"
        />
      }
      isDisabled={false}
      hasBorder
      description={version}
    >
      <AuthCardContent />
    </EuiCard>
  );
};

export { AuthCard };
