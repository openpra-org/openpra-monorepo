import { useNavigate, useParams } from "react-router-dom";
import { useEffect, useState } from "react";
import { InvitedUserDto } from "shared-types/src/lib/types/userInvites/InvitedUser";
import { EuiPageTemplate, EuiSkeletonLoading } from "@elastic/eui";
import { ApiManager } from "shared-sdk/lib/api/ApiManager";
import { UserInviteApi } from "shared-sdk/lib/api/invites/userInviteApi";
import { SignUpPropsWithRole } from "shared-sdk/lib/api/AuthTypes";
import { MemberRole } from "shared-sdk/lib/data/predefiniedRoles";
import { DefaultSignupProps } from "../components/login/signUp";
import { UseToastContext } from "../providers/toastProvider";
import { GenerateUUID } from "../../utils/treeUtils";
import { GenericModal } from "../components/modals/genericModal";
import { SignUpForm } from "../components/forms/signUpForm";

const InvitePage = (): JSX.Element => {
  const { inviteId } = useParams<{ inviteId: string | undefined }>();
  const [isLoading, setIsLoading] = useState(false);
  const [isExpired, setIsExpired] = useState(false);
  const [signup, setSignup] = useState<SignUpPropsWithRole>(DefaultSignupProps);
  const navigate = useNavigate();
  const { addToast } = UseToastContext();

  /**
   * Search and verify if invite id is correct
   */
  useEffect(() => {
    if (inviteId) {
      setIsLoading(true);
      UserInviteApi.verifyInvite(inviteId)
        .then((result) => {
          if (!result.ok) {
            setIsExpired(true);
            setIsLoading(false);
            return;
          }
          result
            .json()
            .then((res: InvitedUserDto) => {
              setSignup({
                email: res.email ?? "",
                username: res.username ?? "",
                passConfirm: "",
                lastName: res.lastname ?? "",
                firstName: res.firstname ?? "",
                password: "",
                roles: [MemberRole],
              });
              setIsLoading(false);
            })
            .catch((error: unknown) => {
              const message = (error as { message?: string }).message ?? "unknown error";
              addToast({
                id: GenerateUUID(),
                color: "danger",
                text: `Error while signing in: ${message}`,
              });
              setIsLoading(false);
            });
        })
        .catch((err: unknown) => {
          const message = (err as { message?: string }).message ?? "unknown error";
          addToast({
            id: GenerateUUID(),
            color: "danger",
            text: `Error while signing in: ${message}`,
          });
          setIsLoading(false);
        });
    }
  }, [inviteId, addToast]);

  function handleSignup(): void {
    const { passConfirm: _passConfirm, ...signupData } = signup;
    ApiManager.signup(signupData)
      .then(() => {
        if (ApiManager.isLoggedIn()) {
          void UserInviteApi.updateInvite(inviteId ?? "");
          void navigate("/");
        }
      })
      .catch((signInError: unknown) => {
        const message = (signInError as { message?: string }).message ?? "unknown error";
        // Send a toast message saying there was an error while logging in
        addToast({
          id: GenerateUUID(),
          color: "danger",
          text: `Error while signing in: ${message}`,
        });
      });
  }

  /**
   * Handles expired id case and returns correct component
   */
  function getModal(): JSX.Element {
    if (isExpired) {
      return (
        <EuiPageTemplate panelled={true}>
          <EuiPageTemplate.EmptyPrompt title={<span>Your invite has expired</span>}></EuiPageTemplate.EmptyPrompt>
        </EuiPageTemplate>
      );
    }
    return (
      <EuiPageTemplate panelled={true}>
        <EuiPageTemplate.EmptyPrompt title={<span>You are invited to OpenPRA</span>}>
          <SignUpForm
            handleSignup={handleSignup}
            signup={signup}
            setSignup={setSignup}
            buttonText={"Sign In"}
          />
        </EuiPageTemplate.EmptyPrompt>
      </EuiPageTemplate>
    );
  }

  return (
    <EuiSkeletonLoading
      isLoading={isLoading}
      loadingContent={
        <GenericModal
          title={"Loading..."}
          body={<p>Loading Content</p>}
          onClose={(): void => {
            return;
          }}
          modalFormId={"Loading..."}
          onSubmit={(): Promise<void> => Promise.resolve()}
          showButtons={false}
        />
      }
      loadedContent={getModal()}
    ></EuiSkeletonLoading>
  );
};

export { InvitePage };
