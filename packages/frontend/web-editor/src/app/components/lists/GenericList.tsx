import { ReactElement } from "react";
import {
  TypedModelJSON,
  typedModelType,
} from "shared-types/src/lib/types/modelTypes/largeModels/typedModel";
import { GenericListItem } from "./GenericListItem";

function CreateGenericList<T extends typedModelType>(
  modelList: T[],
  endpoint: string,
  postFunction?: (data: Partial<TypedModelJSON>) => Promise<void>,
  patchFunction?: (
    modelId: number,
    userId: number,
    data: Partial<TypedModelJSON>,
  ) => Promise<void>,
  deleteFunction?: (id: number) => Promise<void>,
  patchTypedEndpoint?: (
    modelId: number,
    userId: number,
    data: Partial<TypedModelJSON>,
  ) => Promise<T>,
  deleteTypedEndpoint?: (id: number) => Promise<T>,
): ReactElement[] {
  return modelList.map((modelItem: T) => (
    <GenericListItem
      itemName={modelItem.label.name}
      id={modelItem.id}
      key={modelItem._id} // Use a unique key for each item (e.g., the ID)
      label={{
        name: modelItem.label.name,
        description: modelItem.label.description,
      }}
      path={`${modelItem._id}`}
      endpoint={endpoint} // Adjust this based on your model's structure
      postFunction={postFunction}
      deleteFunction={deleteFunction}
      patchFunction={patchFunction}
      deleteTypedEndpoint={deleteTypedEndpoint}
      patchTypedEndpoint={patchTypedEndpoint}
      users={modelItem.users}
      _id={modelItem._id}
    />
  )) as ReactElement[];
}

export { CreateGenericList };
