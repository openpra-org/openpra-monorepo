import {
  EuiFlyout,
  EuiForm,
  EuiFlyoutHeader,
  EuiTitle,
  EuiText,
  EuiFlyoutBody,
  EuiSpacer,
  EuiButtonGroup,
  EuiFlyoutFooter,
  EuiFieldText,
  EuiFormRow,
  EuiSelect,
  EuiTextArea,
  EuiFlexGroup,
  EuiFlexItem,
  EuiButton,
  EuiFieldNumber,
  copyToClipboard,
} from "@elastic/eui";
import { ChangeEvent, useState } from "react";
import { UserInviteApi } from "shared-types/src/lib/api/invites/userInviteApi";
import { InviteIdDto } from "shared-types/src/lib/types/userInvites/InvitedUser";
import { ExpiryOptions } from "../settings/users";
import { DefaultSignupProps } from "../login/signUp";
import { UseToastContext } from "../../providers/toastProvider";
import { GetESToast } from "../../../utils/treeUtils";

const buttons = [
  {
    id: `button__0`,
    label: "Member",
  },
  {
    id: `button__1`,
    label: "Admin",
  },
  {
    id: `button__2`,
    label: "Collaborators",
  },
];

const linkOrEmailButtons = [
  {
    id: `button__link`,
    label: "Invitation Links",
  },
  {
    id: `button__email`,
    label: "Email",
  },
];

const InviteMultipleUsersFlyout = ({
  setIsFlyoutVisible,
}: {
  setIsFlyoutVisible: (val: boolean) => void;
}): JSX.Element => {
  const [toggle, setToggle] = useState(buttons[0].id);
  const [typeOfInvite, setTypeOfInvite] = useState(linkOrEmailButtons[0].id);
  const [expiry, setExpiry] = useState(ExpiryOptions[0].value);
  const [numberOfInvites, setNumberOfInvites] = useState(1);
  const { addToast } = UseToastContext();

  const onChangeOption = (optionId: string): void => {
    setToggle(optionId);
  };

  const onEmailOrInviteChange = (optionId: string): void => {
    setTypeOfInvite(optionId);
  };
  const onValueChange = (e: ChangeEvent<HTMLSelectElement>): void => {
    setExpiry(Number(e.target.value));
  };
  const generateInvites = (): void => {
    UserInviteApi.inviteUser(DefaultSignupProps, expiry, numberOfInvites)
      .then((result) => {
        result
          .json()
          .then((res: InviteIdDto) => {
            copyToClipboard(window.location.origin + "/invite/" + res.id);
          })
          .catch((_) => {
            addToast(GetESToast("danger", "Something went wrong"));
          });
        setIsFlyoutVisible(false);
      })
      .catch((_) => {
        addToast(GetESToast("danger", "Something went wrong"));
      });
  };

  return (
    <EuiFlyout
      type={"overlay"}
      side={"right"}
      size={"s"}
      onClose={(): void => {
        setIsFlyoutVisible(false);
      }}
      aria-labelledby={"flyoutTitleId"}
    >
      <EuiFlyoutHeader hasBorder>
        <EuiTitle size="m">
          <h2 id={"flyoutTitleId"}>Invite users</h2>
        </EuiTitle>
      </EuiFlyoutHeader>
      <EuiFlyoutBody>
        <EuiForm>
          <EuiText>Select type of user:</EuiText>
          <EuiSpacer />
          <EuiButtonGroup
            legend="Select type of user"
            color={"primary"}
            options={buttons}
            idSelected={toggle}
            onChange={(id): void => {
              onChangeOption(id);
            }}
            buttonSize="m"
            isFullWidth
          />
          <EuiSpacer />

          <EuiFormRow label={"Starting Project"}>
            <EuiFieldText></EuiFieldText>
          </EuiFormRow>
          <EuiSpacer />
          <EuiText>Select type of invite:</EuiText>
          <EuiSpacer />
          <EuiButtonGroup
            legend="Email or Link"
            color={"primary"}
            options={linkOrEmailButtons}
            idSelected={typeOfInvite}
            onChange={(id): void => {
              onEmailOrInviteChange(id);
            }}
            buttonSize="m"
          />
          {typeOfInvite === linkOrEmailButtons[0].id && (
            <>
              <EuiSpacer />
              <EuiFormRow label={"Expiry"}>
                <EuiSelect
                  id={"SelectId"}
                  options={ExpiryOptions}
                  value={expiry}
                  onChange={onValueChange}
                />
              </EuiFormRow>
              <EuiFormRow
                label={"Number of invitations"}
                isInvalid={numberOfInvites < 1}
                error={["Invitations cannot be less than 1"]}
              >
                <EuiFieldNumber
                  defaultValue={numberOfInvites}
                  onChange={(e): void => {
                    setNumberOfInvites(Number(e.target.value));
                  }}
                ></EuiFieldNumber>
              </EuiFormRow>
            </>
          )}
          {typeOfInvite === linkOrEmailButtons[1].id && (
            <>
              <EuiSpacer />
              <EuiFormRow label={"List of emails"}>
                <EuiTextArea placeholder={"xyz@gmail.com, abc@gmail.com"}></EuiTextArea>
              </EuiFormRow>
            </>
          )}
        </EuiForm>
      </EuiFlyoutBody>
      <EuiFlyoutFooter>
        <EuiFlexGroup justifyContent="spaceBetween">
          <EuiFlexItem grow={false}></EuiFlexItem>
          <EuiFlexItem grow={false}>
            <EuiButton
              fill
              onClick={generateInvites}
            >
              Generate Invite and copy
            </EuiButton>
          </EuiFlexItem>
        </EuiFlexGroup>
      </EuiFlyoutFooter>
    </EuiFlyout>
  );
};

export { InviteMultipleUsersFlyout };
