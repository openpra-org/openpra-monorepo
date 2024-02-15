import { EuiPageTemplate, EuiSkeletonRectangle, EuiSpacer } from "@elastic/eui";
import ApiManager from "shared-types/src/lib/api/ApiManager";
import { InternalEventsModel } from "shared-types/src/lib/types/modelTypes/largeModels/internalEventsModel";
import { ReactElement, useEffect, useState } from "react";
import {
  DeleteInternalEvent,
  GetInternalEvents,
  PatchInternalEvent,
} from "shared-types/src/lib/api/TypedModelApiManager";
import { GenericListItem } from "../GenericListItem";
import { GenericItemList } from "../GenericItemList";

// TODO:: This while fetching code is broken, fix it.

//grabs the model List
async function fetchModelList() {
  try {
    return await GetInternalEvents(ApiManager.getCurrentUser().user_id);
  } catch (error) {
    console.error("Error fetching internal events:", error);
    return [];
  }
}

//this doesnt work right now, it returns a typedModelJSon I think instead of internaleventsmdoel
//this works but poorly, need to fix how ids are done
//I also cant really get the items to know what type they are, I'm assuming typedmodeljson
const getFixtures = async (): Promise<ReactElement[]> => {
  try {
    const modelList = await fetchModelList();
    //we convert the full object type returned here (that should be  promise<internalevents>) but it isnt
    const internalEventsModelList: InternalEventsModel[] = modelList.map(
      (item: any) =>
        new InternalEventsModel(
          item.id,
          item.label.name,
          item.label.description,
          item.users,
        ),
    );
    //now we map these events to what they should be and display them
    return internalEventsModelList.map((modelItem: InternalEventsModel) => (
      <GenericListItem
        itemName={modelItem.getLabel().getName()}
        id={modelItem.getId()}
        key={modelItem.getId()} // Use a unique key for each item (e.g., the ID)
        label={{
          name: modelItem.getLabel().getName(),
          description: modelItem.getLabel().getDescription(),
        }}
        path={`${modelItem.getId()}`}
        endpoint={`internal-event`} // Adjust this based on your model's structure
        deleteTypedEndpoint={DeleteInternalEvent}
        patchTypedEndpoint={PatchInternalEvent}
        users={modelItem.getUsers()}
      />
    ));
  } catch (error) {
    console.error("Error fetching internal events:", error);
    return []; // Return an empty array or handle the error as needed
  }
};

function InternalEventsList() {
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

export { InternalEventsList };
