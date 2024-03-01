export type Members = {
  count: number;
  next: any;
  previous: any;
  results: MemberResult[];
};

export type MemberResult = {
  firstName: string;
  lastName: string;
  username: string;
  email: string;
  permissions: Permissions;
  id: number;
  recently_accessed: RecentlyAccessed;
  preferences: Preferences;
  account_created: string;
  last_login: string;
};

type Permissions = {};

type RecentlyAccessed = {
  models: any[];
  subsystems: any[];
  projects: any[];
};

type Preferences = {
  theme: string;
  nodeIdsVisible: boolean;
  outlineVisible: boolean;
  node_value_visible: boolean;
  nodeDescriptionEnabled: boolean;
  pageBreaksVisible: boolean;
  quantificationConfigurations: QuantificationConfigurations;
};

type QuantificationConfigurations = {
  configurations: Configurations;
  currentlySelected: string;
};

type Configurations = {};
