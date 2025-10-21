import { EuiPageTemplate, EuiSkeletonRectangle } from "@elastic/eui";
import { ReactElement, useEffect, useState } from "react";

import { NestedModel } from "shared-types/src/lib/types/modelTypes/innerModels/nestedModel";
import { LabelJSON } from "shared-types/src/lib/types/Label";

import { GetCurrentModelId, GetCurrentModelIdString } from "shared-sdk/lib/api/TypedModelApiManager";
import { GenericListItem } from "../../GenericListItem";
import { GenericItemList } from "../../GenericItemList";
import { UseGlobalStore } from "../../../../zustand/Store";

export interface NestedModelListProps {
  name: string;
  getNestedEndpoint?: (id: number) => Promise<NestedModel[]>;
  getNestedEndpointString?: (id: string) => Promise<NestedModel[]>;
  deleteNestedEndpoint: (id: number) => NonNullable<unknown>;
  patchNestedEndpoint: (id: number, data: LabelJSON) => NonNullable<unknown>;
}

//grabs the model List
async function fetchModelList(
  getNestedEndpoint?: (id: number) => Promise<NestedModel[]>,
  getNestedEndpointString?: (id: string) => Promise<NestedModel[]>,
): Promise<NestedModel[]> {
  // const modelId = GetCurrentModelIdString();
  try {
    const modelList = getNestedEndpoint
      ? await getNestedEndpoint(GetCurrentModelId())
      : getNestedEndpointString
      ? await getNestedEndpointString(GetCurrentModelIdString())
      : [];
    return modelList;
    // return await getNestedEndpointString(modelId);
  } catch {
    return [];
  }
}

//this doesn't work right now, it returns a typedModelJSon I think instead of internaleventsmdoel
//this works but poorly, need to fix how ids are done
//I also cant really get the items to know what type they are, I'm assuming typedmodeljson
const getFixtures = async (
  deleteNestedEndpoint: (id: number) => NonNullable<unknown>,
  patchNestedEndpoint: (id: number, data: LabelJSON) => NonNullable<unknown>,
  name: string,
  getNestedEndpoint?: (id: number) => Promise<NestedModel[]>,
  getNestedEndpointString?: (id: string) => Promise<NestedModel[]>,
): Promise<JSX.Element[]> => {
  try {
    const modelList = getNestedEndpoint
      ? await fetchModelList(getNestedEndpoint, undefined)
      : getNestedEndpointString
      ? await fetchModelList(undefined, getNestedEndpointString)
      : [];
    const nestedModelList: NestedModel[] = modelList.map((item: unknown) => {
      const typed = item as {
        label: { name: string; description: string };
        id: number | string;
        parentIds?: (number | string)[];
      };
      const parentIds: number[] = (typed.parentIds ?? []).map((p) => Number(p));
      return new NestedModel(typed.label.name, typed.label.description, Number(typed.id), parentIds);
    });

    //now we map these events to what they should be and display them
    return nestedModelList.map((modelItem: NestedModel) => (
      <GenericListItem
        itemName={modelItem.getLabel().getName()}
        id={modelItem.getId()}
        key={modelItem.getId()} // Use a unique key for each item (e.g., the ID)
        label={{
          name: modelItem.getLabel().getName(),
          description: modelItem.getLabel().getDescription(),
        }}
        path={String(modelItem.getId())}
        endpoint={name} // Adjust this based on your model's structure
        deleteNestedEndpoint={deleteNestedEndpoint}
        patchNestedEndpoint={patchNestedEndpoint}
      />
    ));
  } catch {
    return []; // Return an empty array or handle the error as needed
  }
};

function NestedModelList(props: NestedModelListProps): JSX.Element {
  const [genericListItems, setGenericListItems] = useState<ReactElement[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const { name, deleteNestedEndpoint, getNestedEndpoint, getNestedEndpointString, patchNestedEndpoint } = props;

  useEffect(() => {
    const fetchGenericListItems = async (): Promise<void> => {
      try {
        const items = await getFixtures(
          deleteNestedEndpoint,
          patchNestedEndpoint,
          name,
          getNestedEndpoint,
          getNestedEndpointString,
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
  }, [deleteNestedEndpoint, getNestedEndpoint, getNestedEndpointString, name, patchNestedEndpoint]);

  const SetInitiatingEvents = UseGlobalStore.use.SetInitiatingEvents();

  useEffect(() => {
    void SetInitiatingEvents(GetCurrentModelIdString());
  }, [SetInitiatingEvents]);

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
