import { EuiIcon, EuiPageTemplate, EuiSkeletonLoading, EuiText } from "@elastic/eui";
import { Outlet, useParams } from "react-router-dom";
import { useContext, useEffect, useState } from "react";
import { MemberResult } from "shared-sdk/lib/api/Members";
import { ApiManager } from "shared-sdk/lib/api/ApiManager";
import React from "react";
import { NavInsideNav } from "../sidenavs/genericNav";
import { AbilityContext } from "../../providers/abilityProvider";

interface PreferenceContextType {
  currentUser: MemberResult | undefined;
  setCurrentUser: (user: MemberResult) => void;
}

const PreferenceContext = React.createContext<PreferenceContextType>({
  currentUser: undefined,
  setCurrentUser: () => {},
});

const GENERAL = {
  name: "General",
  id: "General",
  icon: <EuiIcon type="gear" />,
  items: [{ name: "Personal Data", url: "personal-data", data: {} }],
};

const AUTHENTICATION = {
  name: "Authentication",
  id: "Authentication",
  icon: <EuiIcon type="gear" />,
  items: [
    {
      name: "Logins",
      url: "logins",
      data: {},
    },
  ],
};

function Preferences(): JSX.Element {
  const { user } = useParams<{ user: string | undefined }>();
  const userId = Number(user);
  const [currentUser, setCurrentUser] = useState<MemberResult>();
  const [isLoading, setIsLoading] = useState<boolean>(true);
  let navItems = [GENERAL];
  const ability = useContext(AbilityContext);
  if (ability.can("create", "users")) {
    navItems = [...navItems, AUTHENTICATION];
  }
  useEffect(() => {
    ApiManager.getUserById(String(userId))
      .then((result) => {
        setCurrentUser(result);
        setIsLoading(false);
      })
      .catch(() => {
        setIsLoading(false);
      });
  }, [userId]);
  return (
    <EuiSkeletonLoading
      isLoading={isLoading}
      loadingContent={
        <EuiPageTemplate
          paddingSize="none"
          panelled={false}
        >
          <EuiPageTemplate.Sidebar
            paddingSize="s"
            sticky={true}
          >
            <NavInsideNav items={navItems} />
          </EuiPageTemplate.Sidebar>

          <EuiPageTemplate.Section>
            <EuiText>Loading ...</EuiText>
          </EuiPageTemplate.Section>
        </EuiPageTemplate>
      }
      loadedContent={
        <EuiPageTemplate
          paddingSize="none"
          panelled={false}
        >
          <EuiPageTemplate.Sidebar
            paddingSize="s"
            sticky={true}
          >
            <NavInsideNav items={navItems} />
          </EuiPageTemplate.Sidebar>

          <EuiPageTemplate.Section>
            <PreferenceContext.Provider value={{ currentUser, setCurrentUser }}>
              <Outlet />
            </PreferenceContext.Provider>
          </EuiPageTemplate.Section>
        </EuiPageTemplate>
      }
    ></EuiSkeletonLoading>
  );
}

export { Preferences, PreferenceContextType, PreferenceContext };
