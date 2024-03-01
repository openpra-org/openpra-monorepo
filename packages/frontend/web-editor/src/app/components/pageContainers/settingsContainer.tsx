import { EuiPageTemplate } from "@elastic/eui";
import { Outlet } from "react-router-dom";
import { SettingsNav } from "../sidenavs/settingsNav";

/**
 * The main container for the Settings Page
 * @returns - EuiPageTemplate containing the settings page
 */
export function SettingsContainer(): JSX.Element {
  return (
    <EuiPageTemplate
      panelled={false}
      offset={0}
      grow={true}
      restrictWidth={false}
    >
      <EuiPageTemplate.Sidebar
        paddingSize="s"
        sticky
        minWidth={320}
        responsive={["xs"]}
      >
        <SettingsNav />
      </EuiPageTemplate.Sidebar>
      <Outlet />
    </EuiPageTemplate>
  );
}
