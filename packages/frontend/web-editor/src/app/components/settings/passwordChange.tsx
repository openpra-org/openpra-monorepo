import {
  EuiPageTemplate,
  EuiPageHeader,
  EuiPanel,
  EuiText,
  EuiFlexGroup,
  EuiFlexItem,
  EuiButton,
  EuiSpacer,
  EuiForm,
  EuiFormRow,
  EuiFieldPassword,
  useGeneratedHtmlId,
} from "@elastic/eui";
import { ApiManager } from "shared-types/src/lib/api/ApiManager";
import moment from "moment";
import { useContext, useEffect, useState } from "react";
import { SignUpPropsWithRole } from "shared-types/src/lib/api/AuthTypes";
import { CollabRole } from "shared-types/src/lib/data/predefiniedRoles";
import { GenericModal } from "../modals/genericModal";
import { PasswordForm } from "../forms/passwordForm";
import { PreferenceContext, PreferenceContextType } from "./preferences";

/**
 * This function will validate weather old password is correct or not
 * @param username - The username of the user
 * @param password - The old password of the user
 * @returns - Either true or undefined depending on weather password is correct or not
 */
const validateCurrentPassword = async (username: string, password: string): Promise<boolean> => {
  const val = await ApiManager.verifyPassword(username, password);
  const { match } = (await val.json()) as { match: boolean };
  return match;
};

/**
 * Main react component of the file
 */
const PasswordChange = (): JSX.Element => {
  const [isModalVisible, setIsModalVisible] = useState<boolean>(false);
  const [buttonClicked, setButtonClicked] = useState<boolean>(false);
  const [currentPassword, setCurrentPassword] = useState<string>("");
  const [signup, setSignUp] = useState<SignUpPropsWithRole>();
  const [isInvalidOldPass, setIsInvalidOldPass] = useState<boolean>(false);
  const [isInvalidNewPass, setIsInvalidNewPass] = useState<boolean>(false);
  const [showErrors, setShowErrors] = useState<boolean>(false);
  const [isActiveUser, setIsActiveUser] = useState<boolean>();
  const { currentUser } = useContext<PreferenceContextType>(PreferenceContext);
  useEffect(() => {
    setSignUp({
      email: currentUser !== undefined ? currentUser.email : "",
      password: "",
      firstName: currentUser !== undefined ? currentUser.firstName : "",
      lastName: currentUser !== undefined ? currentUser.lastName : "",
      username: currentUser !== undefined ? currentUser.username : "",
      passConfirm: "",
      roles: [CollabRole],
    });
    if (currentUser?.id === ApiManager.getCurrentUser().user_id) {
      setIsActiveUser(true);
    }
  }, [currentUser]);

  /**
   * This is the main form for change password
   * @param modalFormId - Modal Form Id, which helps recognize the form uniquely
   */
  const changePasswordForm = (modalFormId: string): JSX.Element => (
    <EuiForm
      id={modalFormId}
      isInvalid={showErrors}
      error={isInvalidOldPass ? ["Old password is wrong"] : isInvalidNewPass ? ["New password is wrong"] : []}
      component="form"
    >
      {isActiveUser && (
        <EuiFormRow
          isInvalid={isInvalidOldPass}
          error="Please enter the correct current password"
        >
          <EuiFieldPassword
            type="dual"
            placeholder="Current password"
            onChange={(event): void => {
              setShowErrors(false);
              setIsInvalidOldPass(false);
              setCurrentPassword(event.target.value);
            }}
            isInvalid={isInvalidOldPass}
          ></EuiFieldPassword>
        </EuiFormRow>
      )}
      {signup && (
        <PasswordForm
          signup={signup}
          setSignup={setSignUp}
          signupButtonClicked={buttonClicked}
        />
      )}
    </EuiForm>
  );

  const lastLogin = moment(currentUser?.last_login);
  const modalFormId = useGeneratedHtmlId({ prefix: "modalForm" });
  let modal;
  if (isModalVisible) {
    modal = (
      <GenericModal
        title={"Enter new password"}
        modalFormId={modalFormId}
        body={changePasswordForm(modalFormId)}
        onClose={(): void => {
          setIsModalVisible(false);
        }}
        showButtons={true}
        onSubmit={async (): Promise<void> => {
          setButtonClicked(true);
          const { password = "", passConfirm = "" } = signup ?? {};

          if (passConfirm !== password || !signup) {
            return;
          }

          let isPasswordValid = true;
          if (isActiveUser) {
            isPasswordValid = await validateCurrentPassword(signup.username, currentPassword);
          }
          if (!isPasswordValid) {
            setIsInvalidOldPass(true);
            setShowErrors(true);
          } else if (!signup.password || signup.password === " ") {
            setIsInvalidOldPass(false);
            setIsInvalidNewPass(true);
            setShowErrors(true);
          } else {
            setIsInvalidNewPass(false);
            setShowErrors(false);
            if (currentUser) {
              currentUser.password = signup.password;
              await ApiManager.updateUser(currentUser.id, JSON.stringify(currentUser));
            }
            setIsModalVisible(false);
          }
        }}
      />
    );
  }
  return (
    <div>
      <EuiPageTemplate
        panelled={false}
        offset={0}
        paddingSize="none"
        grow={true}
        restrictWidth={true}
      >
        <EuiPageHeader
          pageTitle="Logins"
          paddingSize="xl"
          data-testid="profile-name"
        ></EuiPageHeader>
        <EuiPageTemplate.Section paddingSize="l">
          <EuiPanel
            paddingSize="m"
            hasBorder={true}
            grow={false}
          >
            <EuiFlexGroup justifyContent="spaceBetween">
              <EuiFlexItem grow={false}>
                <EuiText>
                  <h2>Password</h2>
                </EuiText>
              </EuiFlexItem>
              <EuiFlexItem grow={false}>
                <EuiButton
                  onClick={(): void => {
                    setIsModalVisible(true);
                  }}
                >
                  Change Password
                </EuiButton>
              </EuiFlexItem>
            </EuiFlexGroup>
            <EuiSpacer></EuiSpacer>
            <EuiText>{"Last Login: " + lastLogin.format("MMMM Do YYYY, h:mm:ss a")}</EuiText>
          </EuiPanel>
        </EuiPageTemplate.Section>
      </EuiPageTemplate>
      {modal}
    </div>
  );
};

export { PasswordChange };
