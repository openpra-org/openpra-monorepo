import {
  EuiContextMenu,
  EuiIcon,
} from "@elastic/eui";

export type ListItemContextMenuProps = {
  id: string;
  name: string;
  description: string;
  onEdit: (id: string, data: any) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
};

export function ListItemContextMenu(props: ListItemContextMenuProps): JSX.Element {
  const { id, name, description, onEdit, onDelete } = props;

  const panels = [
    {
      id: 0,
      items: [
        {
          name: "Edit",
          icon: "pencil",
          onClick: () => onEdit(id, { name, description }),
        },
        {
          name: "Delete",
          icon: (
            <EuiIcon
              type="trash"
              size="m"
              color="danger"
            />
          ),
          onClick: () => onDelete(id),
        },
      ],
    },
  ];

  return (
    <EuiContextMenu
      size="m"
      initialPanelId={0}
      panels={panels}
    />
  );
}