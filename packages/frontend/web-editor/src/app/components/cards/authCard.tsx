import { EuiCard, logicalStyle, EuiTabbedContent } from "@elastic/eui";
import LoginForm from "../forms/loginForm";
import SignupForm from "../forms/signupForm";
import OpenPRALogo from '../../../assets/images/logos/OpenPRA_vs_0.1x.png';

//required to show version number!
const packageJson = require('../../../../../../../package.json');

const tabs = [
    {
        id: 'signup',
        name: 'Sign Up',
        content: (
            <SignupForm />
        )
    },
    {
        id: 'login',
        name: 'Login',
        content: (
            <LoginForm />
        )
    }
];

function AuthCardContent() {
    return (
        <EuiTabbedContent
            tabs={tabs}
            expand={true}
            initialSelectedTab={tabs[0]}
            data-testid='Context'
        />
    )
}

export default function AuthCard() {
    const cardStyle = {...logicalStyle('width', 300), ...logicalStyle('margin-horizontal', 'auto')};
    const version = 'v' + packageJson.version;
    return (
        <EuiCard
            style={cardStyle}
            title={`OpenPRA App`}
            icon={<img src={OpenPRALogo} alt="OpenPRA Logo" />}
            isDisabled={false}
            hasBorder
            description={version}
        >
            <AuthCardContent />
        </EuiCard>
    )
}
