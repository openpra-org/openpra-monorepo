import React, { useEffect, useState } from "react";
import { EuiPageTemplate, EuiSkeletonRectangle, EuiSpacer } from "@elastic/eui";
import { InternalEventsModelType } from "shared-types/src/lib/types/modelTypes/largeModels/internalEventsModel";
import { CreateGenericList } from "../lists/GenericList";
import { UseGlobalStore } from "../../zustand/Store";
import { GenericItemList } from "../lists/GenericItemList";

function ModelMenuContainer(): JSX.Element {
  // State variables
  const [isLoading, setIsLoading] = useState(true);
  const [genericListItems, setGenericListItems] = useState<React.ReactElement[]>([]);

  // Global store hooks
  const internalEventsList = UseGlobalStore((state) => state.InternalEvents);
  const internalHazardsList = UseGlobalStore((state) => state.InternalHazards);
  const externalHazardsList = UseGlobalStore((state) => state.ExternalHazards);
  const fullScopeList = UseGlobalStore((state) => state.FullScope);

  // Effect to handle loading state and set generic list items
  useEffect(() => {
    if (
      internalEventsList.length === 0 &&
      internalHazardsList.length === 0 &&
      externalHazardsList.length === 0 &&
      fullScopeList.length === 0
    ) {
      setIsLoading(true);
    } else {
      setIsLoading(false);
      const combinedList = [
        ...internalEventsList,
        ...internalHazardsList,
        ...externalHazardsList,
        ...fullScopeList,
      ];
      setGenericListItems(
        CreateGenericList<InternalEventsModelType>({
          modelList: combinedList,
          endpoint: "Internal and External Events, Hazards, and Full Scope",
        })
      );
    }
  }, [
    internalEventsList,
    internalHazardsList,
    externalHazardsList,
    fullScopeList,
  ]);

  return (
    <EuiPageTemplate
      panelled={false}
      offset={48}
      grow={true}
      restrictWidth={true}
    >
      <EuiPageTemplate.Section>
        <EuiSkeletonRectangle
          width="100%"
          height={490}
          isLoading={isLoading}
          contentAriaLabel="Loading internal and external events, hazards, and full scope"
        >
          <GenericItemList>{genericListItems}</GenericItemList>
        </EuiSkeletonRectangle>
        <EuiSpacer size="s" />
      </EuiPageTemplate.Section>
    </EuiPageTemplate>
  );
}

export { ModelMenuContainer };
