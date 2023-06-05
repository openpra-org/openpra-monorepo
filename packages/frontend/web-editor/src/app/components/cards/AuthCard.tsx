import React from "react";
import {EuiTabbedContent, EuiFieldText, EuiForm, EuiText, EuiLink, EuiButton, EuiBottomBar, EuiSelect, EuiFormRow, EuiFieldPassword, EuiCard} from "@elastic/eui";

import OpenPRALogo from '../../../assets/images/logos/OpenPRA_vs_0.1x.png';

function LoginForm() {
    return (
        <EuiForm component="form">
            <br/>
            <EuiFormRow>
                <EuiFieldText
                    id="name"
                    name="username"
                    placeholder="Username"
                />
            </EuiFormRow>
            <EuiFormRow>
                <EuiFieldPassword
                    name="password"
                    placeholder="Password"
                    type="dual"
                />
            </EuiFormRow>
            <EuiFormRow>
                <EuiButton type="submit">
                    Login
                </EuiButton>
            </EuiFormRow>
        </EuiForm>
    );
}

function SignupForm() {
    return (
        <EuiForm component="form">
            <br/>
            <EuiFormRow>
                <EuiFieldText
                    name="firstName"
                    placeholder="First name"
                />
            </EuiFormRow>
            <EuiFormRow>
                <EuiFieldText
                    name="lastName"
                    placeholder="Last name"
                />
            </EuiFormRow>
            <EuiFormRow>
                <EuiFieldText
                    name="email"
                    placeholder="Email"
                />
            </EuiFormRow>
            <EuiFormRow>
                <EuiFieldText
                    name="username"
                    placeholder="Username"
                />
            </EuiFormRow>
            <EuiFormRow>
                <EuiFieldPassword
                    name="password"
                    placeholder="Password"
                    type="dual"
                />
            </EuiFormRow>
            <EuiFormRow>
                <EuiFieldPassword
                    name="passwordConfirm"
                    placeholder="Confirm Password"
                    type="dual"
                />
            </EuiFormRow>
            <EuiFormRow>
                <EuiButton type="submit">
                    Sign Up
                </EuiButton>
            </EuiFormRow>
        </EuiForm>
    );
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
        <EuiCard
            style={{ width: 320}}
            title={`OpenPRA App`}
            icon={<img src={OpenPRALogo} alt="OpenPRA Logo" />}
            isDisabled={false}
            hasBorder
            description="Build: v0.0.1"
            footer={<AuthCardContent />}
            />
    )
}
