import {
  EuiAvatar,
  EuiPageHeader,
  EuiPageTemplate,
  EuiSpacer,
  EuiForm,
  EuiFormRow,
  EuiFieldText,
  EuiButton,
} from "@elastic/eui";
import { useContext } from "react";
import ApiManager from "shared-types/src/lib/api/ApiManager";
import {
  PreferenceContext,
  PreferenceContextType,
} from "../settings/preferences";

/**
 * Function returns the main user profile page
 *
 */
export function EditPersonalInfoForm(): JSX.Element {
  const { currentUser, setCurrentUser } =
    useContext<PreferenceContextType>(PreferenceContext);

  return (
    <EuiPageTemplate
      panelled={false}
      offset={0}
      paddingSize="xl"
      grow={true}
      restrictWidth={true}
    >
      <EuiPageHeader
        pageTitle={currentUser?.firstName + " " + currentUser?.lastName}
        paddingSize="xl"
        data-testid="profile-name"
      ></EuiPageHeader>
      <EuiPageTemplate.Section grow={true}>
        <EuiAvatar
          size="xl"
          name={currentUser?.firstName + " " + currentUser?.lastName}
          type="space"
        />
        <EuiSpacer />
        <EuiSpacer />
        <EuiForm component="form">
          <EuiFormRow label="First Name">
            <EuiFieldText
              name="member_firstname"
              data-testid="edit-user-first-name"
              defaultValue={currentUser?.firstName}
              onChange={(event): void => {
                if (currentUser) {
                  currentUser.firstName = event.target.value;
                }
              }}
            />
          </EuiFormRow>
          <EuiFormRow label="Last Name">
            <EuiFieldText
              name="member_lastname"
              defaultValue={currentUser?.lastName}
              data-testid="edit-user-last-name"
              onChange={(event): void => {
                if (currentUser) {
                  currentUser.lastName = event.target.value;
                }
              }}
            />
          </EuiFormRow>
          <EuiFormRow label="Username">
            <EuiFieldText
              name="member_username"
              data-testid="edit-user-username"
              defaultValue={currentUser?.username}
              onChange={(event): void => {
                if (currentUser) {
                  currentUser.username = event.target.value;
                }
              }}
            />
          </EuiFormRow>
          <EuiFormRow label="Email">
            <EuiFieldText
              name="member_email"
              defaultValue={currentUser?.email}
              data-testid="edit-user-email"
              onChange={(event): void => {
                if (currentUser) {
                  currentUser.email = event.target.value;
                }
              }}
            />
          </EuiFormRow>
          <EuiFormRow>
            <EuiButton
              type="button"
              onClick={(): void => {
                if (currentUser) {
                  setCurrentUser(currentUser);
                  void ApiManager.updateUser(
                    currentUser.id,
                    JSON.stringify(currentUser),
                  );
                }
              }}
            >
              Save
            </EuiButton>
          </EuiFormRow>
        </EuiForm>
      </EuiPageTemplate.Section>
    </EuiPageTemplate>
  );
}
