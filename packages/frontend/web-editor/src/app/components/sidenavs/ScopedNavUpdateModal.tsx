import { EuiSwitchEvent } from "@elastic/eui/src/components/form/switch/switch";
import {
  EuiButton,
  EuiButtonEmpty,
  EuiFlexGrid,
  EuiFlexItem,
  EuiListGroup,
  EuiListGroupItem,
  EuiModal,
  EuiModalBody,
  EuiModalFooter,
  EuiModalHeader,
  EuiModalHeaderTitle,
  EuiOverlayMask,
  EuiSwitch,
  useIsWithinBreakpoints,
} from "@elastic/eui";
import { useState } from "react";
import { PinnableCollapsibleNavGroupProps } from "../../api/models/sideNavModel";
import { css } from "@emotion/react";
import { euiBackgroundColor } from "@elastic/eui/src/global_styling/mixins/_color";

export const ScopedNavUpdateModal = (props: {
  data: PinnableCollapsibleNavGroupProps[];
  closeModal: (navGroups: PinnableCollapsibleNavGroupProps[]) => void;
}): JSX.Element => {
  const [navGroups, setNavGroups] = useState<
    PinnableCollapsibleNavGroupProps[]
  >(props.data);

  // These constants handle the size of nav tabs in the modal, according to the screen size
  const MODAL_TAB_SIZE = useIsWithinBreakpoints(["xs", "s"]) ? 272 : 372;
  const MODAL_NAV_HEADER_SIZE = useIsWithinBreakpoints(["xs", "s"]) ? 280 : 380;

  /**
   * Updates the visibility of a parent navigation group based on the switch event.
   * @param e - The switch event that triggered the visibility change.
   * @param id - The unique identifier of the navigation group.
   * @returns void
   */
  const onChangeParentVisibility = (e: EuiSwitchEvent, id: string) => {
    const newNavGroups = navGroups.map((navGroup) => {
      if (navGroup.id === id) {
        return {
          ...navGroup,
          visible: e.target.checked,
        };
      } else {
        return navGroup;
      }
    });
    setNavGroups(newNavGroups);
  };

  // const onChangeParentPinnability = (id: string) => {
  //   const newNavGroups = navGroups.map((navGroup) => {
  //     if (navGroup.id === id) {
  //       return {
  //         ...navGroup,
  //         pinned: !navGroup.pinned,
  //       };
  //     } else {
  //       return navGroup;
  //     }
  //   });
  //   setNavGroups(newNavGroups);
  // };

  /**
   * Handles the change in pinnability of a child element within a navigation group.
   * @param {string} parentId - The ID of the parent navigation group.
   * @param {string} childId - The ID of the child element whose pinnability is being changed.
   * @returns {void}
   */
  const onChangeChildPinnability = (
    parentId: string,
    childId: string,
  ): void => {
    const newNavGroups = navGroups.map((navGroup) => {
      if (navGroup.id === parentId) {
        return {
          ...navGroup,
          children: navGroup.children.map((childElement) => {
            if (childElement.id === childId) {
              return {
                ...childElement,
                pinned: !childElement.pinned,
              };
            } else {
              return {
                ...childElement,
              };
            }
          }),
        };
      } else {
        return navGroup;
      }
    });
    setNavGroups(newNavGroups);
  };

  /**
   * Handles the visibility change of a child element within a collapsible navigation group.
   * @param e - The event object triggered by the visibility change.
   * @param parentId - The ID of the parent navigation group.
   * @param childId - The ID of the child element whose visibility is being toggled.
   * @returns void
   */
  const onChangeChildVisibility = (
    e: EuiSwitchEvent,
    parentId: string,
    childId: string,
  ) => {
    const newNavGroups = navGroups.map((navGroup) => {
      if (navGroup.id === parentId) {
        return {
          ...navGroup,
          children: navGroup.children.map((childElement) => {
            if (childElement.id === childId) {
              return {
                ...childElement,
                visible: e.target.checked,
              };
            } else {
              return {
                ...childElement,
              };
            }
          }),
        };
      } else {
        return navGroup;
      }
    });
    setNavGroups(newNavGroups);
  };

  return (
    <EuiOverlayMask>
      <EuiModal
        maxWidth={500}
        onClose={() => {
          props.closeModal(navGroups);
        }}
        initialFocus="[name=popswitch]"
      >
        <EuiModalHeader>
          <EuiModalHeaderTitle>Customize Model Sidebar</EuiModalHeaderTitle>
        </EuiModalHeader>
        <EuiModalBody>
          {navGroups.map((navGroup) => {
            if (navGroup.children.length !== 0) {
              return (
                <>
                  <EuiFlexGrid responsive={false} gutterSize={"s"} columns={4}>
                    <EuiFlexItem style={{ width: MODAL_NAV_HEADER_SIZE }}>
                      <EuiListGroupItem
                        key={navGroup.id}
                        iconType={navGroup.iconType}
                        label={navGroup.title}
                      />
                    </EuiFlexItem>
                    <EuiFlexItem>
                      <EuiSwitch
                        style={{
                          marginTop: 8,
                        }}
                        id={navGroup.id}
                        showLabel={false}
                        label={"visibility"}
                        checked={navGroup.visible}
                        onChange={(e) => {
                          onChangeParentVisibility(e, navGroup.id);
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
                        <EuiFlexItem style={{ width: MODAL_TAB_SIZE }}>
                          <EuiListGroupItem
                            key={childElement.id}
                            icon={childElement.icon}
                            label={childElement.label}
                            extraAction={{
                              iconType: childElement.pinned
                                ? "pinFilled"
                                : "pin",
                              alwaysShow: true,
                              onClick: (): void => {
                                onChangeChildPinnability(
                                  navGroup.id,
                                  childElement.id,
                                );
                              },
                              "aria-label": childElement.id,
                              "aria-labelledby": childElement.id,
                            }}
                          />
                        </EuiFlexItem>
                        <EuiFlexItem>
                          <EuiSwitch
                            showLabel={false}
                            label={"visibility"}
                            checked={childElement.visible}
                            onChange={(e) => {
                              onChangeChildVisibility(
                                e,
                                navGroup.id,
                                childElement.id,
                              );
                            }}
                            compressed
                            style={{
                              marginTop: 8,
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
                <EuiFlexItem style={{ width: MODAL_NAV_HEADER_SIZE }}>
                  <EuiListGroupItem
                    key={navGroup.id}
                    iconType={navGroup.iconType}
                    label={navGroup.title}
                  />
                </EuiFlexItem>
                <EuiFlexItem>
                  <EuiSwitch
                    showLabel={false}
                    label={"visibility"}
                    checked={navGroup.visible}
                    onChange={(e) => {
                      onChangeParentVisibility(e, navGroup.id);
                    }}
                    compressed
                  />
                </EuiFlexItem>
              </EuiFlexGrid>
            );
          })}
        </EuiModalBody>

        <EuiModalFooter>
          <EuiButtonEmpty
            onClick={() => {
              props.closeModal(navGroups);
            }}
          >
            Cancel
          </EuiButtonEmpty>

          <EuiButton
            onClick={() => {
              props.closeModal(navGroups);
            }}
            fill
          >
            Save
          </EuiButton>
        </EuiModalFooter>
      </EuiModal>
    </EuiOverlayMask>
  );
};
