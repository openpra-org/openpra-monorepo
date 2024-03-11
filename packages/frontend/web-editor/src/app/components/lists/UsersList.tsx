import {
  EuiPageTemplate,
  EuiSkeletonRectangle,
  EuiSpacer,
  EuiBasicTable,
  EuiPageHeader,
  EuiButton,
} from "@elastic/eui";
import { useEffect, useState } from "react";
import ApiManager from "shared-types/src/lib/api/ApiManager";
import { MemberResult, Members } from "shared-types/src/lib/api/Members";
import { EuiBasicTableColumn } from "@elastic/eui/src/components/basic_table/basic_table";
import { Link } from "react-router-dom";

/**
 * Generate columns for table containing the names of the users
 */
function constructColumns(): EuiBasicTableColumn<MemberResult>[] {
  return [
    {
      name: "Users",
      render: (item: MemberResult): JSX.Element => (
        <Link to={"../" + item.id}>{item.firstName + " " + item.lastName}</Link>
      ),
      mobileOptions: {
        render: (item: MemberResult): JSX.Element => (
          <span>
            <Link to={"../" + item.id}>
              {item.firstName + " " + item.lastName}
            </Link>
          </span>
        ),
        header: false,
        enlarge: false,
        width: "100%",
      },
    },
  ];
}

/**
 * Exports the list of users JSX.Element
 *
 */
export function UserList(): JSX.Element {
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [users, setUsers] = useState<MemberResult[]>([]);
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
          <EuiButton fill>New User</EuiButton>,
          <EuiButton>Invite Users</EuiButton>,
        ]}
      ></EuiPageHeader>
      <EuiPageTemplate.Section>
        <EuiSkeletonRectangle
          width="100%"
          height="100%"
          isLoading={isLoading}
          contentAriaLabel="Example description"
        >
          <EuiBasicTable items={users} columns={constructColumns()} />
        </EuiSkeletonRectangle>
        <EuiSpacer size="s" />
      </EuiPageTemplate.Section>
    </EuiPageTemplate>
  );
}
