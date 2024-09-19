import {
  EuiPageTemplate,
  EuiSkeletonRectangle,
  EuiSpacer,
  EuiBasicTable,
  EuiPageHeader,
  EuiButton,
  EuiFlexGroup,
  EuiFlexItem,
  EuiText,
  EuiButtonIcon,
  copyToClipboard,
} from "@elastic/eui";
import { ChangeEvent, useEffect, useState } from "react";
import { ApiManager } from "shared-types/src/lib/api/ApiManager";
import { UserInviteApi } from "shared-types/src/lib/api/invites/userInviteApi";
import { MemberResult, Members } from "shared-types/src/lib/api/Members";
import { EuiBasicTableColumn } from "@elastic/eui/src/components/basic_table/basic_table";
import { Link } from "react-router-dom";
import { SignUpPropsWithRole } from "shared-types/src/lib/api/AuthTypes";
import { InviteIdDto } from "shared-types/src/lib/types/userInvites/InvitedUser";
import { GenericModal } from "../modals/genericModal";
import { DefaultSignupProps } from "../../auth/signup/SignUp";
import { EmailPasswordSignUpForm } from "../../auth/signup/EmailPasswordSignUpForm";
import { UseToastContext } from "../../providers/toastProvider";
import { GetESToast } from "../../../utils/treeUtils";
import { GenerateUserForm } from "../forms/generateUserForm";
import { Can } from "../../providers/ability/AbilityProvider";

/**
 * Generate columns for table containing the names of the users
 */
function constructColumns(): EuiBasicTableColumn<MemberResult>[] {
  return [
    {
      name: "Users",
      render: (item: MemberResult): JSX.Element => (
        <Link to={"../preferences/" + item.id + "/personal-data"}>{item.firstName + " " + item.lastName}</Link>
      ),
      mobileOptions: {
        render: (item: MemberResult): JSX.Element => (
          <span>
            <Link to={"../preferences/" + item.id + "/personal-data"}>{item.firstName + " " + item.lastName}</Link>
          </span>
        ),
        header: false,
        enlarge: false,
        width: "100%",
      },
    },
  ];
}

export const ExpiryOptions = [
  { value: 60 * 60 * 1000, text: "1 Hour" },
  { value: 6 * 60 * 60 * 1000, text: "6 Hours" },
  { value: 12 * 60 * 60 * 1000, text: "12 Hours" },
  { value: 24 * 60 * 60 * 1000, text: "1 Day" },
  { value: 7 * 24 * 60 * 60 * 1000, text: "7 Days" },
];

/**
 * Exports the list of users JSX.Element
 *
 */
export function Users(): JSX.Element {
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isNewUserModalVisible, setIsNewUserModalVisible] = useState<boolean>(false);
  const [isInviteNewUserModalVisible, setIsInviteNewUserModalVisible] = useState<boolean>(false);
  const [users, setUsers] = useState<MemberResult[]>([]);
  const [signup, setSignup] = useState<SignUpPropsWithRole>(DefaultSignupProps);
  const [generatedUserId, setGeneratedUserId] = useState<string>("");
  const { addToast } = UseToastContext();
  let modal;

  const [expiry, setExpiry] = useState(ExpiryOptions[0].value);

  const onValueChange = (e: ChangeEvent<HTMLSelectElement>): void => {
    setExpiry(Number(e.target.value));
  };

  /**
   * This function sends an api call to create new user
   * If user creation is successful toast will appear notifying the user
   * else it will show danger toast to inform user user was not created
   */
  const handleSignup = (): void => {
    ApiManager.signupWithoutSignIn(signup)
      .then((_) => {
        addToast(GetESToast("success", "User created successfully!!!"));
        setIsNewUserModalVisible(false);
      })
      .catch((_) => {
        addToast(GetESToast("danger", "Something went wrong"));
      });
  };

  const inviteUser = (): void => {
    UserInviteApi.inviteUser(signup, expiry, 1)
      .then((result) => {
        result
          .json()
          .then((res: InviteIdDto) => {
            setGeneratedUserId(res.id ?? "");
          })
          .catch((_) => {
            addToast(GetESToast("danger", "Something went wrong"));
          });
        setIsNewUserModalVisible(false);
      })
      .catch((_) => {
        addToast(GetESToast("danger", "Something went wrong"));
      });
  };

  if (isNewUserModalVisible) {
    // Since we disable the modal buttons here we will pass an empty promise in the onSubmit parameter
    modal = (
      <GenericModal
        title="New User"
        showButtons={false}
        body={
          <EmailPasswordSignUpForm
            handleSignup={handleSignup}
            signup={signup}
            setSignup={setSignup}
            buttonText={"Create User"}
          />
        }
        onClose={(): void => {
          setIsNewUserModalVisible(false);
        }}
        onSubmit={async (): Promise<void> => Promise.resolve()}
        modalFormId="NewUserModal"
      />
    );
  }

  if (isInviteNewUserModalVisible) {
    modal = (
      <GenericModal
        title={"Invite new user"}
        body={
          <>
            <GenerateUserForm
              buttonText={"Generate invite"}
              handleSignup={inviteUser}
              signup={signup}
              setSignup={setSignup}
              options={ExpiryOptions}
              expiry={expiry}
              onValueChange={onValueChange}
            />
            <EuiSpacer />
            {generatedUserId && (
              <EuiFlexGroup justifyContent={"spaceBetween"}>
                <EuiFlexItem grow={false}>
                  <EuiText size="s">Invite Link Generated</EuiText>
                </EuiFlexItem>
                <EuiFlexItem grow={true}>
                  <EuiButtonIcon
                    aria-label="Copy url to clipboard"
                    iconType="copy"
                    onClick={(): void => {
                      copyToClipboard(window.location.origin + "/invite/" + generatedUserId);
                    }}
                  ></EuiButtonIcon>
                </EuiFlexItem>
              </EuiFlexGroup>
            )}
          </>
        }
        onClose={(): void => {
          setGeneratedUserId("");
          setIsInviteNewUserModalVisible(false);
        }}
        onSubmit={async (): Promise<void> => Promise.resolve()}
        modalFormId={"InviteUserModal"}
        showButtons={false}
      />
    );
  }
  /**
   * Get all available users from database
   */
  useEffect(() => {
    ApiManager.getUsers()
      .then((result: Members) => {
        setIsLoading(false);
        setUsers(result.results);
      })
      .catch((): void => {
        setIsLoading(true);
        setUsers([]);
      });
  }, []);
  return (
    <div>
      <EuiPageTemplate
        panelled={false}
        offset={48}
        paddingSize="xl"
        grow={true}
        restrictWidth={true}
      >
        <EuiPageHeader
          pageTitle="User Profiles"
          iconType="users"
          paddingSize="xl"
          rightSideItems={[
            <Can
              I="create"
              a="users"
            >
              <EuiButton
                fill
                onClick={(): void => {
                  setIsNewUserModalVisible(true);
                }}
              >
                New User
              </EuiButton>
            </Can>,
            <Can
              I="create"
              a="users"
            >
              <EuiButton
                onClick={(): void => {
                  setIsInviteNewUserModalVisible(true);
                }}
              >
                Invite Users
              </EuiButton>
            </Can>,
          ]}
        ></EuiPageHeader>
        <EuiPageTemplate.Section>
          <EuiSkeletonRectangle
            width="100%"
            height="100%"
            isLoading={isLoading}
            contentAriaLabel="Example description"
          >
            <EuiBasicTable
              items={users}
              columns={constructColumns()}
            />
          </EuiSkeletonRectangle>
          <EuiSpacer size="s" />
        </EuiPageTemplate.Section>
      </EuiPageTemplate>
      {modal}
    </div>
  );
}
