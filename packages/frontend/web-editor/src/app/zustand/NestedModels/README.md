# OpenPRA MonoRepo - Zustand Nested Models Documentation

This file outlines the steps to create the nested models slice of the Zustand Store

## Table of contents

- [Creating Nested Models](#creating-nested-models)
- [State and Type for the nested model slice](#state-and-type-for-the-nested-model-slice)
- [Updating the helper file](#updating-the-helper-file)
- [Types for the nested model](#types-for-the-nested-model)
- [Updating the Nested Model API Manager in the Shared Type](#updating-the-nested-model-api-manager-in-the-shared-type)
- [Updating the Nested Model API Manager in the Web Backend](#updating-the-nested-model-api-manager-in-the-web-backend)
- [Actions for the nested model](#actions-for-the-nested-model)
- [Updating components for the models](#updating-components-for-the-models)

## Creating Nested Models

The nested models contain a number of different model types, and so we do not create all the types in a single file. We still use a single slice for the nested models but all the actions and types are separated into their respective files

## State and Type for the nested model slice

First update the type fo the main nested model state in the **NestedModelsType.tsx** (packages/frontend/web-editor/src/app/zustand/NestedModels/NestedModelsType.tsx) file

The update the corresponding type in the main nested model state under the correct key in the **NestedModelsState.tsx** (packages/frontend/web-editor/src/app/zustand/NestedModels/NestedModelsState.tsx) file

Example: Change type and corresponding state of InitiatingEvents from string[] to NestedModelType[]

```
InitiatingEventsAnalysis: {
    InitiatingEvents: [] as NestedModelType[],    // Replaced the type string[]
},
```

## Updating the helper file

- In order to help with nested state updates, we need to get the name of the nested model from the URL
- We have a helper function **GetNestedModelName** that retrieves the name from the URL and returns it in the desired format
- We update the function and the type of its return value

```
export type NestedModelNames = "initiatingEvents" | "NestedModelKeyName";

export const GetNestedModelName = (): NestedModelNames => {
  const nestedModel = GetCurrentNestedModelType();

  switch (nestedModel) {
    case "initiating-events":
      return "initiatingEvents";
    case "new_nested_model_url_name":
      return "NestedModelKeyName";
  }

  return "initiatingEvents";
};
```

new_nested_model_url_name:

- This is the name that will be displayed in the URL
- This can be found in the **fullScope.tsx** (packages/frontend/web-editor/src/app/pages/routingPages/fullScope.tsx) file in the path parameter of the Route tag

NestedModelKeyName:

- Name of the key that you are updating in the **NestedModelsState.tsx** (packages/frontend/web-editor/src/app/zustand/NestedModels/NestedModelsState.tsx) file

## Types for the nested model

All the typing required for the nested model are placed in different files with the name **[model_name]Type.ts** in the TypesHelpers folder

> openpra-monorepo/packages/frontend/web-editor/src/app/zustand/NestedModels/TypesHelpers

Once the types are exported from there, they need to be included in the overall nested models slice type and this is done in the **NestedModelsType.tsx** file

```
export interface NestedModelsType {
  NestedModels: NestedModelsStateType;
}

export type NestedModelActionsType = New_Type_You_Created1 & New_Type_You_Created2;
```

## Updating the Nested Model API Manager in the Shared Type

- Once the state, types are created, we update the **NestedModelApiManager.ts**(packages/shared-types/src/lib/api/NestedModelApiManager.ts) file
- We move the API methods related to the nested model into a separate file with the name **[model_name]APIManager.ts** in the NestedModelsAPI folder

> openpra-monorepo/packages/shared-types/src/lib/api/NestedModelsAPI

- Then import the methods into the **NestedModelApiManager.ts**(packages/shared-types/src/lib/api/NestedModelApiManager.ts) file and place it under the correct section

## Updating the Nested Model API Manager in the Web Backend

- Once the state, types are created, update the **/nestedModel.service.ts**(packages/web-backend/src/nestedModels/nestedModel.service.ts) file in the backend
- Move the API methods related to the nested model into a separate service file with the name **[model_name].service.ts** in the NestedModelsHelpers folder

> openpra-monorepo/packages/web-backend/src/nestedModels/NestedModelsHelpers

- To create a service in Nest.js in nx, run the following command in the folder where you want to create the service (packages/web-backend/src/nestedModels/NestedModelsHelpers - in our case)

```
// this creates the service file [model_name].service.ts

nx generate @nx/nest:service model_name

// For the question "Where should the service be generated?", select "As Provided: ..."
```

- Remove all the API methods from the **nestedModel.service.ts** (packages/web-backend/src/nestedModels/nestedModel.service.ts) file
- Make sure that this new service is included in the **providers** and **exports** arrays of the **nestedModel.module.ts** (packages/web-backend/src/nestedModels/nestedModel.module.ts) file
- Inject this newly created service into the constructor of the **nestedModel.controller.ts** (packages/web-backend/src/nestedModels/nestedModel.controller.ts) file
- Update the controller API method calls to use this newly created service
- **nested-model-helper.service.ts**(packages/web-backend/src/nestedModels/nested-model-helper.service.ts) service file has the methods to update the typed model when a nested model is created or deleted

## Actions for the nested model

Similar to types for individual models, all the actions required for the nested model are placed in different files with the name **[model_name]Actions.ts** in the ActionHelpers folder

> openpra-monorepo/packages/frontend/web-editor/src/app/zustand/NestedModels/ActionHelpers

Once the types are exported from there, they need to be included in the overall nested models slice action **NestedModelsActions.tsx** file from which they can be used anywhere

> openpra-monorepo/packages/frontend/web-editor/src/app/zustand/NestedModels/NestedModelsActions.tsx

## Updating components for the models

- Once all the state, type, actions are updated in the frontend, the components that use them have to be updated
- The following are some of the example components that need to be updated
  - Component that lists the nested model
    - Example: **initiatingEventsList.tsx** (packages/frontend/web-editor/src/app/components/lists/nestedLists/initiatingEventsList.tsx)
  - Component that creates the Buttons
    - Example: **CreateItemButton.tsx** (packages/frontend/web-editor/src/app/components/buttons/CreateItemButton.tsx)
  - Component that shows the new and edit forms
    - Example: **nestedModelActionForm.tsx** (packages/frontend/web-editor/src/app/components/forms/nestedModelActionForm.tsx)
