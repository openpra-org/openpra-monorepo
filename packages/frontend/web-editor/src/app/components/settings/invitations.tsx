import { useEffect, useState } from "react";
import { UserInviteApi } from "shared-sdk/lib/api/invites/userInviteApi";
import { InvitedUserDetailsDto } from "shared-types/src/lib/types/userInvites/InvitedUser";
import { EuiButton, EuiPageHeader, EuiPageTemplate, EuiSkeletonLoading, EuiText } from "@elastic/eui";
import { UseToastContext } from "../../providers/toastProvider";
import { GenerateUUID } from "../../../utils/treeUtils";
import { InvitedUsersTable } from "../tables/invitedUsersTable";
import { InviteMultipleUsersFlyout } from "../forms/inviteMultipleUsersFlyout";
import { Can } from "../../providers/abilityProvider";

const Invitations = (): JSX.Element => {
  const [invitedUsers, setInvitedUsers] = useState<InvitedUserDetailsDto[]>();
  const [isLoading, setIsLoading] = useState(false);
  const [isFlyoutVisible, setIsFlyoutVisible] = useState<boolean>(false);
  const { addToast } = UseToastContext();

  useEffect(() => {
    setIsLoading(true);
    UserInviteApi.getAllInvites()
      .then((response) => {
        response
          .json()
          .then((invites: InvitedUserDetailsDto[]) => {
            setInvitedUsers(invites);
            setIsLoading(false);
          })
          .catch((_: unknown) => {
            setIsLoading(false);
            addToast({
              id: GenerateUUID(),
              color: "danger",
              title: "Failed to fetch invited users",
            });
          });
      })
      .catch((_: unknown) => {
        setIsLoading(false);
        addToast({
          id: GenerateUUID(),
          color: "danger",
          title: "Failed to fetch invited users",
        });
      });
  }, [addToast, isFlyoutVisible]);

  let flyout;
  if (isFlyoutVisible) {
    flyout = <InviteMultipleUsersFlyout setIsFlyoutVisible={setIsFlyoutVisible} />;
  }

  return (
    <EuiSkeletonLoading
      isLoading={isLoading}
      loadingContent={
        <EuiPageTemplate
          paddingSize="none"
          panelled={false}
        >
          <EuiPageTemplate.Section>
            <EuiText>Loading...</EuiText>
          </EuiPageTemplate.Section>
        </EuiPageTemplate>
      }
      loadedContent={
        <EuiPageTemplate
          panelled={false}
          offset={48}
          paddingSize="xl"
          grow={true}
          restrictWidth={true}
        >
          <>
            <EuiPageHeader
              pageTitle={"Invited Users"}
              paddingSize="xl"
              rightSideItems={[
                <Can
                  I={"create"}
                  a={"users"}
                >
                  <EuiButton
                    onClick={(): void => {
                      setIsFlyoutVisible(true);
                    }}
                  >
                    Invite Users
                  </EuiButton>
                </Can>,
              ]}
            ></EuiPageHeader>
            <EuiPageTemplate.Section>
              <InvitedUsersTable
                invitedUsers={invitedUsers ?? []}
                setInvitedUsers={setInvitedUsers}
              />
              {flyout}
            </EuiPageTemplate.Section>
          </>
        </EuiPageTemplate>
      }
    ></EuiSkeletonLoading>
  );
};

export { Invitations };
