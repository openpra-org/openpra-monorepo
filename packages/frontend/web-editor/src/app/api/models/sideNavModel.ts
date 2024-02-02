import {
  EuiCollapsibleNavGroupProps,
  EuiListGroupProps,
  EuiListGroupItemProps,
} from "@elastic/eui";

export type PinnableListGroupItemProps = EuiListGroupItemProps & {
  pinned: boolean;
  visible: boolean;
};

export type PinnableListGroupProps = Omit<EuiListGroupProps, "listItems"> & {
  listItems: PinnableListGroupItemProps[];
};
export type PinnableCollapsibleNavGroupProps = Omit<
  EuiCollapsibleNavGroupProps,
  "children"
> & {
  pinned: boolean;
  visible: boolean;
  children: PinnableListGroupItemProps[];
  isExpanded: boolean;
};

export type sideNavModel = {
  title: string;
  navigateTo: string;
  children: {
    label: string;
    iconType: string;
    pinned: boolean;
    visible: boolean;
    navigateTo: string;
  }[];
  pinned: boolean;
  visible: boolean;
};
