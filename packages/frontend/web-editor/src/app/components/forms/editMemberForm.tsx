import React, { useEffect, useState } from "react";
import {
  EuiButton,
  EuiFieldText,
  EuiForm,
  EuiFormRow,
  EuiPageHeader,
  EuiPageTemplate,
  EuiDatePicker,
  EuiText,
  EuiSkeletonLoading,
} from "@elastic/eui";
import moment from "moment";
import { useParams } from "react-router-dom";
import { MemberResult } from "shared-sdk/lib/api/Members";
import { ApiManager } from "shared-sdk/lib/api/ApiManager";

/**
 * Main form container for editing and saving a user
 */
export function MemberForm(): JSX.Element {
  const { user } = useParams<{ user: string | undefined }>();
  const userId = Number(user);
  const [currentUer, setCurrentUser] = useState<MemberResult>();
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    ApiManager.getUserById(String(userId))
      .then((result) => {
        setCurrentUser(result);
        setIsLoading(false);
      })
      .catch((reason) => {
        //TODO : Handle this scenario
        setIsLoading(false);
      });
  }, [userId]);
  return (
    <EuiSkeletonLoading
      isLoading={isLoading}
      loadingContent={
        <EuiPageTemplate
          panelled={false}
          grow={false}
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
          grow={false}
          restrictWidth={true}
        >
          <EuiPageHeader
            pageTitle="Profile"
            paddingSize="l"
            data-testid="edit-user-title"
          ></EuiPageHeader>
          <EuiPageTemplate.Section>
            <EuiForm component="form">
              <EuiFormRow label="First Name">
                <EuiFieldText
                  name="member_firstname"
                  data-testid="edit-user-first-name"
                  defaultValue={currentUer?.firstName}
                  onChange={(event): void => {
                    setCurrentUser((pastMemberState) =>
                      pastMemberState ? { ...pastMemberState, firstName: event.target.value } : undefined,
                    );
                  }}
                />
              </EuiFormRow>
              <EuiFormRow label="Last Name">
                <EuiFieldText
                  name="member_lastname"
                  defaultValue={currentUer?.lastName}
                  data-testid="edit-user-last-name"
                  onChange={(event): void => {
                    setCurrentUser((pastMemberState) =>
                      pastMemberState ? { ...pastMemberState, lastName: event.target.value } : undefined,
                    );
                  }}
                />
              </EuiFormRow>
              <EuiFormRow label="Username">
                <EuiFieldText
                  name="member_username"
                  data-testid="edit-user-username"
                  defaultValue={currentUer?.username}
                  onChange={(event): void => {
                    setCurrentUser((pastMemberState) =>
                      pastMemberState ? { ...pastMemberState, username: event.target.value } : undefined,
                    );
                  }}
                />
              </EuiFormRow>
              <EuiFormRow label="Email">
                <EuiFieldText
                  name="member_email"
                  defaultValue={currentUer?.email}
                  data-testid="edit-user-email"
                  onChange={(event): void => {
                    setCurrentUser((pastMemberState) =>
                      pastMemberState ? { ...pastMemberState, email: event.target.value } : undefined,
                    );
                  }}
                />
              </EuiFormRow>
              <EuiFormRow label="Last Access Date">
                <EuiDatePicker
                  name="member_last_access"
                  selected={moment(currentUer?.last_login)}
                  readOnly={true}
                  data-testid="edit-user-last-access"
                />
              </EuiFormRow>
              <EuiFormRow label="Join Date">
                <EuiDatePicker
                  name="member_join_date"
                  selected={moment(currentUer?.account_created)}
                  readOnly={true}
                  data-testid="edit-user-join-date"
                />
              </EuiFormRow>
              <EuiFormRow>
                <EuiButton
                  data-testid="edit-user-submit"
                  onClick={(): void => {
                    if (currentUer !== undefined) {
                      void ApiManager.updateUser(currentUer.id, JSON.stringify(currentUer));
                      // TODO: State update parent component here
                    }
                  }}
                >
                  Save
                </EuiButton>
              </EuiFormRow>
            </EuiForm>
          </EuiPageTemplate.Section>
        </EuiPageTemplate>
      }
    ></EuiSkeletonLoading>
  );
}
