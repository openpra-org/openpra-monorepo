export interface Members {
  count: number;
  next: any;
  previous: any;
  results: MemberResult[];
}

export interface MemberResult {
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
  password: string | undefined;
}

interface Permissions {}

interface RecentlyAccessed {
  models: any[];
  subsystems: any[];
  projects: any[];
}

interface Preferences {
  theme: string;
  nodeIdsVisible: boolean;
  outlineVisible: boolean;
  node_value_visible: boolean;
  nodeDescriptionEnabled: boolean;
  pageBreaksVisible: boolean;
  quantificationConfigurations: QuantificationConfigurations;
}

interface QuantificationConfigurations {
  configurations: Configurations;
  currentlySelected: string;
}

interface Configurations {}
