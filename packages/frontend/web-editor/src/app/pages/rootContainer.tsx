import { EuiPageTemplate, EuiSpacer } from "@elastic/eui";
import {Outlet} from "react-router-dom";
import RootHeader from "../components/headers/rootHeader";

export default function RootContainer() {
    return (
          <>
            <RootHeader/>
            <Outlet />
          </>
    );
}
