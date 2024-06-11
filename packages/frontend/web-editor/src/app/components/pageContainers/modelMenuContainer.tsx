import React, { ReactElement, useEffect, useState } from "react";
import { EuiPageTemplate, EuiSkeletonRectangle, EuiSpacer } from "@elastic/eui";
import { InternalEventsModelType } from "shared-types/src/lib/types/modelTypes/largeModels/internalEventsModel";
import { FullScopeModelType } from "shared-types/src/lib/types/modelTypes/largeModels/fullScopeModel";
import { ExternalHazardsModelType } from "shared-types/src/lib/types/modelTypes/largeModels/externalHazardsModel";
import { GenericItemList } from "../lists/GenericItemList";
import { UseGlobalStore } from "../../zustand/Store";
import { CreateGenericList } from "../lists/GenericList";

function ModelMenuContainer(): JSX.Element {
  const [isLoadingEvents, setIsLoadingEvents] = useState(true);
  const [isLoadingHazards, setIsLoadingHazards] = useState(true);
  const [isLoadingFullScope, setIsLoadingFullScope] = useState(true);
  const [isLoadingExternalHazards, setIsLoadingExternalHazards] = useState(true);
  const [combinedListItems, setCombinedListItems] = useState<ReactElement[]>([]);

  const internalEventsList = UseGlobalStore.use.InternalEvents();
  const setInternalEvents = UseGlobalStore.use.SetInternalEvents();
  const createInternalEvents = UseGlobalStore.use.AddInternalEvent();
  const deleteInternalEvent = UseGlobalStore.use.DeleteInternalEvent();
  const editInternalEvent = UseGlobalStore.use.EditInternalEvent();

  const internalHazardsList = UseGlobalStore.use.InternalHazards();
  const setInternalHazards = UseGlobalStore.use.SetInternalHazards();
  const createInternalHazards = UseGlobalStore.use.AddInternalHazard();
  const deleteInternalHazard = UseGlobalStore.use.DeleteInternalHazard();
  const editInternalHazard = UseGlobalStore.use.EditInternalHazard();

  const fullScopeList = UseGlobalStore.use.FullScope();
  const setFullScope = UseGlobalStore.use.SetFullScope();
  const createFullScope = UseGlobalStore.use.AddFullScope();
  const deleteFullScope = UseGlobalStore.use.DeleteFullScope();
  const editFullScope = UseGlobalStore.use.EditFullScope();

  const externalHazardsList = UseGlobalStore.use.ExternalHazards();
  const setExternalHazards = UseGlobalStore.use.SetExternalHazards();
  const createExternalHazards = UseGlobalStore.use.AddExternalHazard();
  const deleteExternalHazard = UseGlobalStore.use.DeleteExternalHazard();
  const editExternalHazard = UseGlobalStore.use.EditExternalHazard();

  useEffect(() => {
    setIsLoadingEvents(true);
    void setInternalEvents().then(() => {
      setIsLoadingEvents(false);
    });
  }, [setInternalEvents]);

  useEffect(() => {
    setIsLoadingHazards(true);
    void setInternalHazards().then(() => {
      setIsLoadingHazards(false);
    });
  }, [setInternalHazards]);

  useEffect(() => {
    setIsLoadingFullScope(true);
    void setFullScope().then(() => {
      setIsLoadingFullScope(false);
    });
  }, [setFullScope]);

  useEffect(() => {
    setIsLoadingExternalHazards(true);
    void setExternalHazards().then(() => {
      setIsLoadingExternalHazards(false);
    });
  }, [setExternalHazards]);

  useEffect(() => {
    const eventsList = CreateGenericList<InternalEventsModelType>({
      modelList: internalEventsList,
      endpoint: "Internal Events",
      postTypedEndpoint: createInternalEvents,
      patchTypedEndpoint: editInternalEvent,
      deleteTypedEndpoint: deleteInternalEvent,
    });

    const hazardsList = CreateGenericList<InternalEventsModelType>({
      modelList: internalHazardsList,
      endpoint: "Internal Hazards",
      postTypedEndpoint: createInternalHazards,
      patchTypedEndpoint: editInternalHazard,
      deleteTypedEndpoint: deleteInternalHazard,
    });

    const fullScopeListItems = CreateGenericList<FullScopeModelType>({
      modelList: fullScopeList,
      endpoint: "Full Scope",
      postTypedEndpoint: createFullScope,
      patchTypedEndpoint: editFullScope,
      deleteTypedEndpoint: deleteFullScope,
    });

    const externalHazardsListItems = CreateGenericList<ExternalHazardsModelType>({
      modelList: externalHazardsList,
      endpoint: "External Hazards",
      postTypedEndpoint: createExternalHazards,
      patchTypedEndpoint: editExternalHazard,
      deleteTypedEndpoint: deleteExternalHazard,
    });

    setCombinedListItems([...eventsList, ...hazardsList, ...fullScopeListItems, ...externalHazardsListItems]);
  }, [
    createInternalEvents,
    deleteInternalEvent,
    editInternalEvent,
    internalEventsList,
    createInternalHazards,
    deleteInternalHazard,
    editInternalHazard,
    internalHazardsList,
    createFullScope,
    deleteFullScope,
    editFullScope,
    fullScopeList,
    createExternalHazards,
    deleteExternalHazard,
    editExternalHazard,
    externalHazardsList,
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
          height={490} // Adjust height according to the combined list
          borderRadius="m"
          isLoading={isLoadingEvents || isLoadingHazards || isLoadingFullScope || isLoadingExternalHazards}
          contentAriaLabel="Combined List"
        >
          <GenericItemList>{combinedListItems}</GenericItemList>
        </EuiSkeletonRectangle>
        <EuiSpacer size="s" />
      </EuiPageTemplate.Section>
    </EuiPageTemplate>
  );
}

export { ModelMenuContainer };
