import { ReactElement } from "react";
import { TypedModelJSON, typedModelType } from "shared-types/src/lib/types/modelTypes/largeModels/typedModel";
import { NestedModelJSON, NestedModelType } from "shared-types/src/lib/types/modelTypes/innerModels/nestedModel";
import { GenericListItem } from "./GenericListItem";

interface CreateGenericListPropTypes<T> {
  modelList: T[];
  endpoint: string;
  postTypedEndpoint?: (data: Partial<TypedModelJSON>) => Promise<void>;
  patchTypedEndpoint?: (modelId: number, userId: number, data: Partial<TypedModelJSON>) => Promise<void>;
  deleteTypedEndpoint?: (id: number) => Promise<void>;
  postNestedEndpoint?: (data: NestedModelJSON) => Promise<void>;
  patchNestedEndpoint?: (modelId: string, data: Partial<NestedModelJSON>) => Promise<void>;
  deleteNestedEndpoint?: (id: string) => Promise<void>;
}

function CreateGenericList<T extends typedModelType | NestedModelType>(
  props: CreateGenericListPropTypes<T>,
): ReactElement[] {
  const {
    modelList,
    endpoint,
    postTypedEndpoint,
    patchTypedEndpoint,
    deleteTypedEndpoint,
    postNestedEndpoint,
    patchNestedEndpoint,
    deleteNestedEndpoint,
  } = props;

  return modelList.map((modelItem: T) => (
    <GenericListItem
      itemName={modelItem.label.name}
      id={modelItem.id}
      key={modelItem._id} // Use a unique key for each item (e.g., the ID)
      label={{
        name: modelItem.label.name,
        description: modelItem.label.description,
      }}
      path={modelItem._id}
      endpoint={endpoint} // Adjust this based on your model's structure
      postTypedEndpoint={postTypedEndpoint}
      deleteTypedEndpoint={deleteTypedEndpoint}
      patchTypedEndpoint={patchTypedEndpoint}
      postNestedEndpoint={postNestedEndpoint}
      patchNestedEndpointNew={patchNestedEndpoint}
      deleteNestedEndpointNew={deleteNestedEndpoint}
      users={"users" in modelItem ? modelItem.users : null}
      _id={modelItem._id}
    />
  )) as ReactElement[];
}

export { CreateGenericList };
