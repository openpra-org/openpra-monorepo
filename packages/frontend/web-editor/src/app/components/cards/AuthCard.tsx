import React from "react";
import {EuiTabbedContent} from "@elastic/eui";
import { FlatCard } from './Card';

import OpenPRALogo from '../../../assets/images/logos/OpenPRA_vs_0.1x.png';

function LoginForm() {
    return (<div />);
}

function SignupForm() {
    return (<div />);
}

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

export function AuthCardContent() {
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
        <FlatCard
            style={{ width: 320}}
            title={`OpenPRA App`}
            icon={<img src={OpenPRALogo} alt="OpenPRA Logo" />}
            isDisabled={false}
            hasBorder
            description=""
            footer={<AuthCardContent />}
            />
    )
}
