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

async function fetchModelList(
  getNestedEndpoint?: (id: number) => Promise<NestedModel[]>,
  getNestedEndpointString?: (id: string) => Promise<NestedModel[]>,
): Promise<NestedModel[]> {
  try {
    const modelList =
      getNestedEndpoint ? await getNestedEndpoint(GetCurrentModelId())
      : getNestedEndpointString ? await getNestedEndpointString(GetCurrentModelIdString())
      : [];
    return modelList;
  } catch {
    return [];
  }
}

const getFixtures = async (
  deleteNestedEndpoint: (id: number) => NonNullable<unknown>,
  patchNestedEndpoint: (id: number, data: LabelJSON) => NonNullable<unknown>,
  name: string,
  getNestedEndpoint?: (id: number) => Promise<NestedModel[]>,
  getNestedEndpointString?: (id: string) => Promise<NestedModel[]>,
): Promise<JSX.Element[]> => {
  try {
    const modelList =
      getNestedEndpoint ? await fetchModelList(getNestedEndpoint, undefined)
      : getNestedEndpointString ? await fetchModelList(undefined, getNestedEndpointString)
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

    return nestedModelList.map((modelItem: NestedModel) => (
      <GenericListItem
        itemName={modelItem.getLabel().getName()}
        id={modelItem.getId()}
        key={modelItem.getId()}
        label={{
          name: modelItem.getLabel().getName(),
          description: modelItem.getLabel().getDescription(),
        }}
        path={String(modelItem.getId())}
        endpoint={name}
        deleteNestedEndpoint={deleteNestedEndpoint}
        patchNestedEndpoint={patchNestedEndpoint}
      />
    ));
  } catch {
    return [];
  }
};

function NestedModelList(props: NestedModelListProps): JSX.Element {
  const [genericListItems, setGenericListItems] = useState<ReactElement[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const { name, deleteNestedEndpoint, getNestedEndpoint, getNestedEndpointString, patchNestedEndpoint } = props;
  const refreshCount = UseGlobalStore((state) => state.NestedModels.nestedListRefreshCount);

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
        setGenericListItems([]);
        if (error) {
          setIsLoading(true);
        }
      }
    };
    void fetchGenericListItems();
  }, [deleteNestedEndpoint, getNestedEndpoint, getNestedEndpointString, name, patchNestedEndpoint, refreshCount]);

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
