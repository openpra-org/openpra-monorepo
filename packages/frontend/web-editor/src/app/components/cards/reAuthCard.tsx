import { EuiButton, EuiFieldPassword, EuiFlexGroup, EuiFlexItem, EuiForm, EuiFormRow, EuiOverlayMask, EuiText } from "@elastic/eui";
import ApiManager from "packages/shared-types/src/lib/api/ApiManager";
import { useEffect, useState } from "react";

export default function ReAuthCard() {
  const [password, setPassword] = useState("");
  const [invalid, setInvalid] = useState(false);

  function refresh() {
    setInvalid(false)
    const currentUser = ApiManager.getCurrentUser().username
    ApiManager.refreshToken()
  }

  return (
    <EuiOverlayMask>
        <EuiFlexGroup direction='column' alignItems='center'>
            <EuiFlexItem grow={false}>
                <EuiText textAlign='center'>
                    Your session is about to expire. Click OK to extend your session.
                </EuiText>
            </EuiFlexItem>
            <EuiFlexItem grow={false}>
                <EuiButton onClick={refresh}>
                    OK
                </EuiButton>
            </EuiFlexItem>
        </EuiFlexGroup>
    </EuiOverlayMask>
);

}
