import React, { useState } from 'react';
import {
  EuiButton,
  EuiContextMenu,
  EuiFormRow,
  EuiIcon,
  EuiPopover,
  EuiSwitch,
  EuiSpacer,
  useGeneratedHtmlId, EuiFlexGroup, EuiFlexItem, useEuiTheme, logicalStyle, useEuiPaddingSize
} from "@elastic/eui";
import { GenericListItemProps } from "../lists/GenericListItem";
import { ListItemEditAction } from "./ListItemAction";
import ItemFormAction, { ItemFormProps } from "../forms/ItemFormAction";
import { euiPaddingSize } from "@elastic/eui/src/global_styling/mixins/_padding";
import { logicalStyles } from "@elastic/eui/src/global_styling/functions/logicals";

export type ListItemContextMenuProps = {

} & GenericListItemProps & Omit<ItemFormProps, "action">;

export default (props: ListItemContextMenuProps) => {

  const embeddedCodeSwitchId__1 = useGeneratedHtmlId({
    prefix: 'embeddedCodeSwitch',
    suffix: 'first',
  });
  const embeddedCodeSwitchId__2 = useGeneratedHtmlId({
    prefix: 'embeddedCodeSwitch',
    suffix: 'second',
  });


  const { itemName, endpoint} = props;

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
          name: 'Rename',
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
          toolTipContent: 'For reasons, this item is disabled',
          icon: <EuiIcon type="trash" size="m" color="danger" />,
        },
      ],
    },
    {
      id: 1,
      initialFocusedItemIndex: 1,
      title: 'Rename',
      content: (
        <div style={{padding: useEuiPaddingSize("s") || '35px'}}>
            <ItemFormAction noHeader compressed action="edit" itemName={itemName} endpoint={endpoint} />
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
