import {
  EuiAvatar,
  EuiFlexGroup,
  EuiFlexItem,
  EuiIcon,
  EuiPageHeader,
  EuiPageTemplate,
  EuiSpacer,
  EuiText,
  EuiIconTip,
  EuiSkeletonLoading,
  useIsWithinBreakpoints,
} from "@elastic/eui";
import { useEffect, useState } from "react";
import { MemberResult } from "shared-sdk/lib/api/Members";
import { useNavigate } from "react-router-dom";
import { ApiManager } from "shared-sdk/lib/api/ApiManager";

/**
 * Function returns the main user profile page
 *
 */
export function UserProfilePage({ id }: { id: number }): JSX.Element {
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [onDetails, setOnDetails] = useState<boolean>(false);
  const [currentMember, setCurrentMember] = useState<MemberResult>();
  useEffect(() => {
    setIsLoading(true);
    ApiManager.getUserById(String(id))
      .then((result) => {
        setCurrentMember(result);
        setIsLoading(false);
      })
      .catch((reason) => {
        setIsLoading(false);
      });
  }, [id]);
  const navigate = useNavigate();
  const isMobile = useIsWithinBreakpoints(["xs", "s"]);
  return (
    <EuiSkeletonLoading
      isLoading={isLoading}
      loadingContent={
        <EuiPageTemplate
          panelled={false}
          offset={48}
          paddingSize="xl"
          grow={true}
          restrictWidth={true}
        >
          <EuiPageTemplate.Section>
            <EuiText>Loading Data...</EuiText>
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
          <EuiPageHeader
            pageTitle={currentMember?.firstName + " " + currentMember?.lastName}
            paddingSize="xl"
            data-testid="profile-name"
          ></EuiPageHeader>
          <EuiPageTemplate.Section grow={true}>
            <EuiAvatar
              size="xl"
              name={currentMember?.firstName + " " + currentMember?.lastName}
              type="space"
            />
            <EuiSpacer />
            <EuiSpacer />
            <div
              onMouseOver={(): void => {
                setOnDetails(true);
              }}
              onMouseLeave={(): void => {
                setOnDetails(false);
              }}
            >
              <EuiFlexGroup
                alignItems="flexStart"
                responsive={false}
                data-testid="profile-details-container"
              >
                <EuiFlexItem grow={false}>
                  <EuiText>
                    <h3>Details</h3>
                  </EuiText>
                </EuiFlexItem>
                {(onDetails || isMobile) && (
                  <EuiFlexItem
                    grow={false}
                    style={{ cursor: "pointer" }}
                    onClick={(): void => {
                      navigate("/settings/" + currentMember?.id);
                    }}
                    data-testid="profile-details-pencil"
                  >
                    <EuiIconTip
                      type="pencil"
                      content="Edit User"
                    />
                  </EuiFlexItem>
                )}
              </EuiFlexGroup>
              <EuiSpacer />
              <EuiFlexGroup
                alignItems="flexStart"
                responsive={false}
              >
                <EuiFlexItem grow={false}>
                  <EuiIcon type="user" />
                </EuiFlexItem>
                <EuiFlexItem
                  grow={false}
                  data-testid="profile-username"
                >
                  <EuiText size="s">{currentMember?.username}</EuiText>
                </EuiFlexItem>
              </EuiFlexGroup>
              <EuiSpacer></EuiSpacer>
              <EuiFlexGroup
                alignItems="flexStart"
                responsive={false}
              >
                <EuiFlexItem grow={false}>
                  <EuiIcon type="email" />
                </EuiFlexItem>
                <EuiFlexItem
                  grow={false}
                  data-testid="profile-email"
                >
                  <EuiText size="s">{currentMember?.email}</EuiText>
                </EuiFlexItem>
              </EuiFlexGroup>
            </div>
          </EuiPageTemplate.Section>
        </EuiPageTemplate>
      }
    ></EuiSkeletonLoading>
  );
}
