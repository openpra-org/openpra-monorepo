import {
  EuiFlexGrid,
  EuiFlexGroup,
  EuiFlexItem,
  EuiIcon,
  EuiPanel,
  EuiSkeletonRectangle,
  EuiText,
  EuiTextColor,
  EuiTitle,
  useIsWithinBreakpoints,
} from "@elastic/eui";
import { useEffect, useState } from "react";
import { GetCurrentTypedModel } from "shared-types/src/lib/api/TypedModelApiManager";
import TypedModel from "shared-types/src/lib/types/modelTypes/largeModels/typedModel";

import { UseGlobalStore } from "../../zustand/Store";
import { TypedModelActionForm } from "../forms/typedModelActionForm";
import { SettingsAccordian } from "./SettingsAccordian";

const TYPED_MODEL_TYPE_LOCATION = 1;

async function fetchCurrentTypedModel(): Promise<TypedModel> {
  try {
    return await GetCurrentTypedModel();
  } catch (error) {
    throw new Error("Error fetching current typed model: ");
  }
}

//a change of new item that lets you edit an item, though right now functionality for that isn't available because it requires database
const EditCurrentModel = (): JSX.Element => {
  //this is what is in the newItem structure, will eventually be used to actually make things
  //this is also subject to change, probably needs a type passed in from props eventually
  const newItem = new TypedModel();

  const editInternalEvent = UseGlobalStore.use.EditInternalEvent();
  const editInternalHazard = UseGlobalStore.use.EditInternalHazard();
  const editExternalHazard = UseGlobalStore.use.EditExternalHazard();
  const editFullScope = UseGlobalStore.use.EditFullScope();

  //grabs the current models information
  const [currentModel, setCurrentModel] = useState(newItem);

  //sets the current endpoint
  let endpoint = editInternalEvent;

  //this isLoading set is here to make sure we don't load in the other component too soon
  const [isLoaded, setIsLoaded] = useState(false);

  const splitPath = window.location.pathname.split("/"); // Gets the path part of the URL (/internal-events/2) // Splits the path into segments using the '/' character
  const currentModelType = splitPath[TYPED_MODEL_TYPE_LOCATION];

  if (currentModelType === "internal-events") {
    endpoint = editInternalEvent;
  } else if (currentModelType === "internal-hazards") {
    endpoint = editInternalHazard;
  } else if (currentModelType === "external-hazards") {
    endpoint = editExternalHazard;
  } else if (currentModelType === "full-scope") {
    endpoint = editFullScope;
  }

  // TODO: Fix this to use Zustand instead of API call
  // this takes any type instead of what it should, I have *no* idea how to carry over the types across promises, it doesn't seem to work, and I've tinkered quite a bit
  const updateCurrentModel = (newModel: TypedModel): void => {
    const addModel = new TypedModel(
      newModel.getId(),
      newModel.getLabel().name,
      newModel.getLabel().description,
      newModel.getUsers(),
    );
    setCurrentModel(addModel);
  };

  // TODO: Fix this to use Zustand instead of API call
  useEffect(() => {
    const fetchModel = async (): Promise<void> => {
      try {
        const model = await fetchCurrentTypedModel();
        updateCurrentModel(model);
        setIsLoaded(true);
      } catch (error) {}
    };
    void fetchModel();
  }, []);

  const buttonContent = (
    <div>
      <EuiFlexGroup
        gutterSize="s"
        alignItems="center"
        responsive={false}
      >
        <EuiFlexItem grow={false}>
          <EuiIcon
            type="dashboardApp"
            size="l"
          />
        </EuiFlexItem>
        <EuiFlexItem>
          <EuiTitle size="xs">
            <h3>General Settings</h3>
          </EuiTitle>
        </EuiFlexItem>
      </EuiFlexGroup>
      <EuiText size="s">
        <p>
          <EuiTextColor color="subdued">Update the model name, description, and ID.</EuiTextColor>
        </p>
      </EuiText>
    </div>
  );
  //screen breakpoints
  const smallScreen = useIsWithinBreakpoints(["xs", "s", "m"]);

  return (
    <SettingsAccordian
      id="model_settings"
      buttonContent={buttonContent}
      initial
    >
      <EuiFlexGrid
        direction="row"
        responsive={false}
        columns={smallScreen ? 1 : 2}
      >
        <EuiFlexItem grow>
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
                  users: currentModel.getUsers(),
                }}
              />
            </EuiSkeletonRectangle>
          </EuiPanel>
        </EuiFlexItem>
      </EuiFlexGrid>
    </SettingsAccordian>
  );
};

export { EditCurrentModel };
