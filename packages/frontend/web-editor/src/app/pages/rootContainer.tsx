import { EuiPageTemplate, EuiSpacer } from "@elastic/eui";
import {Outlet} from "react-router-dom";
import RootHeader from "../components/largecomponents/headers/rootHeader";

export default function RootContainer() {
    return (
        <EuiPageTemplate panelled={false} offset={0} grow={true} restrictWidth={false}>
          <RootHeader/>
          <EuiSpacer size="xxl"/>
          <EuiSpacer size="s"/>
          <Outlet />
        </EuiPageTemplate>
    );
}
