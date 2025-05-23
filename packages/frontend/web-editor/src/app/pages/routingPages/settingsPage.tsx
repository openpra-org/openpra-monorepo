import { Route, Routes } from "react-router-dom";
import { ApiManager } from "shared-types/src/lib/api/ApiManager";

import { MemberForm } from "../../components/forms/editMemberForm";
import { EditPersonalInfoForm } from "../../components/forms/editPersonalInfoForm";
import { SettingsContainer } from "../../components/pageContainers/settingsContainer";
import { Invitations } from "../../components/settings/invitations";
import { PasswordChange } from "../../components/settings/passwordChange";
import { Preferences } from "../../components/settings/preferences";
import { RoleDescription } from "../../components/settings/roleDescription";
import { Roles } from "../../components/settings/roles";
import { UserProfilePage } from "../../components/settings/userProfilePage";
import { Users } from "../../components/settings/users";

/**
 * This function defines the routes for settings page
 *
 * @returns JSX.Element for the entire page which contains the routes
 */
export const SettingsPage = (): JSX.Element => {
  const id = ApiManager.getCurrentUser().user_id;
  if (id === undefined) {
    return <div>Seems like the user is not logged in</div>;
  }
  return (
    <Routes>
      <Route
        path=""
        element={<SettingsContainer />}
      >
        <Route
          path=""
          element={<UserProfilePage id={id} />}
        />
        <Route
          path="users"
          element={<Users />}
        />
        <Route
          path=":user"
          element={<MemberForm />}
        />
        <Route
          path="preferences/:user"
          element={<Preferences />}
        >
          <Route
            path="personal-data"
            element={<EditPersonalInfoForm />}
          />
          <Route
            path="logins"
            element={<PasswordChange />}
          />
        </Route>

        <Route
          path="roles"
          element={<Roles />}
        >
          <Route
            path=":roleName"
            element={<RoleDescription />}
          />
        </Route>
        <Route
          path="invitations"
          element={<Invitations />}
        />
      </Route>
    </Routes>
  );
};
