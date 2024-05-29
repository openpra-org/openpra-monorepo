# OpenPRA MonoRepo - Zustand Documentation

This file outlines the steps to create a state for any particular part of the application

## Table of contents
- [Files for the Zustand Implementation](#files-for-the-zustand-implementation)
- [Structure of the Zustand store](#structure-of-the-zustand-store)
- [Creating a new slice](#creating-a-new-slice)
  - [Create the state file](#create-the-state-file)
  - [Create the types file](#create-the-types-file)
  - [Create the actions file](#create-the-actions-file)
  - [Create the slice file](#create-the-slice-file)
  - [Updating the store](#updating-the-store)
- [Using the data in the store](#using-the-data-in-the-store)
- [Creating Nested Models](#creating-nested-models)
- [Using Immer Middleware](#using-immer-middleware)
- [Zustand Dev Tools](#zustand-dev-tools)

## Files for the Zustand Implementation

> packages/frontend/web-editor/src/app/zustand

This folder contains everything related to the Zustand implementation

- **Store.tsx** (packages/frontend/web-editor/src/app/zustand/Store.tsx)
- **createSelectors.tsx** (packages/frontend/web-editor/src/app/zustand/createSelectors.tsx)
- **\<SliceName\>** (packages/frontend/web-editor/src/app/zustand/\<SliceName\>)
  - **\<sliceName\>Actions.tsx**
  - **\<sliceName\>Slice.tsx**
  - **\<sliceName\>State.tsx**
  - **\<sliceName\>Types.tsx**

## Structure of the Zustand store

- The Store.tsx file is the main file where the Zustand store is created. We are using slices for various parts of the application as it is always recommended to have 1 global store for the entire application.
- Each part of the application is present in a separate folder inside the Zustand folder with the name of the application slice in **PascalCase** and the files inside it must be named starting with the name of the application slice in **camelCase**

> Example: When creating a slice for the Internal Events, name the folder as **InternalEvents** and the files must start with **internalEvents**

- Every slice will have 4 files
  - Slice file
    - This file is the entry point to the slice
    - This is where the slice is created
  - Types file
    - This file contains the types for the slice
    - All the state and the action functions used in the slice should be defined in this file
    - All the state should be defined as a type with name **<Slice_name>Type**
    - All the actions should be defined as a type with name **<Slice_name>ActionsType**
  - State file
    - This file contains the initial state of the state
  - Actions file
    - This file contains the functions that handle all the logic of the slice
    - The functions/actions in this are used to perform the state updates and async calls to the backend

## Creating a new slice

- Create a new folder with the slice name
- [Create the state file](#create-the-state-file)
- [Create the types file](#create-the-types-file)
- [Create the actions file](#create-the-actions-file)
- [Create the slice file](#create-the-slice-file)
- [Updating the store](#updating-the-store)

> All files names are in **camelCase**

### Create the state file

The state file contains the initial state of the slice

```
export const sliceState = {
  sliceName: value,
};

```

---
### Create the types file

The types file contains the types needed by Typescript for the slice

First create any necessary shared types in the respective folder

For example, for Internal Events, create a type **InternalEventsModelType** in the following file

> openpra-monorepo/packages/shared-types/src/lib/types/modelTypes/largeModels/internalEventsModel.ts

Then create the types for the slice in the types file of the slice.

---
### Create the actions file

This file contains all the functions that update the state and do asynchronous calls to the backend

There must be functions to get, add, edit and delete content in the slice

Refer the following file to create actions for the slice

> openpra-monorepo/packages/frontend/web-editor/src/app/zustand/internalEvents/internalEventsActions.tsx

---
### Create the slice file

The slice file contains all the code for creating slice, resetting slice, adding actions to the slice

After the state, types and action files are created, the slice can be created

Use the following code as reference to create a slice

```
import { StateCreator } from "zustand";
import { sliceResetFns, storeType } from "../store";
// Import the state from the state file
// Import the types from the types file
// Import the actions from the actions file

const sliceName: StateCreator<
  StoreStateType & StoreActionType,
  [],
  [],
  sliceType & sliceActionType
> = (set) => {
  sliceResetFns.add(() => {
    set(sliceInitialState);
  });
  return {
    actionName: sliceActions.action
  };
};

export default sliceName;
```

---
### Updating the store

Once the slice is created, add the type of state of the slice to the **StoreStateType** types in the store file

```
export type StoreStateType = slice1Type & slice2Type;
```

Add the type of state of the slice to the **StoreActionType** types in the store file

```
export type StoreActionType = slice1ActionType & slice2ActionType;
```

Then add the slice to the store base

```
const useGlobalStoreBase = create<storeType>()((...args) => ({
  ...slice1(...args),
  ...slice2(...args),
}));
```

## Using the data in the store

The **createSelector.tsx** file is a helper file that creates selectors for the various entities inside the global store.

Instead of doing this

```
const bears = useBearStore((state) => state.bears)
```

this helper function allows us to access a **"use"** attribute on the store and get the value we need from the store

```
const bears = useBearStore.use.bears()
```

Reference: https://docs.pmnd.rs/zustand/guides/auto-generating-selectors

To use the data in the store in your component,

- Import the useGlobalStore hook and then get the desired store value from the store

```
import useGlobalStore from "zustand/store";

const stateValueName = useGlobalStore.use.stateValueName();
```

> **useGlobalStore** is a hook and so it can be used only inside a React component

## Creating Nested Models

For creating different nested models, refer to the README in the folder

> openpra-monorepo/packages/frontend/web-editor/src/app/zustand/NestedModels

## Using Immer Middleware
The setState function in zustand will be able to update the state on the first level of the state object. For nested state update, we have to use the spread (...) operator. But this can get messy quickly. So we use **Immer** middleware to perform nested state updates.

To use Immer while creating a slice
```
import { StateCreator } from "zustand";
import { immer } from "zustand/middleware/immer";
import { SliceResetFns, StoreActionType, StoreStateType } from "../Store";
// Import the state from the state file
// Import the types from the types file
// Import the actions from the actions file

const sliceName: StateCreator<
  StoreStateType & StoreActionType,
  [],
  [["zustand/immer", never]],
  sliceType & sliceActionType
> = immer((set) => {
  sliceResetFns.add(() => {
    set(sliceInitialState);
  });
  return {
    actionName: sliceActions.action
  };
});

export default sliceName;
```

This will add Immer to that slice. We can then use the immer function to perform nested state updates in the actions file. The **produce** function from Immer is used to perform these updates.

```
import { produce } from "immer";

UseGlobalStore.setState(
      produce((state: StoreType) => {
        state.NestedModels.InitiatingEventsAnalysis.InitiatingEvents.push(
          InitiatingEvent,
        );

        state.internalEvents = state[typedModelName].map(
            produce((tm: typedModelType) => {
                if (parentIds.includes(tm._id)) {
                    tm[nestedModelName].push(nestedModelId);
                }
            }),
        )
      }),
    );
```

As seen from the above code snippet, this produce function can be used to update multiple parts of the state at the same time.

[Learn more about produce function in Immer](https://immerjs.github.io/immer/produce)

## Zustand Dev Tools

We have added Dev Tools support for the Zustand store. We have added that middleware when we create the global zustand store in **Store.ts** file

```
const UseGlobalStoreBase = create<StoreType>()(
  devtools(
    (...args) => ({
        ...slice1(...args),
        ...slice2(...args),
    }),
    {
      enabled: true,
      name: "Zustand Model Store",
    },
  ),
);
```
There are 2 parameters here:
- enabled - Determines where to show the dev tool or not
- name - This is the name of the store in the dev tools window

To see the store, we use the **Redux DevTools** extension in chrome. Once installed, the extension should automatically display the store when the application is open.
