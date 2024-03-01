import React, { useEffect, useState } from "react";
import {
  EuiButton,
  EuiFieldText,
  EuiForm,
  EuiFormRow,
  EuiPageHeader,
  EuiPageTemplate,
  EuiSkeletonRectangle,
  EuiDatePicker,
} from "@elastic/eui";
import { useParams } from "react-router-dom";
import ApiManager from "shared-types/src/lib/api/ApiManager";
import { MemberResult } from "shared-types/src/lib/api/Members";
import moment, { Moment } from "moment";

/**
 * Main form container for editing and saving a user
 */
export function MemberForm(): JSX.Element {
  const { user } = useParams<{ user: string | undefined }>();
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [member, setMember] = useState<MemberResult>();
  const [lastAccessDate, setLastAccessDate] = useState<Moment>();
  const [accountCreated, setAccountCreated] = useState<Moment>();
  useEffect(() => {
    if (user !== undefined) {
      ApiManager.getUserById(user)
        .then((result: MemberResult) => {
          setLastAccessDate(moment(result.last_login));
          setAccountCreated(moment(result.account_created));
          setMember(result);
          setIsLoading(false);
        })
        .catch((error): void => {
          //TODO: Add error handling
          setIsLoading(false);
        });
    }
  }, [user]);
  return (
    <EuiPageTemplate panelled={false} grow={false} restrictWidth={true}>
      <EuiPageHeader
        pageTitle="Profile"
        paddingSize="l"
        data-testid="edit-user-title"
      ></EuiPageHeader>
      <EuiPageTemplate.Section>
        <EuiSkeletonRectangle
          width="100%"
          height="100%"
          isLoading={isLoading}
          contentAriaLabel="User Details"
        >
          <EuiForm component="form">
            <EuiFormRow label="First Name">
              <EuiFieldText
                name="member_firstname"
                data-testid="edit-user-first-name"
                defaultValue={member?.firstName}
                onChange={(event): void => {
                  if (member !== undefined) {
                    const current: MemberResult = member;
                    current.firstName = event.target.value;
                    setMember(current);
                  }
                }}
              />
            </EuiFormRow>
            <EuiFormRow label="Last Name">
              <EuiFieldText
                name="member_lastname"
                defaultValue={member?.lastName}
                data-testid="edit-user-last-name"
                onChange={(event): void => {
                  if (member !== undefined) {
                    const current: MemberResult = member;
                    current.lastName = event.target.value;
                    setMember(current);
                  }
                }}
              />
            </EuiFormRow>
            <EuiFormRow label="Username">
              <EuiFieldText
                name="member_username"
                data-testid="edit-user-username"
                defaultValue={member?.username}
                onChange={(event): void => {
                  if (member !== undefined) {
                    const current: MemberResult = member;
                    current.username = event.target.value;
                    setMember(current);
                  }
                }}
              />
            </EuiFormRow>
            <EuiFormRow label="Email">
              <EuiFieldText
                name="member_email"
                defaultValue={member?.email}
                data-testid="edit-user-email"
                onChange={(event): void => {
                  if (member !== undefined) {
                    const current: MemberResult = member;
                    current.email = event.target.value;
                    setMember(current);
                  }
                }}
              />
            </EuiFormRow>
            <EuiFormRow label="Last Access Date">
              <EuiDatePicker
                name="member_last_access"
                selected={lastAccessDate}
                readOnly={true}
                data-testid="edit-user-last-access"
              />
            </EuiFormRow>
            <EuiFormRow label="Join Date">
              <EuiDatePicker
                name="member_join_date"
                selected={accountCreated}
                readOnly={true}
                data-testid="edit-user-join-date"
              />
            </EuiFormRow>
            <EuiFormRow>
              <EuiButton
                data-testid="edit-user-submit"
                onClick={(): void => {
                  if (member !== undefined) {
                    void ApiManager.updateUser(
                      member.id,
                      JSON.stringify(member),
                    );
                  }
                }}
              >
                Save
              </EuiButton>
            </EuiFormRow>
          </EuiForm>
        </EuiSkeletonRectangle>
      </EuiPageTemplate.Section>
    </EuiPageTemplate>
  );
}
