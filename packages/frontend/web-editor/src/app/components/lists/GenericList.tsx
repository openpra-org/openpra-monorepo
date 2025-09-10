import { ReactElement } from "react";
import { GenericListItem } from "./GenericListItem";

interface CreateGenericListOptions<T> {
  modelList: T[];
  endpoint: string;
  getItemId: (item: T) => string;
  getItemName: (item: T) => string;
  getItemDescription: (item: T) => string;
  onEdit: (id: string, data: any) => Promise<any>;
  onDelete: (id: string) => Promise<void>;
}

export function CreateGenericList<T>(options: CreateGenericListOptions<T>): ReactElement[] {
  const {
    modelList,
    endpoint,
    getItemId,
    getItemName,
    getItemDescription,
    onEdit,
    onDelete,
  } = options;

  return modelList.map((model) => (
    <GenericListItem
      key={getItemId(model)}
      id={getItemId(model)}
      name={getItemName(model)}
      description={getItemDescription(model)}
      endpoint={endpoint}
      onEdit={onEdit}
      onDelete={onDelete}
    />
  ));
}
