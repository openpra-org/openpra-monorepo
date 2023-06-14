import React from 'react';
import { EuiPageTemplate } from '@elastic/eui';
import {Outlet} from "react-router-dom";

export default function RootContainer() {
    return (
        <EuiPageTemplate panelled={true} offset={0} grow={true}>
            <Outlet />
        </EuiPageTemplate>
    );
}
