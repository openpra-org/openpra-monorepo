import React, { useState } from "react";
import { EuiTabbedContent, EuiTabbedContentTab } from "@elastic/eui";
import { EditCurrentModel } from "../../components/settingsdropdowns/editCurrentModel";
import { SettingsOverview } from "../../components/settingsdropdowns/settingsOverview";
import { AdvancedSettings } from "../../components/settingsdropdowns/advancedSettings";
import { TemplatedPageBody } from "../../components/headers/TemplatedPageBody";

function ModelSettings(): JSX.Element {
  const tabsConfig = [
    {
      id: "editCurrentModel",
      name: "Edit Model",
      getComponent: () => <EditCurrentModel />,
    },
    {
      id: "settingsOverview",
      name: "Settings Overview",
      getComponent: () => <SettingsOverview />,
    },
    {
      id: "advancedSettings",
      name: "Advanced Settings",
      getComponent: () => <AdvancedSettings />,
    },
    // Additional tabs can be added here
  ];

  const [selectedTabId, setSelectedTabId] = useState<string>(tabsConfig[0].id);

  const tabs: EuiTabbedContentTab[] = tabsConfig.map((tab) => ({
    id: tab.id,
    name: tab.name,
    content: tab.getComponent(), // Invoke the function to get JSX
  }));

  const onTabClick = (selectedTab: EuiTabbedContentTab) => {
    setSelectedTabId(selectedTab.id);
  };

  return (
    <TemplatedPageBody
      panelled={false}
      headerProps={{
        pageTitle: "Settings",
        iconType: "gear",
      }}
    >
      <EuiTabbedContent
        tabs={tabs}
        initialSelectedTab={tabs.find((tab) => tab.id === selectedTabId)}
        onTabClick={onTabClick}
        expand={true}
      />
    </TemplatedPageBody>
  );
}

export { ModelSettings };
