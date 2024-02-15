import { EuiHorizontalRule } from "@elastic/eui";
import { EditCurrentModel } from "../../components/settingsdropdowns/editCurrentModel";
import { SettingsOverview } from "../../components/settingsdropdowns/settingsOverview";
import { AdvancedSettings } from "../../components/settingsdropdowns/advancedSettings";
import { TemplatedPageBody } from "../../components/headers/TemplatedPageBody";

function ModelSettings() {
  return (
    <TemplatedPageBody
      panelled={false}
      headerProps={{
        pageTitle: "Settings",
        iconType: "gear",
      }}
    >
      <EditCurrentModel />
      <EuiHorizontalRule />
      <SettingsOverview />
      <EuiHorizontalRule />
      <AdvancedSettings />
    </TemplatedPageBody>
  );
}

export { ModelSettings };
