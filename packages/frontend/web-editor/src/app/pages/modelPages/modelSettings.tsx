import {
  EuiPageTemplate,
  EuiHorizontalRule,
  useEuiTheme
} from "@elastic/eui";
import EditCurrentModel from "../../components/settingsdropdowns/editCurrentModel";
import SettingsOverview from "../../components/settingsdropdowns/settingsOverview";
import AdvancedSettings from "../../components/settingsdropdowns/advancedSettings";
import ListlessPageTitleHeader from "../../components/headers/listlessPageTitleHeader";

export default function ModelSettings() {
  const largeScreenBreakpoint = useEuiTheme().euiTheme.breakpoint.xl;
  return (
    <>
    <ListlessPageTitleHeader title="Settings" icon="gear"/>
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
