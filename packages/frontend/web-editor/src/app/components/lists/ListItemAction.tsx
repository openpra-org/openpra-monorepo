import { useState } from "react";
import { ButtonWithClosablePopover } from "../buttons/ButtonWithPopover";
import { GenericListItemProps } from "./GenericListItem";
import { ListItemContextMenu } from "./ListItemContextMenu";
import { GenericModal } from "../modals/genericModal";

export function ListItemContextMenuButton(props: GenericListItemProps): JSX.Element {
  const { id, name, description, onEdit, onDelete, endpoint } = props;
  const [isEditModalVisible, setIsEditModalVisible] = useState(false);
  const [isDeleteModalVisible, setIsDeleteModalVisible] = useState(false);
  const [editData, setEditData] = useState({ name, description });

  const handleEditSubmit = async () => {
    await onEdit(id, editData);
    setIsEditModalVisible(false);
  };

  const handleDeleteSubmit = async () => {
    await onDelete(id);
    setIsDeleteModalVisible(false);
  };

  return (
    <ButtonWithClosablePopover
      closeProp="onCancel"
      iconType="boxesHorizontal"
      isIcon={true}
      aria-label="Edit Item"
      confirmDiscard={false}
      popoverProps={{
        initialFocus: "#name",
        panelPaddingSize: "s",
      }}
      color="text"
    >
      <ListItemContextMenu
        {...props}
        onEdit={() => {
          setIsEditModalVisible(true);
          return Promise.resolve();
        }}
        onDelete={() => {
          setIsDeleteModalVisible(true);
          return Promise.resolve();
        }}
      />
      {isEditModalVisible && (
        <GenericModal
          title={`Edit ${name}`}
          body={
            <div>
              <label>
                Name:
                <input
                  value={editData.name}
                  onChange={e => setEditData({ ...editData, name: e.target.value })}
                />
              </label>
              <label>
                Description:
                <input
                  value={editData.description}
                  onChange={e => setEditData({ ...editData, description: e.target.value })}
                />
              </label>
            </div>
          }
          onClose={() => setIsEditModalVisible(false)}
          onSubmit={handleEditSubmit}
          modalFormId={`edit-modal-${id}`}
          showButtons={true}
        />
      )}
      {isDeleteModalVisible && (
        <GenericModal
          title={`Delete ${name}?`}
          body={<div>Are you sure you want to delete <b>{name}</b>?</div>}
          onClose={() => setIsDeleteModalVisible(false)}
          onSubmit={handleDeleteSubmit}
          modalFormId={`delete-modal-${id}`}
          showButtons={true}
        />
      )}
    </ButtonWithClosablePopover>
  );
}