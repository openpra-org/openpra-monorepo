import {
  EuiButton,
  EuiContextMenu,
  EuiFormRow,
  EuiIcon,
  EuiSwitch,
  EuiSpacer,
  useGeneratedHtmlId,
  useEuiPaddingSize,
} from "@elastic/eui";

import { TypedModelJSON } from "shared-types/src/lib/types/modelTypes/largeModels/typedModel";
import { NestedModelJSON } from "shared-types/src/lib/types/modelTypes/innerModels/nestedModel";

import { ItemFormProps } from "../forms/typedModelActionForm";
import { DeleteItemBox } from "../listchanging/deleteItemBox";
import { TypedModelActionForm } from "../forms/typedModelActionForm";
import { NestedModelActionForm } from "../forms/nestedModelActionForm";
import { GenericListItemProps } from "./GenericListItem";

export type ListItemContextMenuProps = {} & GenericListItemProps &
  Omit<ItemFormProps, "action">;

const ListItemContextMenu = (props: ListItemContextMenuProps) => {
  //TODO: Make this work correctly, the prop is bad
  const {
    id,
    itemName,
    endpoint,
    deleteNestedEndpoint,
    deleteTypedEndpoint,
    label,
    patchTypedEndpoint,
    patchNestedEndpoint,
    users,
  } = props;

  const itemUsers = users ? users : [];

  //premade model info we are sending to update
  const modelInfo: TypedModelJSON = {
    id: Number(id),
    label: label,
    users: itemUsers,
  };

  //premade model info we are sending to update
  const nestedInfo: NestedModelJSON = { label: label, parentIds: [] };

  const embeddedCodeSwitchId__1 = useGeneratedHtmlId({
    prefix: "embeddedCodeSwitch",
    suffix: "first",
  });
  const embeddedCodeSwitchId__2 = useGeneratedHtmlId({
    prefix: "embeddedCodeSwitch",
    suffix: "second",
  });

  const panels = [
    {
      id: 0,
      items: [
        {
          name: "Duplicate",
          icon: "copy",
        },
        {
          name: "Move to",
          icon: "indexFlush",
        },
        {
          name: "Quick Edit",
          icon: "pencil",
          panel: 1,
        },
        {
          name: "Export",
          icon: "exportAction",
        },
        {
          name: "View details",
          icon: "iInCircle",
        },
        {
          name: "Trash",
          icon: <EuiIcon type="trash" size="m" color="danger" />,
          panel: 3,
        },
      ],
    },
    {
      id: 1,
      initialFocusedItemIndex: 1,
      title: "Quick Edit",
      content: (
        <div style={{ padding: useEuiPaddingSize("s") || "35px" }}>
          {patchTypedEndpoint ? (
            <TypedModelActionForm
              noHeader
              compressed
              action="edit"
              itemName={endpoint}
              patchEndpoint={patchTypedEndpoint}
              initialFormValues={modelInfo}
            />
          ) : (
            <NestedModelActionForm
              noHeader
              compressed
              action="edit"
              id={Number(id)}
              itemName={endpoint}
              patchEndpoint={patchNestedEndpoint}
              initialFormValues={nestedInfo}
            />
          )}
        </div>
      ),
    },
    {
      id: 3,
      initialFocusedItemIndex: 3,
      title: "Delete",
      content: (
        <div style={{ padding: useEuiPaddingSize("s") || "35px" }}>
          <DeleteItemBox
            id={id}
            itemName={itemName}
            typeOfModel={endpoint}
            deleteTypedEndpoint={deleteTypedEndpoint}
            deleteNestedEndpoint={deleteNestedEndpoint}
          />
        </div>
      ),
    },
    {
      id: 2,
      title: "Embed code",
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

  return <EuiContextMenu size="m" initialPanelId={0} panels={panels} />;
};

export { ListItemContextMenu };
