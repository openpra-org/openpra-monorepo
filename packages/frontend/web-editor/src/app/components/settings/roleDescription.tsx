import { useParams } from "react-router-dom";
import { useEffect, useState } from "react";
import { MemberResult } from "shared-types/src/lib/api/Members";
import { ApiManager } from "shared-types/src/lib/api/ApiManager";
import {
  EuiBasicTable,
  EuiBasicTableColumn,
  EuiButton,
  EuiComboBox,
  EuiComboBoxOptionOption,
  EuiPageHeader,
  EuiPageTemplate,
  EuiSkeletonRectangle,
  EuiSpacer,
} from "@elastic/eui";
import { GetRoleById } from "shared-types/src/lib/api/roles/rolesApi";
import { RoleSchemaDto } from "shared-types/src/openpra-zod-mef/role/role-schema";
import { Can } from "../../providers/ability/AbilityProvider";
import { GenericModal } from "../modals/genericModal";
import { UseToastContext } from "../../providers/toastProvider";
import { GetESToast } from "../../../utils/treeUtils";

/**
 * Generate columns for table containing the roles of the users
 */
function constructColumns(rolename: string): EuiBasicTableColumn<MemberResult>[] {
  return [
    {
      name: rolename.charAt(0).toUpperCase() + rolename.slice(1),
      render: (item: MemberResult): JSX.Element => <span>{item.firstName + " " + item.lastName}</span>,
      mobileOptions: {
        render: (item: MemberResult): JSX.Element => <span>{item.firstName + " " + item.lastName}</span>,
        header: false,
        enlarge: false,
        width: "100%",
      },
    },
  ];
}

const RoleDescription = (): JSX.Element => {
  const { roleName } = useParams<{ roleName: string | undefined }>();
  const [isLoading, setIsLoading] = useState(false);
  const [roleMembers, setRoleMembers] = useState<MemberResult[]>([]);
  const [members, setMembers] = useState<MemberResult[]>([]);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [currRole, setCurrRole] = useState<RoleSchemaDto>();

  const { addToast } = UseToastContext();
  useEffect(() => {
    async function fetchRole(): Promise<void> {
      if (roleName !== undefined) {
        try {
          const role = await GetRoleById(roleName);
          if (role !== null) {
            setCurrRole(role);
          }
        } catch (err) {
          addToast(GetESToast("danger", "Failed to fetch role information"));
          setCurrRole(undefined);
        }
      }
    }

    async function fetchUsers(): Promise<void> {
      try {
        const roleMembers = await ApiManager.getUsersWithRole(roleName ?? "");
        const members = await ApiManager.getUsers();
        setRoleMembers(roleMembers.results);
        setMembers(members.results);
      } catch (err) {
        addToast(GetESToast("danger", "Failed to fetch users of this role"));
        setRoleMembers([]);
        setMembers([]);
      }
    }

    setIsLoading(true);
    Promise.all([fetchRole(), fetchUsers()])
      .then((results) => {
        setIsLoading(false);
      })
      .catch((errors) => {
        setIsLoading(false);
      });
  }, [roleName]);

  let modal;

  const optionsStatic: EuiComboBoxOptionOption<string>[] = members
    .filter((member) => !member.roles.includes(roleName as unknown as string))
    .map((member) => ({
      label: member.firstName + " " + member.lastName,
      id: String(member.id),
    }));

  const [selectedOptions, setSelected] = useState<EuiComboBoxOptionOption<string>[]>([]);

  const onChange = (selectedOptions: EuiComboBoxOptionOption<string>[]): void => {
    setSelected(selectedOptions);
  };

  const handleSubmit = async (): Promise<void> => {
    const ids = selectedOptions.map((x) => x.id);
    const filteredMembers = members.filter((member) => ids.includes(String(member.id)));
    const updatedMembers = filteredMembers.map((member) => ({
      ...member,
      roles: [...member.roles, roleName],
    }));
    const promises = updatedMembers.map((member) => ApiManager.updateUser(member.id, JSON.stringify(member)));
    void Promise.all(promises).then((_) => {
      setIsModalVisible(false);
      setRoleMembers((prev) => [...prev, ...filteredMembers]);
      setSelected([]);
    });
  };

  if (isModalVisible) {
    modal = (
      <GenericModal
        title={`New ${currRole?.name.toLowerCase()}`}
        showButtons={true}
        body={
          <EuiComboBox
            aria-label="Accessible screen reader label"
            placeholder="Select or create options"
            options={optionsStatic}
            selectedOptions={selectedOptions}
            onChange={onChange}
            isClearable={true}
            data-test-subj="demoComboBox"
          />
        }
        onClose={(): void => {
          setIsModalVisible(false);
          setSelected([]);
        }}
        onSubmit={handleSubmit}
        modalFormId="NewRoleModal"
      />
    );
  }
  if (!roleName) {
    return <div></div>;
  }
  return (
    <div>
      <EuiPageTemplate
        panelled={false}
        offset={0}
        paddingSize="s"
        grow={true}
        restrictWidth={true}
      >
        <EuiPageHeader
          pageTitle={currRole?.name ?? ""}
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
                  setIsModalVisible(true);
                }}
              >
                Assign {currRole?.name.toLowerCase() ?? ""}
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
              items={roleMembers}
              columns={constructColumns(roleName)}
            />
          </EuiSkeletonRectangle>
          <EuiSpacer size="s" />
        </EuiPageTemplate.Section>
      </EuiPageTemplate>
      {modal}
    </div>
  );
};

export { RoleDescription };
