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

//list of props passed in, the users is optional and controls which version is shown, this is so we can reuse this structure later
export type DeleteItemProps = {
  id?: number;
  _id?: string;
  itemName: string;
  typeOfModel: string;
  deleteTypedEndpoint?: (id: number) => Promise<void>;
  deleteNestedEndpoint?: (id: string) => Promise<void>;
  deleteEndpoint?: (id: number) => NonNullable<unknown>;
};

/**
 *
 * @param title - takes in an optional title string
 * @param id - takes in an optional id which later be used to interact with the database
 * @param toggleBox - this needs to be there to toggle the delete box on and off across components, a state to set the delete box being visible
 * @returns
 */
function DeleteItemBox(props: DeleteItemProps): JSX.Element {
  //State used to hold value within text box. User types 'yes' to unlock the submit button
  const [confirmDelete, setConfirmDelete] = useState("");

  //grabbing the props
  const {
    id,
    _id,
    itemName,
    deleteNestedEndpoint,
    deleteTypedEndpoint,
  } = props;

  //sets the data, then closes overlay
  const deleteData = (): void => {
    try {
      if (deleteTypedEndpoint && id) {
        void deleteTypedEndpoint(id).then(() => {
          // TODO:: Log this right
          console.log("deleted");
        });
      } else if (deleteNestedEndpoint && _id) {
        void deleteNestedEndpoint(_id).then(() => {
          // TODO:: Log this right
          console.log('deleted nested')
        })
      } else {
        // deleteEndpoint(id)
      }
    } catch (e) {
      // TODO:: Log this right
      console.error(e);
    }
    // TODO:: Implement delete functionality for nested models
  };

  return (
    <>
      {/** this styling is so its in a nice looking box, it scales if the users tab is there or not */}
      <EuiForm>
        <EuiSpacer size="s" />
        {/** this gives the text, and then importantly sets the title of the item */}
        <EuiFormRow fullWidth={true}>
          <EuiTitle data-testid="delete-item-title" size="m">
            <strong>Delete {itemName}</strong>
          </EuiTitle>
        </EuiFormRow>
        {/** the submit and also the go back buttons are right here*/}
        <EuiFormRow>
          <EuiTextColor>
            Are you sure you want to delete this model? This action is permanent
          </EuiTextColor>
        </EuiFormRow>
        {/** confirmation text */}
        <EuiFormRow fullWidth={true}>
          {/** User will enable the submit button by typing yes in this text box */}
          <EuiFieldText
            placeholder="Please type yes to proceed"
            value={confirmDelete}
            data-testid="delete-item-input"
            onChange={(e): void => {
              setConfirmDelete(e.target.value);
            }}
          />
        </EuiFormRow>

        {/** button to submit is equipped with the ability to  */}
        <EuiFormRow fullWidth={true}>
          <EuiFlexGroup justifyContent="spaceBetween" gutterSize="xs">
            <EuiFlexItem>
              {/** This button will only be clickable when user types yes/Yes/YES/etc */}
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
