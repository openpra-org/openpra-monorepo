import {
  EuiCollapsibleNavGroupProps,
  EuiListGroupProps,
  EuiListGroupItemProps,
} from "@elastic/eui";
import { EuiSwitchEvent } from "@elastic/eui/src/components/form/switch/switch";
import React from "react";

export type PinnableListGroupItemProps = EuiListGroupItemProps & {
  pinned: boolean;
  visible: boolean;
  id: string;
};

// export type PinnableListGroupProps = Omit<EuiListGroupProps, "listItems"> & {
//   listItems: PinnableListGroupItemProps[];
// };
export type PinnableCollapsibleNavGroupProps = Omit<
  EuiCollapsibleNavGroupProps,
  "children"
> & {
  id: string;
  pinned: boolean;
  visible: boolean;
  children: PinnableListGroupItemProps[];
  isExpanded: boolean;
};

export type sideNavModel = {
  title: string;
  navigateTo: string;
  children: {
    id: string;
    label: string;
    iconType: string;
    pinned: boolean;
    visible: boolean;
    navigateTo: string;
  }[];
  pinned: boolean;
  visible: boolean;
};
