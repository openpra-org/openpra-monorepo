import React from 'react'
import {EuiPageHeader, EuiHeader, EuiButton, EuiHeaderSection, EuiFieldSearch, EuiIcon} from "@elastic/eui"

export function PageHeader() {
    return (
        <EuiPageHeader>
            <EuiHeaderSection>
                <EuiButton
                    size="s"
                    href="app.openpra.org"
                >
                    Models
                </EuiButton>
            </EuiHeaderSection>
            <EuiHeaderSection side="right">
                <p>v 0.0.1</p>
                <EuiFieldSearch/>
                <EuiIcon type="user"/>
            </EuiHeaderSection>
        </EuiPageHeader>
    )
}

export function Models() {
    return (
        <EuiHeader>

        </EuiHeader>
    )
}

export function Filter() {
    return (
        <EuiHeader>
            <EuiHeaderSection>
                <EuiButton iconType="filter" iconSide="left">Sort By</EuiButton>
                <EuiFieldSearch/>
                <EuiButton iconType=""/>
                <EuiButton iconType=""/>
            </EuiHeaderSection>
            <EuiHeaderSection side="right">

            </EuiHeaderSection>
        </EuiHeader>
    )
}