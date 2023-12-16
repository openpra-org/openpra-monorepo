import ApiManager from "shared-types/src/lib/api/ApiManager";
import { EuiPageTemplate, EuiSkeletonRectangle, EuiSpacer } from "@elastic/eui";
import { FullScopeModel } from "shared-types/src/lib/types/modelTypes/largeModels/fullScopeModel";
import { ReactElement, useEffect, useState } from "react";
import {
  DeleteFullScope,
  GetFullScopeModels,
  PatchFullScope,
} from "shared-types/src/lib/api/TypedModelApiManager";
import GenericListItem from "../GenericListItem";
import GenericItemList from "../GenericItemList";

//grabs the model List
async function fetchModelList() {
  try {
    return await GetFullScopeModels(ApiManager.getCurrentUser().user_id);
  } catch (error) {
    console.error("Error fetching internal events:", error);
    return [];
  }
}

//this doesnt work right now, it returns a typedModelJSon I think instead of internaleventsmdoel
//this works but poorly, need to fix how ids are done
//I also cant really get the items to know what type they are, I'm assuming typedmodeljson
const getFixtures = async (): Promise<JSX.Element[]> => {
  try {
    const modelList = await fetchModelList();
    //we convert the full object type returned here (that should be  promise<internalevents>) but it isnt
    const fullScopeList: FullScopeModel[] = modelList.map(
      (item: any) =>
        new FullScopeModel(
          item.id,
          item.label.name,
          item.label.description,
          item.users,
        ),
    );
    //now we map these events to what they should be and display them
    return fullScopeList.map((modelItem: FullScopeModel) => (
      <GenericListItem
        itemName={modelItem.getLabel().getName()}
        id={modelItem.getId()}
        key={modelItem.getId()} // Use a unique key for each item (e.g., the ID)
        label={{
          name: modelItem.getLabel().getName(),
          description: modelItem.getLabel().getDescription(),
        }}
        path={`/full-scope/${modelItem.getId()}`}
        endpoint={`full-scope`} // Adjust this based on your model's structure
        deleteTypedEndpoint={DeleteFullScope}
        patchTypedEndpoint={PatchFullScope}
        users={modelItem.getUsers()}
      />
    ));
  } catch (error) {
    console.error("Error fetching internal events:", error);
    return []; // Return an empty array or handle the error as needed
  }
};

export default function FullScopeList() {
  const [genericListItems, setGenericListItems] = useState<ReactElement[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchGenericListItems = async () => {
      try {
        const items = await getFixtures();
        setGenericListItems(items);
        setIsLoading(false);
      } catch (error) {
        console.error("Error fetching fixtures:", error);
        setGenericListItems([]); // Set empty array or handle the error as needed
        if (error) {
          setIsLoading(true);
        }
      }
    };

    fetchGenericListItems();
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
        <EuiSpacer size="s" />
      </EuiPageTemplate.Section>
    </EuiPageTemplate>
  );
}
