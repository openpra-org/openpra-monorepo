import { EuiPageTemplate, EuiSkeletonRectangle, EuiSpacer } from "@elastic/eui";
import { ReactElement, useEffect, useState } from "react";
import { InternalEventsModelType } from "shared-types/src/lib/types/modelTypes/largeModels/internalEventsModel";
import { GenericItemList } from "../GenericItemList";
import { CreateGenericList } from "../GenericList";
import { UseGlobalStore } from "../../../zustand/Store";

function InternalHazardsList(): JSX.Element {
  const [isLoading, setIsLoading] = useState(true);
  const [genericListItems, setGenericListItems] = useState<ReactElement[]>([]);

  const internalHazardsList = UseGlobalStore.use.internalHazards();
  const setInternalHazards = UseGlobalStore.use.setInternalHazards();
  const createInternalHazards = UseGlobalStore.use.addInternalHazard();
  const deleteInternalHazard = UseGlobalStore.use.deleteInternalHazard();
  const editInternalHazard = UseGlobalStore.use.editInternalHazard();

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
      grow={true}
      restrictWidth={true}
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
}

export { InternalHazardsList };
