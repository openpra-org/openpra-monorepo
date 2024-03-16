import {
  EuiCollapsibleNavGroup,
  EuiListGroup,
  EuiListGroupItem,
  EuiToken,
  EuiText,
  slugify,
  useEuiTheme,
} from "@elastic/eui";
import { useState, useEffect } from "react";
import {useLocation, useNavigate} from "react-router-dom";
import { GetNavTabs } from "shared-types/src/lib/api/TypedModelApiManager";
import ApiManager from "shared-types/src/lib/api/ApiManager";
import {
  PinnableCollapsibleNavGroupProps,
  sideNavModel,
} from "../../api/models/sideNavModel";
import { ScopedNavUpdateModal } from "./ScopedNavUpdateModal";
const NAVBAR_PARENT_ICONSIZE = "m";
const NAVBAR_PARENT_TITLESIZE = "xs";
/**
 * Functional component representing the navigation menu.
 * @returns JSX element.
 */
export default function PinnableScopedNav(): JSX.Element {
  /**
   * Fetches navigation tabs for the sidebar based on the current user.
   *
   * @returns A Promise that resolves to an array of `sideNavModel`.
   */
  async function fetchNavTabs(): Promise<sideNavModel[]> {
    try {
      console.log(ApiManager.getCurrentUser().user_id);
      return await GetNavTabs(ApiManager.getCurrentUser().user_id);
    } catch (error) {
      console.error("Error fetching sidebar navs:", error);
      return [];
    }
  }

  /**
   * Asynchronously fetches navigation tabs.
   * @returns A Promise resolving to an array of PinnableCollapsibleNavGroupProps.
   */
  const getTabs = async (): Promise<PinnableCollapsibleNavGroupProps[]> => {
    try {
      // Fetch navigation tabs data
      const navTabList = await fetchNavTabs();
      // Initialize an array to store PinnableCollapsibleNavGroupProps
      const navTabs: PinnableCollapsibleNavGroupProps[] = [];
      navTabList.length !== 0 &&
        navTabList.map((navTab) =>
          navTabs.push({
            // Title configuration
            title: (
              <EuiText color={"primary"} title={navTab.title}>
                {navTab.title}
              </EuiText>
            ),
            iconSize: NAVBAR_PARENT_ICONSIZE,
            titleSize: NAVBAR_PARENT_TITLESIZE,
            id: slugify(navTab.title),
            isExpanded: false,
            onClick: () => {
              navigate(navTab.navigateTo);
            },
            // Children configuration
            children:
              navTab.children.length !== 0
                ? navTab.children.map((childElement) => ({
                    label: (
                      <EuiText
                        color={"primary"}
                        title={childElement.label}
                      >
                        {childElement.label}
                      </EuiText>
                    ),
                    id: childElement.label,
                    icon: <EuiToken iconType={childElement.iconType} />,
                    pinned: childElement.pinned,
                    visible: true,
                    onClick: (): void => {
                      navigate(childElement.navigateTo);
                    },
                  }))
                : [],
            pinned: navTab.pinned,
            visible: navTab.visible,
          }),
        );
      console.log(navTabs);
      // Return the array of PinnableCollapsibleNavGroupProps
      return navTabs;
    } catch (error) {
      console.error("Error fetching sidebar navs:", error);
      return []; // Return an empty array or handle the error as needed
    }
  };

  //state to store the user side nav preferences
  const [navGroups, setNavGroups] = useState<
    PinnableCollapsibleNavGroupProps[]
  >([]);

  // Visibility states
  // to handle the modal visibility
  const [isModalVisible, setIsModalVisible] = useState(false);

  const [customNavGroups, setCustomNavGroups] = useState<
    PinnableCollapsibleNavGroupProps[]
  >([]);

  /**
   * The current location object, which represents where the app is now.
   */
  const location = useLocation();

  const navigate = useNavigate();

  //functions to set the modal visibility as well update the sidebar state on closing of modal
  const closeModal = (data: PinnableCollapsibleNavGroupProps[]) => {
    setIsModalVisible(false);
    setNavGroups(data);
  };
  const showModal = () => {
    setIsModalVisible(true);
  };

  useEffect(() => {
    try {
      const fetchNavItems = async () => {
        try {
          const navData = await getTabs();
          const IE = navData[0];
          const POS = navData[1];
          const ES = navData[2];
          const SC = navData[3];
          const SY = navData[4];
          const HR = navData[5];
          const DA = navData[6];
          const FL = navData[7];
          const F = navData[8];
          const S = navData[9];
          const HS = navData[10];
          const W = navData[11];
          const XF = navData[12];
          const O = navData[13];
          const ESQ = navData[14];
          const MS = navData[15];
          const RC = navData[16];
          const RI = navData[17];
          if (location.pathname.split("/")[1] === "internal-events") {
            setCustomNavGroups([POS, IE, ES, SC, SY, HR, DA, ESQ, MS, RC, RI]);
          }
          if (location.pathname.split("/")[1] === "internal-hazards") {
            setCustomNavGroups([POS, IE, ES, SC, SY, HR, DA, FL, F, HS, O, ESQ, MS, RC, RI]);
          }
          if (location.pathname.split("/")[1] === "external-hazards") {
            setCustomNavGroups([POS, IE, ES, SC, SY, HR, DA, S, HS, W, XF, O, ESQ, MS, RC, RI]);
          }
          if (location.pathname.split("/")[1] === "full-scope") {
            setCustomNavGroups(navData)
          }
          setNavGroups(navData);
        } catch (error) {
          console.error("Error fetching sidebar navs:", error);
        }
      };
      fetchNavItems().catch((error) => {
        console.error("Error fetching sidebar navs:", error);
      });
      localStorage.setItem("isNavOpenOnCollapsed", "false");
    } catch (error) {
      console.error("Error fetching sidebar navs:", error);
    }
  }, []);
  return (
    <>
      {/*{(isNavCollapsed || isNavOpenOnCollapsed === "true") && (*/}
      {/*  <>*/}
      <EuiListGroup>
        <EuiListGroupItem
          key={"sideBarSettings"}
          onClick={showModal}
          label={"OpenPRA Sidebar Settings"}
          style={{
            backgroundColor: "rgb(85 85 85 / 27%)",
            borderRadius: 5,
          }}
        >
        </EuiListGroupItem>
      </EuiListGroup>


      {/*Displaying the pinned Nav Groups first, however would like to discuss this feature.*/}
      {customNavGroups.length !== 0 &&
        customNavGroups.map((navGroup) => {
          //checking if nav group's visibility is set to true by user
          if (navGroup.pinned && navGroup.visible) {
            return (
              <EuiCollapsibleNavGroup
                title={navGroup.title}
                iconSize={navGroup.iconSize}
                titleSize={navGroup.titleSize}
                key={navGroup.id}
                isCollapsible={true}
                isDisabled={false}
                buttonElement="button"
                initialIsOpen={false}
              >
                {navGroup.children.length !== 0 && (
                  <EuiListGroup>
                    {navGroup.children.map((childElement) => {
                      if (childElement.pinned && childElement.visible) {
                        return (
                          <EuiListGroupItem
                            key={childElement.id}
                            icon={childElement.icon}
                            onClick={childElement.onClick}
                            label={childElement.label}
                            extraAction={{
                              iconType: "pinFilled",
                              alwaysShow: true,
                              "aria-label": childElement.id,
                              "aria-labelledby": childElement.id,
                            }}
                          />
                        );
                      }
                    })}
                    {navGroup.children.map((childElement) => {
                      if (!childElement.pinned && childElement.visible) {
                        return (
                          <EuiListGroupItem
                            key={childElement.id}
                            icon={childElement.icon}
                            onClick={childElement.onClick}
                            label={childElement.label}
                          />
                        );
                      }
                    })}
                  </EuiListGroup>
                )}
              </EuiCollapsibleNavGroup>
            );
          }
        })}
      {navGroups.length !== 0 &&
        customNavGroups.map((navGroup) => {
          if (!navGroup.pinned && navGroup.visible) {
            return (
              <EuiCollapsibleNavGroup
                title={navGroup.title}
                iconSize={navGroup.iconSize}
                titleSize={navGroup.titleSize}
                key={navGroup.id}
                isCollapsible={true}
                isDisabled={false}
                buttonElement="button"
                initialIsOpen={false}
              >
                {navGroup.children.length !== 0 && (
                  <EuiListGroup>
                    {navGroup.children.map((childElement) => (
                      <EuiListGroupItem
                        key={childElement.id}
                        icon={childElement.icon}
                        onClick={childElement.onClick}
                        label={childElement.label}
                      />
                    ))}
                  </EuiListGroup>
                )}
              </EuiCollapsibleNavGroup>
            );
          }
        })}

      {/*//This is a Modal to customize the nav group preferences for the user*/}
      {isModalVisible && (
        <ScopedNavUpdateModal
          customData={customNavGroups}
          data={navGroups}
          closeModal={closeModal}
        />
      )}
      {/*</>*/}
      {/*)}*/}
    </>
  );
}
