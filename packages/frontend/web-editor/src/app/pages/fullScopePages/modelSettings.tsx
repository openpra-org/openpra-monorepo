import { EuiHorizontalRule } from "@elastic/eui";

import { TemplatedPageBody } from "../../components/headers/TemplatedPageBody";
import { AdvancedSettings } from "../../components/settingsdropdowns/advancedSettings";
import { EditCurrentModel } from "../../components/settingsdropdowns/editCurrentModel";
import { SettingsOverview } from "../../components/settingsdropdowns/settingsOverview";

const ModelSettings = (): JSX.Element => {
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
};

export { ModelSettings };
