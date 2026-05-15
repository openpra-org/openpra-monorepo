import { useState } from "react";
import {
  EuiForm,
  EuiFormRow,
  EuiFieldText,
  EuiButton,
  EuiTextColor,
  EuiFlexGroup,
  EuiFlexItem,
  EuiSpacer,
  EuiTitle,
} from "@elastic/eui";
export interface DeleteItemProps {
  id?: number;
  _id?: string;
  itemName: string;
  typeOfModel: string;
  deleteTypedEndpoint?: (id: number) => Promise<void>;
  deleteNestedEndpoint?: (id: string) => Promise<void>;
  deleteEndpoint?: (id: number) => NonNullable<unknown>;
}
function DeleteItemBox(props: DeleteItemProps): JSX.Element {
  const [confirmDelete, setConfirmDelete] = useState("");
  const { id, _id, itemName, deleteNestedEndpoint, deleteTypedEndpoint } = props;
  const deleteData = (): void => {
    try {
      if (deleteTypedEndpoint && id) {
        void deleteTypedEndpoint(id).then(() => {});
      } else if (deleteNestedEndpoint && _id) {
        void deleteNestedEndpoint(_id).then(() => {});
      } else {
      }
    } catch {}
  };
  return (
    <>
      <EuiForm>
        <EuiSpacer size="s" />

        <EuiFormRow fullWidth={true}>
          <EuiTitle
            data-testid="delete-item-title"
            size="m"
          >
            <strong>Delete {itemName}</strong>
          </EuiTitle>
        </EuiFormRow>

        <EuiFormRow>
          <EuiTextColor>Are you sure you want to delete this model? This action is permanent</EuiTextColor>
        </EuiFormRow>

        <EuiFormRow fullWidth={true}>
          <EuiFieldText
            placeholder="Please type yes to proceed"
            value={confirmDelete}
            data-testid="delete-item-input"
            onChange={(_e): void => {
              setConfirmDelete(_e.target.value);
            }}
          />
        </EuiFormRow>

        <EuiFormRow fullWidth={true}>
          <EuiFlexGroup
            justifyContent="spaceBetween"
            gutterSize="xs"
          >
            <EuiFlexItem>
              <EuiButton
                data-testid="delete-item-button"
                fill={true}
                color="danger"
                isDisabled={!(confirmDelete.toLowerCase() === "yes")}
                onClick={deleteData}
              >
                Delete
              </EuiButton>
            </EuiFlexItem>
          </EuiFlexGroup>
        </EuiFormRow>
      </EuiForm>
    </>
  );
}
export { DeleteItemBox };
