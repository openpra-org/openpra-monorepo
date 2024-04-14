import { useEffect, useState } from "react";
import { EuiTitle, EuiSpacer } from "@elastic/eui";
import TypedModel from "shared-types/src/lib/types/modelTypes/largeModels/typedModel";

import {
  GetCurrentTypedModel,
  PatchExternalHazard,
  PatchFullScope,
  PatchInternalHazard,
} from "shared-types/src/lib/api/TypedModelApiManager";
import { TypedModelActionForm } from "../forms/typedModelActionForm";
import { editInternalEvent } from "../../zustand/internalEvents/internalEventsActions";

const TYPED_MODEL_TYPE_LOCATION = 1;

async function fetchCurrentTypedModel(): Promise<TypedModel> {
  try {
    return await GetCurrentTypedModel();
  } catch (error) {
    throw new Error("Error fetching current typed model: ");
  }
}

function EditCurrentModel(): JSX.Element {
  const newItem = new TypedModel();
  const [currentModel, setCurrentModel] = useState(newItem);
  let endpoint;
  const [isLoaded, setIsLoaded] = useState(false);

  const splitPath = window.location.pathname.split("/");
  const currentModelType = splitPath[TYPED_MODEL_TYPE_LOCATION];

  if (currentModelType === "internal-events") {
    endpoint = editInternalEvent;
  } else if (currentModelType === "internal-hazards") {
    endpoint = PatchInternalHazard;
  } else if (currentModelType === "external-hazards") {
    endpoint = PatchExternalHazard;
  } else if (currentModelType === "full-scope") {
    endpoint = PatchFullScope;
  }

  const updateCurrentModel = (newModel: any): void => {
    const addModel = new TypedModel(
      newModel.id,
      newModel.label.name,
      newModel.label.description,
      newModel.users,
    );
    setCurrentModel(addModel);
  };

  useEffect(() => {
    const fetchModel = async (): Promise<void> => {
      try {
        const model = await fetchCurrentTypedModel();
        updateCurrentModel(model);
        setIsLoaded(true);
      } catch (error) {
        //console.error("Error fetching fixtures:", error);
      }
    };
    void fetchModel();
  }, []);

  return (
    <div>
      {
        <>
          <EuiSpacer size="l" />
          <EuiTitle size="xs">
            <h6> Create {currentModelType} Model </h6>
          </EuiTitle>
          <EuiSpacer size="s" />

          <EuiSpacer />
        </>
      }

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
    </div>
  );
}

export { EditCurrentModel };
