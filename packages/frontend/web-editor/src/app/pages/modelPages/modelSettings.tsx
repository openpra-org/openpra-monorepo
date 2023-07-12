
import { EuiPageTemplate, EuiFlexItem, EuiFlexGrid, EuiFlexGroup, logicalStyle, EuiHorizontalRule } from "@elastic/eui";
import EditCurrentModel from "../../components/settingsdropdowns/editCurrentModel";
import SettingsOverview from "../../components/settingsdropdowns/settingsOverview";
import AdvancedSettings from "../../components/settingsdropdowns/advancedSettings";

export default function ModelSettings() {
  const verticalMargin = logicalStyle("margin-vertical", "0px");
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
      restrictWidth={990}
      bottomBorder={true}
    />
    <EuiPageTemplate.Section
      restrictWidth={990}
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
