import ApiManager from "shared-types/src/lib/api/ApiManager";
import { EuiPageTemplate, EuiSkeletonRectangle, EuiSpacer } from "@elastic/eui";
import { ExternalHazardsModel } from "shared-types/src/lib/types/modelTypes/largeModels/externalHazardsModel";
import { useEffect, useState } from "react";
import {
  DeleteExternalHazard,
  GetExternalHazards,
  PatchExternalHazard,
} from "shared-types/src/lib/api/TypedModelApiManager";
import { GenericListItem } from "../GenericListItem";
import { GenericItemList } from "../GenericItemList";

//grabs the model List
async function fetchModelList(): Promise<ExternalHazardsModel[]> {
  try {
    return await GetExternalHazards(ApiManager.getCurrentUser().user_id);
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
    const externalHazardsModelList: ExternalHazardsModel[] = modelList.map(
      (item: any) =>
        new ExternalHazardsModel(
          item.id,
          item.label.name,
          item.label.description,
          item.users,
        ),
    );
    //now we map these events to what they should be and display them
    const genericListItems = externalHazardsModelList.map(
      (modelItem: ExternalHazardsModel) => (
        <GenericListItem
          itemName={modelItem.getLabel().getName()}
          id={modelItem.getId()}
          key={modelItem.getId()} // Use a unique key for each item (e.g., the ID)
          label={{
            name: modelItem.getLabel().getName(),
            description: modelItem.getLabel().getDescription(),
          }}
          path={`/external-hazards/${modelItem.getId()}`}
          endpoint={`external-hazard`} // Adjust this based on your model's structure
          deleteTypedEndpoint={DeleteExternalHazard}
          patchTypedEndpoint={PatchExternalHazard}
          users={modelItem.getUsers()}
        />
      ),
    );

    return genericListItems;
  } catch (error) {
    console.error("Error fetching internal events:", error);
    return []; // Return an empty array or handle the error as needed
  }
};

function ExternalHazardsList(): JSX.Element {
  const [genericListItems, setGenericListItems] = useState<JSX.Element[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchGenericListItems = async (): Promise<void> => {
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
      {/* <EuiPageTemplate.Header
                alignItems="center"
                pageTitle="Internal Events"
                responsive={false}
                bottomBorder="extended"
                rightSideItems={[
                    <CreateInternalEventsButton />
                ]}
            /> */}
      <EuiPageTemplate.Section>
        <EuiSkeletonRectangle
          width="100%"
          height={70}
          borderRadius="m"
          isLoading={isLoading}
          contentAriaLabel="Example description"
        >
          <GenericItemList>{genericListItems}</GenericItemList>
        </EuiSkeletonRectangle>
        <EuiSpacer size="s" />
        <EuiSkeletonRectangle
          width="100%"
          height={70}
          borderRadius="m"
          isLoading={isLoading}
          contentAriaLabel="Example description"
        ></EuiSkeletonRectangle>
        <EuiSpacer size="s" />
        <EuiSkeletonRectangle
          width="100%"
          height={70}
          borderRadius="m"
          isLoading={isLoading}
          contentAriaLabel="Example description"
        ></EuiSkeletonRectangle>
        <EuiSpacer size="s" />
        <EuiSkeletonRectangle
          width="100%"
          height={70}
          borderRadius="m"
          isLoading={isLoading}
          contentAriaLabel="Example description"
        ></EuiSkeletonRectangle>
        <EuiSpacer size="s" />
        <EuiSkeletonRectangle
          width="100%"
          height={70}
          borderRadius="m"
          isLoading={isLoading}
          contentAriaLabel="Example description"
        ></EuiSkeletonRectangle>
        <EuiSpacer size="s" />
        <EuiSkeletonRectangle
          width="100%"
          height={70}
          borderRadius="m"
          isLoading={isLoading}
          contentAriaLabel="Example description"
        ></EuiSkeletonRectangle>
        <EuiSpacer size="s" />
        <EuiSkeletonRectangle
          width="100%"
          height={70}
          borderRadius="m"
          isLoading={isLoading}
          contentAriaLabel="Example description"
        ></EuiSkeletonRectangle>
        <EuiSpacer size="s" />
        <EuiSkeletonRectangle
          width="100%"
          height={70}
          borderRadius="m"
          isLoading={isLoading}
          contentAriaLabel="Example description"
        ></EuiSkeletonRectangle>
        <EuiSpacer size="s" />
        <EuiSkeletonRectangle
          width="100%"
          height={70}
          borderRadius="m"
          isLoading={isLoading}
          contentAriaLabel="Example description"
        ></EuiSkeletonRectangle>
        <EuiSpacer size="s" />
      </EuiPageTemplate.Section>
    </EuiPageTemplate>
  );
}

export { ExternalHazardsList };
