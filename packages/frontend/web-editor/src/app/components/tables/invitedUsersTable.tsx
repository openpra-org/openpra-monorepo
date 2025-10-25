import {
  formatDate,
  EuiBasicTable,
  EuiBasicTableColumn,
  EuiTableFieldDataColumnType,
  Criteria,
  EuiText,
  EuiSpacer,
  EuiHorizontalRule,
  copyToClipboard,
} from "@elastic/eui";
import { InvitedUserDetailsDto } from "shared-types/src/lib/types/userInvites/InvitedUser";
import { useMemo, useState } from "react";
import { DefaultItemAction } from "@elastic/eui/src/components/basic_table/action_types";
import { UserInviteApi } from "shared-sdk/lib/api/invites/userInviteApi";
import { UseToastContext } from "../../providers/toastProvider";
import { GenerateUUID } from "../../../utils/treeUtils";

const InvitedUsersTable = ({
  invitedUsers,
  setInvitedUsers,
}: {
  invitedUsers: InvitedUserDetailsDto[];
  setInvitedUsers: (invitedUsers: InvitedUserDetailsDto[]) => void;
}): JSX.Element => {
  const [pageIndex, setPageIndex] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  const { addToast } = UseToastContext();

  const actions = useMemo(() => {
    const actions: DefaultItemAction<InvitedUserDetailsDto>[] = [
      {
        name: "Copy Invite Link",
        description: "Copy invite link",
        icon: "copy",
        color: "primary",
        type: "icon",
        enabled: () => true,
        onClick: ({ id }): void => {
          copyToClipboard(String(window.location.origin) + "/invite/" + String(id ?? ""));
        },
        target: "_self",
        "data-test-subj": "action-copy",
      },
      {
        name: "Delete Invite",
        description: "Delete invited user",
        icon: "trash",
        color: "primary",
        type: "icon",
        enabled: () => true,
        onClick: ({ id }): void => {
          const backup = invitedUsers;
          const newInvitedUsers = invitedUsers.filter((element, _) => element.id !== id);
          setInvitedUsers(newInvitedUsers);
          UserInviteApi.deleteInviteById(id ?? "")
            .then((res) => {
              res
                .json()
                .then((res) => {
                  if (!res) {
                    addToast({
                      id: GenerateUUID(),
                      title: "Something went wrong while deleting invited user",
                      color: "danger",
                    });
                    setInvitedUsers(backup);
                  }
                })
                .catch((err: unknown) => {
                  addToast({
                    id: GenerateUUID(),
                    title: `Error: ${String(err)}`,
                    color: "danger",
                  });
                  setInvitedUsers(backup);
                });
            })
            .catch((err: unknown) => {
              addToast({
                id: GenerateUUID(),
                title: `Error: ${String(err)}`,
                color: "danger",
              });
              setInvitedUsers(backup);
            });
        },
        target: "_self",
        "data-test-subj": "action-copy",
      },
    ];
    return actions;
  }, [addToast, invitedUsers, setInvitedUsers]);

  const onTableChange = ({ page }: Criteria<InvitedUserDetailsDto>): void => {
    if (page) {
      const { index: pageIndex, size: pageSize } = page;
      setPageIndex(pageIndex);
      setPageSize(pageSize);
    }
  };

  const findUsers = (
    users: InvitedUserDetailsDto[],
    pageIndex: number,
    pageSize: number,
  ): {
    pageOfItems: InvitedUserDetailsDto[];
    totalItemCount: number;
  } => {
    let pageOfItems;

    if (!pageIndex && !pageSize) {
      pageOfItems = users;
    } else {
      const startIndex = pageIndex * pageSize;
      pageOfItems = users.slice(startIndex, Math.min(startIndex + pageSize, users.length));
    }
    return {
      pageOfItems,
      totalItemCount: users.length,
    };
  };

  const { pageOfItems, totalItemCount } = findUsers(invitedUsers, pageIndex, pageSize);

  const pagination = {
    pageIndex,
    pageSize,
    totalItemCount,
    pageSizeOptions: [10, 0],
  };
  const resultsCount =
    pageSize === 0 ? (
      <strong>All</strong>
    ) : (
      <>
        <strong>
          {String(pageSize * pageIndex + 1)}-{String(pageSize * pageIndex + pageSize)}
        </strong>{" "}
        of {String(totalItemCount)}
      </>
    );

  const columns: EuiBasicTableColumn<InvitedUserDetailsDto>[] = [
    {
      field: "firstName",
      name: "First Name",
      "data-test-subj": "firstNameCell",
      mobileOptions: {
        render: (user: InvitedUserDetailsDto) => (
          <>
            {user.firstname} {user.lastname}
          </>
        ),
        header: false,
        truncateText: false,
        enlarge: true,
        width: "100%",
      },
    },
    {
      field: "lastname",
      name: "Last Name",
      truncateText: true,
      mobileOptions: {
        show: false,
      },
    },
    {
      field: "username",
      name: "Username",
    },
    {
      field: "email",
      name: "Email",
    },
    {
      field: "numberOfInvites",
      name: "Num of Invites",
    },
    {
      field: "expiry",
      name: "Link Expiry",
      dataType: "date",
      render: (user: Date) => formatDate(user, "dateTime"),
    },
  ];

  const columnsWithActions = [
    ...columns,
    {
      name: "Actions",
      actions,
    },
  ];

  const getRowProps = (
    user: InvitedUserDetailsDto,
  ): {
    className: string;
    "data-test-subj": string;
  } => {
    const { id } = user;
    return {
      "data-test-subj": `row-${String(id ?? "")}`,
      className: "customRowClass",
    };
  };
  const getCellProps = (
    user: InvitedUserDetailsDto,
    column: EuiTableFieldDataColumnType<InvitedUserDetailsDto>,
  ): {
    className: string;
    "data-test-subj": string;
    textOnly: boolean;
  } => {
    const { id } = user;
    const { field } = column;
    return {
      className: "customCellClass",
      "data-test-subj": `cell-${String(id ?? "")}-${String(field)}`,
      textOnly: true,
    };
  };
  return (
    <>
      <EuiText size="xs">
        Showing {resultsCount} <strong>Users</strong>
      </EuiText>
      <EuiSpacer size="s" />
      <EuiHorizontalRule margin="none" />
      <EuiBasicTable
        id="id"
        tableCaption="Invited Users"
        items={pageOfItems}
        rowHeader="firstName"
        columns={columnsWithActions}
        rowProps={getRowProps}
        cellProps={getCellProps}
        pagination={pagination}
        onChange={onTableChange}
      />
    </>
  );
};
export { InvitedUsersTable };
