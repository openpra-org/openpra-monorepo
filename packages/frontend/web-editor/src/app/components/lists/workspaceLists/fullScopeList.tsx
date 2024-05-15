import { EuiPageTemplate, EuiSkeletonRectangle, EuiSpacer } from "@elastic/eui";
import { ReactElement, useEffect, useState } from "react";
import { FullScopeModelType } from "shared-types/src/lib/types/modelTypes/largeModels/fullScopeModel";
import { GenericItemList } from "../GenericItemList";
import { UseGlobalStore } from "../../../zustand/Store";
import { CreateGenericList } from "../GenericList";

function FullScopeList(): JSX.Element {
  const [isLoading, setIsLoading] = useState(true);
  const [genericListItems, setGenericListItems] = useState<ReactElement[]>([]);

  const fullScopeList = UseGlobalStore.use.fullScope();
  const setFullScope = UseGlobalStore.use.setFullScope();
  const createFullScope = UseGlobalStore.use.addFullScope();
  const deleteFullScope = UseGlobalStore.use.deleteFullScope();
  const editFullScope = UseGlobalStore.use.editFullScope();

  useEffect(() => {
    setIsLoading(true);
    void setFullScope().then(() => {
      setIsLoading(false);
    });
  }, [setFullScope]);

  useEffect(() => {
    setGenericListItems(
      CreateGenericList<FullScopeModelType>({
        modelList: fullScopeList,
        endpoint: "Full Scope",
        postTypedEndpoint: createFullScope,
        patchTypedEndpoint: editFullScope,
        deleteTypedEndpoint: deleteFullScope,
      }),
    );
  }, [createFullScope, deleteFullScope, editFullScope, fullScopeList]);

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

export { FullScopeList };
