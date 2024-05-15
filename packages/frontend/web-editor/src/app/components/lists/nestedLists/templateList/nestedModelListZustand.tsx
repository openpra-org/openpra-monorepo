import { EuiPageTemplate, EuiSkeletonRectangle } from "@elastic/eui";
import { ReactElement, useEffect, useState } from "react";

import {
  NestedModelJSON,
  NestedModelType,
} from "shared-types/src/lib/types/modelTypes/innerModels/nestedModel";

import { GetCurrentModelIdString } from "shared-types/src/lib/api/TypedModelApiManager";
import { GenericItemList } from "../../GenericItemList";
import { CreateGenericList } from "../../GenericList";

export type NestedModelListProps = {
  name: string;
  NestedModelList: NestedModelType[];
  AddNestedModel: (data: NestedModelJSON) => Promise<void>;
  GetNestedModel: (id: string) => Promise<void>;
  DeleteNestedModel: (id: string) => Promise<void>;
  EditNestedModel: (
    modelId: string,
    data: Partial<NestedModelJSON>,
  ) => Promise<void>;
};

function NestedModelListZustand(props: NestedModelListProps): JSX.Element {
  const {
    name,
    DeleteNestedModel,
    GetNestedModel,
    NestedModelList,
    EditNestedModel,
    AddNestedModel,
  } = props;

  const [isLoading, setIsLoading] = useState(true);
  const [genericListItems, setGenericListItems] = useState<ReactElement[]>([]);

  useEffect(() => {
    setIsLoading(true);
    void GetNestedModel(GetCurrentModelIdString()).then(() => {
      setIsLoading(false);
    });
  }, [GetNestedModel]);

  useEffect(() => {
    setGenericListItems(
      CreateGenericList<NestedModelType>({
        modelList: NestedModelList,
        endpoint: name,
        postNestedEndpoint: AddNestedModel,
        patchNestedEndpoint: EditNestedModel,
        deleteNestedEndpoint: DeleteNestedModel,
      }),
    );
  }, [
    AddNestedModel,
    DeleteNestedModel,
    EditNestedModel,
    NestedModelList,
    name,
  ]);

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

export { NestedModelListZustand };
