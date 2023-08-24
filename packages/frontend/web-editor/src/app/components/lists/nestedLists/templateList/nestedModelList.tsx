
import { EuiPageTemplate, EuiSkeletonRectangle, EuiSpacer } from "@elastic/eui";
import TypedModelApiManager from "packages/shared-types/src/lib/api/TypedModelApiManager";
import { useEffect, useState } from "react";
import NestedModel from "packages/shared-types/src/lib/types/modelTypes/innerModels/nestedModel";
import GenericListItem from "../../GenericListItem";
import GenericItemList from "../../GenericItemList";
import { LabelJSON } from "packages/shared-types/src/lib/types/Label";

export interface NestedModelListProps {
    name: string
    getNestedEndpoint: (id: number) => Promise<NestedModel[]>;
    deleteNestedEndpoint: (id: number) => {};
    patchNestedEndpoint: (id: number, data: LabelJSON) => {};
}

//grabs the model List
async function fetchModelList(getNestedEndpoint: (id: number) => Promise<NestedModel[]>){
  const modelId = TypedModelApiManager.getCurrentModelId()
  try {
    return await getNestedEndpoint(modelId)
  } catch (error) {
    console.error('Error fetching internal events:', error);
    return []
  }
}

//this doesnt work right now, it returns a typedModelJSon I think instead of internaleventsmdoel
//this works but poorly, need to fix how ids are done
//I also cant really get the items to know what type they are, I'm assuming typedmodeljson
const getFixtures = async (getNestedEndpoint: (id: number) => Promise<NestedModel[]>, deleteNestedEndpoint: (id: number) => {}, patchNestedEndpoint: (id: number, data: LabelJSON) => {}, 
  name: string): Promise<JSX.Element[]> => {
    try {
      const modelList = await fetchModelList(getNestedEndpoint); 

      const nestedModelList: NestedModel[] = modelList.map((item: any) => {
        return new NestedModel(item.label.name, item.label.description, item.id, item.parentIds);
      });

      //now we map these events to what they should be and display them
      const genericListItems = nestedModelList.map((modelItem: NestedModel) => (
        <GenericListItem
          itemName={modelItem.getLabel().getName()}
          id={modelItem.getId()}
          key={modelItem.getId()} // Use a unique key for each item (e.g., the ID)
          label={{
            name: modelItem.getLabel().getName(),
            description: modelItem.getLabel().getDescription(),
          }}
          path={`${modelItem.getId()}`}
          endpoint={name} // Adjust this based on your model's structure
          deleteNestedEndpoint={deleteNestedEndpoint}
          patchNestedEndpoint={patchNestedEndpoint}
        />
      ));
  
      return genericListItems;
    } catch (error) {
      console.error('Error fetching internal events:', error);
      return []; // Return an empty array or handle the error as needed
    }
  };

export default function NestedModelList(props: NestedModelListProps){

    const [genericListItems, setGenericListItems] = useState<JSX.Element[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const {name, deleteNestedEndpoint, getNestedEndpoint, patchNestedEndpoint} = props;

    useEffect(() => {
        const fetchGenericListItems = async () => {
        try {
            const items = await getFixtures(getNestedEndpoint, deleteNestedEndpoint, patchNestedEndpoint, name);
            setGenericListItems(items);
            setIsLoading(false);
        } catch (error) {
            console.error('Error fetching fixtures:', error);
            setGenericListItems([]); // Set empty array or handle the error as needed
            if(error) {
                setIsLoading(true)
            }
        }
        };
        fetchGenericListItems();
    }, []);

    return (
        <EuiPageTemplate panelled={false} offset={48} grow={true} restrictWidth={true}>
            <EuiPageTemplate.Section>
                <EuiSkeletonRectangle
                    width="100%"
                    height={490}
                    borderRadius='m'                    
                    isLoading={isLoading}
                    contentAriaLabel="Example description"
                >
                    <GenericItemList>
                        {genericListItems}
                    </GenericItemList>
                </EuiSkeletonRectangle>
            </EuiPageTemplate.Section>
        </EuiPageTemplate>
    );
}
