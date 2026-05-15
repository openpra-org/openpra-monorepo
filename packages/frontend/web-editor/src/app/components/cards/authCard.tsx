import { EuiCard, EuiTabbedContent, type EuiTabbedContentTab } from "@elastic/eui";
import { LoginForm } from "../forms/loginForm";
import { SignUp } from "../login/signUp";
import OpenPRALogo from "../../../assets/images/logos/OpenPRA_vs_0.1x.png";
interface RootPackageJsonUnknown {
  version?: unknown;
}
const pkgUnknown: unknown = require("../../../../../../../package.json");
const getVersionString = (pkg: unknown): string => {
  if (typeof pkg === "object" && pkg !== null) {
    const maybe = pkg as RootPackageJsonUnknown;
    const v = maybe.version;
    if (typeof v === "string") return v;
  }
  return "";
};
const versionStr = getVersionString(pkgUnknown);
const tabs: EuiTabbedContentTab[] = [
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
function AuthCard(): JSX.Element {
  const cardStyle: React.CSSProperties = {
    width: 300,
    marginInline: "auto",
  };
  const version = `v${versionStr}`;
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
}
export { AuthCard };
