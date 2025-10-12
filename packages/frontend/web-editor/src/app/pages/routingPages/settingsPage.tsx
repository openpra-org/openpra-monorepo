import { Route, Routes } from "react-router-dom";
import { ApiManager } from "shared-sdk/lib/api/ApiManager";
import { SettingsContainer } from "../../components/pageContainers/settingsContainer";
import { Users } from "../../components/settings/users";
import { MemberForm } from "../../components/forms/editMemberForm";
import { UserProfilePage } from "../../components/settings/userProfilePage";
import { Preferences } from "../../components/settings/preferences";
import { EditPersonalInfoForm } from "../../components/forms/editPersonalInfoForm";
import { PasswordChange } from "../../components/settings/passwordChange";
import { Invitations } from "../../components/settings/invitations";
import { Roles } from "../../components/settings/roles";
import { RoleDescription } from "../../components/settings/roleDescription";

/**
 * This function defines the routes for settings page
 *
 * @returns JSX.Element for the entire page which contains the routes
 */
export function SettingsPage(): JSX.Element {
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
        ></Route>
        <Route
          path="users"
          element={<Users />}
        ></Route>
        <Route
          path=":user"
          element={<MemberForm />}
        ></Route>
        <Route
          path="preferences/:user"
          element={<Preferences />}
        >
          <Route
            path="personal-data"
            element={<EditPersonalInfoForm />}
          ></Route>
          <Route
            path="logins"
            element={<PasswordChange />}
          ></Route>
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
}
