import { Route, Routes } from "react-router-dom";
import { SettingsContainer } from "../../components/pageContainers/settingsContainer";
import { UserList } from "../../components/lists/UsersList";
import { MemberForm } from "../../components/forms/editMemberForm";
import { UserProfilePage } from "../profilePages/userProfilePage";

/**
 * This function defines the routes for settings page
 *
 * @returns JSX.Element for the entire page which contains the routes
 */
export function SettingsPage(): JSX.Element {
  return (
    <Routes>
      <Route path="" element={<SettingsContainer />}>
        <Route path="" element={<UserProfilePage />}></Route>
        <Route path="users" element={<UserList />}></Route>
        <Route path=":user" element={<MemberForm />}></Route>

        <Route
          path="permissions"
          element={<p>Welcome to permissions section</p>}
        />
      </Route>
    </Routes>
  );
}
