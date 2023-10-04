import {useEffect, useState} from 'react'
import {
  EuiTextColor,
  EuiFlexGroup,
  EuiFlexItem,
  EuiFlexGrid,
  EuiPanel,
  EuiTitle,
  useIsWithinBreakpoints,
  EuiText, EuiIcon, EuiSkeletonRectangle,
} from "@elastic/eui";
import SettingsAccordian from "./SettingsAccordian";
import TypedModelApiManager from 'shared-types/src/lib/api/TypedModelApiManager';
import TypedModel from 'shared-types/src/lib/types/modelTypes/largeModels/typedModel';
import TypedModelActionForm from '../forms/typedModelActionForm';

const TYPED_MODEL_TYPE_LOCATION = 1;

async function fetchCurrentTypedModel() {
  try {
    return await TypedModelApiManager.getCurrentTypedModel();
  } catch (error) {
    throw new Error('Error fetching current typed model: ');
  }
}

//a change of new item that lets you edit an item, though right now functionality for that isnt available because it requires database
export default function EditCurrentModel(){

    //this is what is in the newItem structure, will eventually be used to actually make things
    //this is also subject to change, probably needs a type passed in from props eventually
    const newItem = new TypedModel()

    //grabs the current models information
    const [currentModel, setCurrentModel] = useState(newItem)

    //sets the current endpoint
    let endpoint

    //this isLoading set is here to make sure we dont load in the other component too soon
    const [isLoaded, setIsLoaded] = useState(false)

    const splitPath = window.location.pathname.split('/'); // Gets the path part of the URL (/internal-events/2) // Splits the path into segments using the '/' character
    const currentModelType = splitPath[TYPED_MODEL_TYPE_LOCATION];
    
    if(currentModelType === "internal-events"){
      endpoint = TypedModelApiManager.patchInternalEvent
    } else if (currentModelType === "internal-hazards"){
      endpoint = TypedModelApiManager.patchInternalHazard
    } else if (currentModelType === "external-hazards"){
      endpoint = TypedModelApiManager.patchExternalHazard
    } else if (currentModelType === "full-scope"){
      endpoint = TypedModelApiManager.patchFullScope
    }

    //this takes any type instead of what it should, I have *no* idea how to carry over the types across promises, it doesn't seem to work and I've tinkered quite a bit
    const updateCurrentModel = (newModel: any) => {
      const addModel = new TypedModel(newModel.id, newModel.label.name, newModel.label.description, newModel.users)
      setCurrentModel(addModel)
    }

    useEffect(() => {
        const fetchModel = async () => {
        try {
            const model = await fetchCurrentTypedModel();
            updateCurrentModel(model);
            setIsLoaded(true)
        } catch (error) {
            console.error('Error fetching fixtures:', error);
        }
        };
        fetchModel();
    }, []);
  
  //const [itemInfo, setItemInfo] = useState(newItem)

  const buttonContent = (
    <div>
      <EuiFlexGroup gutterSize="s" alignItems="center" responsive={false}>
        <EuiFlexItem grow={false}>
          <EuiIcon type="dashboardApp" size="l" />
        </EuiFlexItem>
        <EuiFlexItem>
          <EuiTitle size="xs">
            <h3>General Settings</h3>
          </EuiTitle>
        </EuiFlexItem>
      </EuiFlexGroup>
      <EuiText size="s">
        <p>
          <EuiTextColor color="subdued">
            Update the model name, description, and ID.
          </EuiTextColor>
        </p>
      </EuiText>
    </div>
  );
  //screen breakpoints
  const smallScreen = useIsWithinBreakpoints(['xs', 's', 'm']);

  return (
    <SettingsAccordian id="model_settings" buttonContent={buttonContent} initial={true}>
      <EuiFlexGrid direction="row" responsive={false} columns={smallScreen ? 1 : 2}>
        <EuiFlexItem grow={true}>
          <EuiPanel paddingSize="xl">
            <EuiSkeletonRectangle
              width="100%"
              height={500}
              borderRadius="m"
              isLoading={!isLoaded}
              contentAriaLabel="Edit Current Model"
              data-testid="editBox"
            >
              <TypedModelActionForm
                action="edit"
                itemName={currentModelType}
                patchEndpoint={endpoint}
                initialFormValues={{
                  id: currentModel.getId(),
                  label: currentModel.getLabel(),
                  users: currentModel.getUsers()
                }}
              />
            </EuiSkeletonRectangle>
          </EuiPanel>
        </EuiFlexItem>
      </EuiFlexGrid>
    </SettingsAccordian>
  )
}

