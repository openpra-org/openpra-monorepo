import { EuiPageTemplate, EuiSkeletonRectangle, EuiSpacer } from "@elastic/eui";
import { ExternalHazardsModelType } from "shared-types/src/lib/types/modelTypes/largeModels/externalHazardsModel";
import { ReactElement, useEffect, useState } from "react";
import { GenericItemList } from "../GenericItemList";
import { UseGlobalStore } from "../../../zustand/Store";
import { CreateGenericList } from "../GenericList";

function ExternalHazardsList(): JSX.Element {
  const [isLoading, setIsLoading] = useState(true);
  const [genericListItems, setGenericListItems] = useState<ReactElement[]>([]);

  const externalHazardsList = UseGlobalStore.use.ExternalHazards();
  const setExternalHazards = UseGlobalStore.use.SetExternalHazards();
  const createExternalHazards = UseGlobalStore.use.AddExternalHazard();
  const deleteExternalHazard = UseGlobalStore.use.DeleteExternalHazard();
  const editExternalHazard = UseGlobalStore.use.EditExternalHazard();

  useEffect(() => {
    setIsLoading(true);
    void setExternalHazards().then(() => {
      setIsLoading(false);
    });
  }, [setExternalHazards]);

  useEffect(() => {
    setGenericListItems(
      CreateGenericList<ExternalHazardsModelType>({
        modelList: externalHazardsList,
        endpoint: "External Hazards",
        getItemId: (item) => item.id,
        getItemName: (item) => item.label.name,
        getItemDescription: (item) => item.label.description,
        onEdit: editExternalHazard,
        onDelete: deleteExternalHazard,
      }),
    );
  }, [createExternalHazards, deleteExternalHazard, editExternalHazard, externalHazardsList]);

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

export { ExternalHazardsList };
