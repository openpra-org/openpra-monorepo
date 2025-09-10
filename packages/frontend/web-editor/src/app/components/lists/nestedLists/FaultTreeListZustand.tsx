import { EuiPageTemplate, EuiSkeletonRectangle } from "@elastic/eui";
import { ReactElement, useEffect, useState } from "react";
import { FaultTree } from "shared-types/src/lib/api/NestedModelsAPI/FaultTreesApiManager";
import { GenericItemList } from "../GenericItemList";
import { CreateGenericList } from "../GenericList";

export interface FaultTreeListProps {
  name: string;
  faultTreeList: FaultTree[];
  addFaultTree: (data: Omit<FaultTree, 'id'>) => Promise<void>;
  getFaultTree: (id: string) => Promise<void>;
  deleteFaultTree: (id: string) => Promise<void>;
  editFaultTree: (modelId: string, data: Partial<FaultTree>) => Promise<void>;
}

function FaultTreeListZustand(props: FaultTreeListProps): JSX.Element {
  const { name, deleteFaultTree, getFaultTree, faultTreeList, editFaultTree, addFaultTree } = props;

  const [isLoading, setIsLoading] = useState(true);
  const [genericListItems, setGenericListItems] = useState<ReactElement[]>([]);

  useEffect(() => {
    setIsLoading(false); // We handle loading in parent component
  }, []);

  useEffect(() => {
    setGenericListItems(
      CreateGenericList<FaultTree>({
        modelList: faultTreeList,
        endpoint: name,
        getItemId: (item) => item.id,
        getItemName: (item) => item.name,
        getItemDescription: (item) => item.description || "",
        onEdit: editFaultTree,
        onDelete: deleteFaultTree,
      }),
    );
  }, [addFaultTree, deleteFaultTree, editFaultTree, faultTreeList, name]);

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
          contentAriaLabel="Fault tree list"
        >
          <GenericItemList>{genericListItems}</GenericItemList>
        </EuiSkeletonRectangle>
      </EuiPageTemplate.Section>
    </EuiPageTemplate>
  );
}

export { FaultTreeListZustand };