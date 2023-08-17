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
import TypedModel, { TypedModelJSON } from 'packages/shared-types/src/lib/types/modelTypes/largeModels/typedModel';

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
  const modelInfo: TypedModelJSON = {id: Number(id), label: label, users: itemUsers}

  console.log(typeof modelInfo.id)

  const embeddedCodeSwitchId__1 = useGeneratedHtmlId({
    prefix: 'embeddedCodeSwitch',
    suffix: 'first',
  });
  const embeddedCodeSwitchId__2 = useGeneratedHtmlId({
    prefix: 'embeddedCodeSwitch',
    suffix: 'second',
  });

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
        <div style={{padding: useEuiPaddingSize("s") || '35px'}}>
            <TypedModelActionForm noHeader compressed action="edit" itemName={endpoint} patchEndpoint={patchTypedEndpoint} initialFormValues={modelInfo}/>
        </div>
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
