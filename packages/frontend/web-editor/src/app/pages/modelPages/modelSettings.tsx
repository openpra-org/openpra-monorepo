import {
  EuiPageTemplate,
  EuiHorizontalRule,
  useEuiTheme
} from "@elastic/eui";
import EditCurrentModel from "../../components/settingsdropdowns/editCurrentModel";
import SettingsOverview from "../../components/settingsdropdowns/settingsOverview";
import AdvancedSettings from "../../components/settingsdropdowns/advancedSettings";

export default function ModelSettings() {
  const largeScreenBreakpoint = useEuiTheme().euiTheme.breakpoint.xl;
  return (
    <>
    <EuiPageTemplate.Header
      pageTitle="Settings"
      responsive={false}
      iconType="gear"
      iconProps={{
        color: "accent",
        size: "l"
      }}
      restrictWidth={largeScreenBreakpoint}
      bottomBorder={true}
    />
    <EuiPageTemplate.Section
      restrictWidth={largeScreenBreakpoint}
    >
      <EditCurrentModel/>
      <EuiHorizontalRule />
      <SettingsOverview/>
      <EuiHorizontalRule />
      <AdvancedSettings/>
    </EuiPageTemplate.Section>
    </>
  );
}
