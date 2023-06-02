import React from "react";
import {EuiTabbedContent, EuiFieldText, EuiForm, EuiText, EuiLink, EuiSelect, EuiFormRow, EuiCard} from "@elastic/eui";

import OpenPRALogo from '../../../assets/images/logos/OpenPRA_vs_0.1x.png';

function LoginForm() {
    return (<div />);
}

function SignupForm() {
    return (
        <EuiForm component="form">
            <EuiFormRow label="Text field" helpText="I am some friendly help text.">
                <EuiFieldText name="first" />
            </EuiFormRow>
            <EuiFormRow label="Disabled through form row">
                <EuiFieldText name="last" />
            </EuiFormRow>
            <EuiFormRow
                label="Select (with no initial selection)"
                labelAppend={
                    <EuiText size="xs">
                        <EuiLink>Link to some help</EuiLink>
                    </EuiText>
                }
            >
                <EuiSelect
                    hasNoInitialSelection
                    options={[
                        { value: 'option_one', text: 'Option one' },
                        { value: 'option_two', text: 'Option two' },
                        { value: 'option_three', text: 'Option three' },
                    ]}
                />
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
