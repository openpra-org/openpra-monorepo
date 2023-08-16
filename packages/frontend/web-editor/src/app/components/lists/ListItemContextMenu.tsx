import React, { useEffect, useState } from 'react';
import {
  EuiButton,
  EuiContextMenu,
  EuiFormRow,
  EuiIcon,
  EuiPopover,
  EuiSwitch,
  EuiSpacer,
  useGeneratedHtmlId, useEuiPaddingSize, EuiSkeletonRectangle
} from "@elastic/eui";
import { GenericListItemProps } from "../lists/GenericListItem";
import { ItemFormProps } from "../forms/typedModelActionForm";
import DeleteItemBox from "../listchanging/deleteItemBox";
import TypedModelApiManager from 'packages/shared-types/src/lib/api/TypedModelApiManager';
import TypedModelActionForm from '../forms/typedModelActionForm';
import TypedModel from 'packages/shared-types/src/lib/types/modelTypes/largeModels/typedModel';

export type ListItemContextMenuProps = {

} & GenericListItemProps & Omit<ItemFormProps, "action">;

async function fetchCurrentTypedModel() {
  try {
    return await TypedModelApiManager.getCurrentTypedModel();
  } catch (error) {
    throw new Error('Error fetching current typed model: ');
  }
}

export default (props: ListItemContextMenuProps) => {

  //TODO: Make this work correctly, the prop is bad
  const { id, itemName, endpoint, deleteNestedEndpoint, deleteTypedEndpoint, label, patchTypedEndpoint, users} = props;

  const itemUsers = users ? users : [];

  //premade model info we are sending to update
  const modelInfo = {id: Number(id), label: label, users: itemUsers}

  //this is also subject to change, probably needs a type passed in from props eventually
  const newItem = new TypedModel()

  //grabs the current models information
  const [currentModel, setCurrentModel] = useState(newItem)

  //this isLoading set is here to make sure we dont load in the other component too soon
  const [isLoaded, setIsLoaded] = useState(false)

  //this takes any type instead of what it should, I have *no* idea how to carry over the types across promises, it doesn't seem to work and I've tinkered quite a bit
  const updateCurrentModel = (newModel: any) => {
    const addModel = new TypedModel(newModel.id, newModel.label.name, newModel.label.description, newModel.users)
    setCurrentModel(addModel)
  }

  const embeddedCodeSwitchId__1 = useGeneratedHtmlId({
    prefix: 'embeddedCodeSwitch',
    suffix: 'first',
  });
  const embeddedCodeSwitchId__2 = useGeneratedHtmlId({
    prefix: 'embeddedCodeSwitch',
    suffix: 'second',
  });

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

  const panels = [
    {
      id: 0,
      items: [
        {
          name: 'Duplicate',
          icon: 'copy',
        },
        {
          name: 'Move to',
          icon: 'indexFlush',
        },
        {
          name: 'Quick Edit',
          icon: 'pencil',
          panel: 1,
        },
        {
          name: 'Export',
          icon: 'exportAction',
        },
        {
          name: 'View details',
          icon: 'iInCircle',
        },
        {
          name: 'Trash',
          icon: <EuiIcon type="trash" size="m" color="danger" />,
          panel: 3,
        },
      ],
    },
    {
      id: 1,
      initialFocusedItemIndex: 1,
      title: 'Quick Edit',
      content: (
        <EuiSkeletonRectangle isLoading={isLoaded}>
          <div style={{padding: useEuiPaddingSize("s") || '35px'}}>
              <TypedModelActionForm noHeader compressed action="edit" itemName={endpoint} patchEndpoint={patchTypedEndpoint} initialFormValues={modelInfo}/>
          </div>
        </EuiSkeletonRectangle>
      )
    },
    {
      id: 3,
      initialFocusedItemIndex: 3,
      title: 'Delete',
      content: (
          <div style={{padding: useEuiPaddingSize("s") || '35px'}}>
            <DeleteItemBox id={id} itemName={itemName} typeOfModel={endpoint} deleteTypedEndpoint={deleteTypedEndpoint} deleteNestedEndpoint={deleteNestedEndpoint}/>
          </div>
      )
    },
    {
      id: 2,
      title: 'Embed code',
      content: (
        <div style={{ padding: 16 }}>
          <EuiFormRow label="Generate a public snapshot?" hasChildLabel={false}>
            <EuiSwitch
              name="switch"
              id={embeddedCodeSwitchId__1}
              label="Snapshot data"
              checked={true}
              onChange={() => {}}
            />
          </EuiFormRow>
          <EuiFormRow
            label="Include the following in the embed"
            hasChildLabel={false}
          >
            <EuiSwitch
              name="switch"
              id={embeddedCodeSwitchId__2}
              label="Current time range"
              checked={true}
              onChange={() => {}}
            />
          </EuiFormRow>
          <EuiSpacer />
          <EuiButton fill>Copy iFrame code</EuiButton>
        </div>
      ),
    },
  ];


  return (
      <EuiContextMenu size="m" initialPanelId={0} panels={panels} />
  );
};
