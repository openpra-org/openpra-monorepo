import {
  EuiCollapsibleNavGroup,
  EuiSwitch,
  EuiListGroup,
  EuiListGroupItem,
  EuiToken,
  EuiText,
  EuiOverlayMask,
  EuiModal,
  EuiModalHeader,
  EuiModalHeaderTitle,
  EuiModalBody,
  EuiModalFooter,
  EuiButtonEmpty,
  EuiButton,
  slugify,
  EuiIcon,
  EuiButtonIcon,
  EuiFlexGrid,
  EuiFlexItem,
  EuiFlexGroup,
  useIsWithinBreakpoints,
} from "@elastic/eui";
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { GetNavTabs } from "shared-types/src/lib/api/TypedModelApiManager";
import ApiManager from "shared-types/src/lib/api/ApiManager";
import { functions } from "lodash";
import { EuiSwitchEvent } from "@elastic/eui/src/components/form/switch/switch";
import {
  PinnableCollapsibleNavGroupProps,
  sideNavModel,
} from "../../api/models/sideNavModel";

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
      console.log(navTabList);
      // Initialize an array to store PinnableCollapsibleNavGroupProps
      const navTabs: PinnableCollapsibleNavGroupProps[] = [];
      navTabList.length !== 0 &&
        navTabList.map((navTab) =>
          navTabs.push({
            // Title configuration
            title: (
              <EuiText size={"xs"} color={"primary"} title={navTab.title}>
                <h5 style={{ textTransform: "uppercase" }}>{navTab.title}</h5>
              </EuiText>
            ),
            iconSize: "m",
            titleSize: "xs",
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
                        size={"xs"}
                        color={"primary"}
                        title={childElement.label}
                      >
                        <h5 style={{ textTransform: "uppercase" }}>
                          {childElement.label}
                        </h5>
                      </EuiText>
                    ),
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
  //state to handle the modal visibility
  const [isModalVisible, setIsModalVisible] = useState(false);
  const navigate = useNavigate();

  // These constants handle the size of nav tabs in the modal, according to the screen size
  const MODAL_TAB_SIZE = useIsWithinBreakpoints(["xs", "s"]) ? 272 : 372;
  const MODAL_NAV_HEADER_SIZE = useIsWithinBreakpoints(["xs", "s"]) ? 280 : 380;

  //functions to set the modal visibility
  const closeModal = () => {
    setIsModalVisible(false);
  };
  const showModal = () => {
    setIsModalVisible(true);
  };

  // temporary react state to see the working of switches inside the modal
  const [checked, setChecked] = useState(false);
  const onChange = (e: EuiSwitchEvent) => {
    setChecked(e.target.checked);
  };

  useEffect(() => {
    try {
      const fetchNavItems = async () => {
        try {
          const navData = await getTabs();
          setNavGroups(navData);
        } catch (error) {
          console.error("Error fetching sidebar navs:", error);
        }
      };
      fetchNavItems().catch((error) => {
        console.error("Error fetching sidebar navs:", error);
      });
    } catch (error) {
      console.error("Error fetching sidebar navs:", error);
    }
  }, []);
  return (
    <>
      <EuiButton onClick={showModal}>Change Sidebar Preferences</EuiButton>
      {/*Displaying the pinned Nav Groups first, however would like to discuss this feature.*/}
      {navGroups.length !== 0 &&
        navGroups.map((navGroup) => {
          //checking if nav group's visibility is set to true by user
          if (navGroup.pinned && navGroup.visible) {
            return (
              <EuiCollapsibleNavGroup
                title={navGroup.title}
                iconSize={navGroup.iconSize}
                titleSize={navGroup.titleSize}
                key={1}
                isCollapsible={true}
                isDisabled={false}
                buttonElement="button"
                initialIsOpen={navGroup.isExpanded}
              >
                {navGroup.children.length !== 0 && (
                  <EuiListGroup>
                    {navGroup.children.map((childElement) => (
                      <EuiListGroupItem
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
      {navGroups.length !== 0 &&
        navGroups.map((navGroup) => {
          if (!navGroup.pinned && navGroup.visible) {
            return (
              <EuiCollapsibleNavGroup
                title={navGroup.title}
                iconSize={navGroup.iconSize}
                titleSize={navGroup.titleSize}
                key={1}
                isCollapsible={true}
                isDisabled={false}
                buttonElement="button"
                initialIsOpen={navGroup.isExpanded}
              >
                {navGroup.children.length !== 0 && (
                  <EuiListGroup>
                    {navGroup.children.map((childElement) => (
                      <EuiListGroupItem
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
          data={navGroups}
          onChange={onChange}
          closeModal={closeModal}
          modalTabSize={MODAL_TAB_SIZE}
          modalNavHeaderSize={MODAL_NAV_HEADER_SIZE}
          checked={checked}
        />
      )}
    </>
  );
}

/**
 * ScopedNavUpdateModal is a React component for customizing the model sidebar.
 *
 * @param {Object} props - Component properties.
 * @param {PinnableCollapsibleNavGroupProps[]} props.data - Array of navigation group data.
 * @param {() => void} props.closeModal - Callback function to close the modal.
 * @param {(e: EuiSwitchEvent) => void} props.onChange - Callback function to handle switch changes.
 * @param {number} props.modalTabSize - Size of the modal tabs.
 * @param {boolean} props.checked - Boolean indicating whether the switch is checked.
 * @param {number} props.modalNavHeaderSize - Size of the modal navigation header.
 * @returns {JSX.Element} - Rendered React element.
 */
const ScopedNavUpdateModal = (props: {
  data: PinnableCollapsibleNavGroupProps[];
  closeModal: () => void;
  onChange: (e: EuiSwitchEvent) => void;
  modalTabSize: number;
  checked: boolean;
  modalNavHeaderSize: number;
}): JSX.Element => (
  <EuiOverlayMask>
    <EuiModal maxWidth={500} onClose={props.closeModal} initialFocus="[name=popswitch]">
      <EuiModalHeader>
        <EuiModalHeaderTitle>Customize Model Sidebar</EuiModalHeaderTitle>
      </EuiModalHeader>
      <EuiModalBody>
        {props.data.map((navGroup) => {
          if (navGroup.children.length !== 0) {
            return (
              <>
                <EuiFlexGrid responsive={false} gutterSize={"s"} columns={4}>
                  <EuiFlexItem style={{ width: props.modalNavHeaderSize }}>
                    <EuiListGroupItem
                      iconType={navGroup.iconType}
                      label={navGroup.title}
                    />
                  </EuiFlexItem>
                  <EuiFlexItem>
                    <EuiSwitch
                      style={{
                        marginTop: 8
                      }}
                      showLabel={false}
                      label={"visibility"}
                      checked={props.checked}
                      onChange={(e) => {
                        props.onChange(e);
                      }}
                      compressed
                    />
                  </EuiFlexItem>
                </EuiFlexGrid>
                <EuiListGroup>
                  {navGroup.children.map((childElement) => (
                    <EuiFlexGrid
                      responsive={false}
                      gutterSize={"s"}
                      columns={4}
                      style={{
                        backgroundColor: "rgb(85 85 85 / 27%)",
                        borderRadius: 5,
                        width: "fit-content",
                      }}
                    >
                      <EuiFlexItem style={{ width: props.modalTabSize }}>
                        <EuiListGroupItem
                          icon={childElement.icon}
                          label={childElement.label}
                          extraAction={{
                            iconType: "pin",
                            alwaysShow: true,
                          }}
                        />
                      </EuiFlexItem>
                      <EuiFlexItem>
                        <EuiSwitch
                          showLabel={false}
                          label={"visibility"}
                          checked={props.checked}
                          onChange={(e) => {
                            props.onChange(e);
                          }}
                          compressed
                          style={{
                            marginTop: 8
                          }}
                        />
                      </EuiFlexItem>
                    </EuiFlexGrid>
                  ))}
                </EuiListGroup>
              </>
            );
          }
          return (
            <EuiFlexGrid responsive={false} gutterSize={"s"} columns={4}>
              <EuiFlexItem style={{ width: props.modalNavHeaderSize }}>
                <EuiListGroupItem
                  iconType={navGroup.iconType}
                  label={navGroup.title}
                />
              </EuiFlexItem>
              <EuiFlexItem>
                <EuiSwitch
                  showLabel={false}
                  label={"visibility"}
                  checked={props.checked}
                  onChange={(e) => {
                    props.onChange(e);
                  }}
                  compressed
                />
              </EuiFlexItem>
            </EuiFlexGrid>
          );
        })}
      </EuiModalBody>

      <EuiModalFooter>
        <EuiButtonEmpty onClick={props.closeModal}>Cancel</EuiButtonEmpty>

        <EuiButton onClick={props.closeModal} fill>
          Save
        </EuiButton>
      </EuiModalFooter>
    </EuiModal>
  </EuiOverlayMask>
);
