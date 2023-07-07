import React from "react";
import { EuiCard, logicalStyle, EuiTabbedContent } from "@elastic/eui";
import LoginForm from "../forms/loginForm";
import SignupForm from "../forms/signupForm";
import OpenPRALogo from '../../../assets/images/logos/OpenPRA_vs_0.1x.png';

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
        />
    )
}

export default function AuthCard() {
    return (
        <EuiCard
            style={logicalStyle('width', 295)}
            title={`OpenPRA App`}
            icon={<img src={OpenPRALogo} alt="OpenPRA Logo" />}
            isDisabled={false}
            hasBorder
            description="Build: v0.0.1"
        >
            <AuthCardContent />
        </EuiCard>
    )
}
