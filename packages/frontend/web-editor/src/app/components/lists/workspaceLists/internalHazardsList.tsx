import { EuiPageTemplate, EuiSkeletonRectangle, EuiSpacer } from "@elastic/eui";
import { ReactElement, useEffect, useState } from "react";
import { InternalEventsModelType } from "shared-types/src/lib/types/modelTypes/largeModels/internalEventsModel";

import { UseGlobalStore } from "../../../zustand/Store";
import { GenericItemList } from "../GenericItemList";
import { CreateGenericList } from "../GenericList";

const InternalHazardsList = (): JSX.Element => {
  const [isLoading, setIsLoading] = useState(true);
  const [genericListItems, setGenericListItems] = useState<ReactElement[]>([]);

  const internalHazardsList = UseGlobalStore.use.InternalHazards();
  const setInternalHazards = UseGlobalStore.use.SetInternalHazards();
  const createInternalHazards = UseGlobalStore.use.AddInternalHazard();
  const deleteInternalHazard = UseGlobalStore.use.DeleteInternalHazard();
  const editInternalHazard = UseGlobalStore.use.EditInternalHazard();

  useEffect(() => {
    setIsLoading(true);
    void setInternalHazards().then(() => {
      setIsLoading(false);
    });
  }, [setInternalHazards]);

  useEffect(() => {
    setGenericListItems(
      CreateGenericList<InternalEventsModelType>({
        modelList: internalHazardsList,
        endpoint: "Internal Hazards",
        postTypedEndpoint: createInternalHazards,
        patchTypedEndpoint: editInternalHazard,
        deleteTypedEndpoint: deleteInternalHazard,
      }),
    );
  }, [createInternalHazards, deleteInternalHazard, editInternalHazard, internalHazardsList]);

  return (
    <EuiPageTemplate
      panelled={false}
      offset={48}
      grow
      restrictWidth
    >
      <EuiPageTemplate.Section>
        <EuiSkeletonRectangle
          width="100%"
          height={70}
          borderRadius="m"
          isLoading={isLoading}
          contentAriaLabel="Example description"
        >
          <GenericItemList>{genericListItems}</GenericItemList>
        </EuiSkeletonRectangle>
        <EuiSpacer size="s" />
      </EuiPageTemplate.Section>
    </EuiPageTemplate>
  );
};

export { InternalHazardsList };
