import { EuiPageTemplate, EuiSkeletonRectangle } from "@elastic/eui";
import { ReactElement, useEffect, useState } from "react";

import { NestedModel } from "shared-types/src/lib/types/modelTypes/innerModels/nestedModel";
import { LabelJSON } from "shared-types/src/lib/types/Label";

import { GetCurrentModelId, GetCurrentModelIdString } from "shared-types/src/lib/api/TypedModelApiManager";
import { GenericListItem } from "../../GenericListItem";
import { GenericItemList } from "../../GenericItemList";
import { UseGlobalStore } from "../../../../zustand/Store";

export interface NestedModelListProps {
  name: string;
  getNestedEndpoint?: (id: string) => Promise<NestedModel[]>;
  deleteNestedEndpoint: (id: string) => Promise<void>;
  patchNestedEndpoint: (id: string, data: any) => Promise<NestedModel>;
}

// Grabs the model List
async function fetchModelList(
  getNestedEndpoint?: (id: string) => Promise<NestedModel[]>,
): Promise<NestedModel[]> {
  try {
    const modelList = getNestedEndpoint
      ? await getNestedEndpoint(GetCurrentModelId())
      : [];
    return modelList;
  } catch (error) {
    return [];
  }
}

//this doesn't work right now, it returns a typedModelJSon I think instead of internaleventsmdoel
//this works but poorly, need to fix how ids are done
//I also cant really get the items to know what type they are, I'm assuming typedmodeljson
const getFixtures = async (
  name: string,
  deleteNestedEndpoint: (id: string) => Promise<void>,
  patchNestedEndpoint: (id: string, data: any) => Promise<NestedModel>,
  getNestedEndpoint?: (id: string) => Promise<NestedModel[]>,
): Promise<JSX.Element[]> => {
  try {
    const modelList = getNestedEndpoint
      ? await fetchModelList(getNestedEndpoint)
      : [];
    const nestedModelList: NestedModel[] = modelList.map(
      (item: any) => new NestedModel(item.label.name, item.label.description, item.id, item.parentIds),
    );

    //now we map these events to what they should be and display them
    return nestedModelList.map((modelItem: NestedModel) => (
      <GenericListItem
        id={String(modelItem.getId())}
        key={modelItem.getId()} // Use a unique key for each item (e.g., the ID)
        name={modelItem.getLabel().getName()}
        description={modelItem.getLabel().getDescription()}
        endpoint={name}
        onEdit={patchNestedEndpoint}
        onDelete={deleteNestedEndpoint}
      />
    ));
  } catch (error) {
    return []; // Return an empty array or handle the error as needed
  }
};

function NestedModelList(props: NestedModelListProps): JSX.Element {
  const [genericListItems, setGenericListItems] = useState<ReactElement[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const { name, deleteNestedEndpoint, getNestedEndpoint, patchNestedEndpoint } = props;

  useEffect(() => {
    const fetchGenericListItems = async (): Promise<void> => {
      try {
        const items = await getFixtures(
          name,
          deleteNestedEndpoint,
          patchNestedEndpoint,
          getNestedEndpoint,
        );
        setGenericListItems(items);
        setIsLoading(false);
      } catch (error) {
        setGenericListItems([]); // Set empty array or handle the error as needed
        if (error) {
          setIsLoading(true);
        }
      }
    };
    void fetchGenericListItems();
  }, [deleteNestedEndpoint, getNestedEndpoint, name, patchNestedEndpoint]);

  const SetInitiatingEvents = UseGlobalStore.use.SetInitiatingEvents();

  useEffect(() => {
    void SetInitiatingEvents(GetCurrentModelIdString()).then(() => {});
  }, []);

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
      </EuiPageTemplate.Section>
    </EuiPageTemplate>
  );
}

export { NestedModelList };
