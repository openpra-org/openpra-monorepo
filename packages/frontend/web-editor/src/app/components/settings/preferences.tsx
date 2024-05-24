import { EuiPageTemplate, EuiSkeletonLoading, EuiText } from "@elastic/eui";
import { Outlet, useParams } from "react-router-dom";
import { useEffect, useState } from "react";
import { MemberResult } from "shared-types/src/lib/api/Members";
import { ApiManager } from "shared-types/src/lib/api/ApiManager";
import React from "react";
import { NavInsideNav } from "../sidenavs/genericNav";

interface PreferenceContextType {
  currentUser: MemberResult | undefined;
  setCurrentUser: (user: MemberResult) => void;
}

const PreferenceContext = React.createContext<PreferenceContextType>({
  currentUser: undefined,
  setCurrentUser: () => {},
});

function Preferences(): JSX.Element {
  const { user } = useParams<{ user: string | undefined }>();
  const userId = Number(user);
  const [currentUser, setCurrentUser] = useState<MemberResult>();
  const [isLoading, setIsLoading] = useState<boolean>(true);
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
            <NavInsideNav />
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
            <NavInsideNav />
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
