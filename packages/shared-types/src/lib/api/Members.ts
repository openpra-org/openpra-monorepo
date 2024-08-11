export interface Members {
  count: number;
  next: string;
  previous: string;
  results: MemberResult[];
}

export interface MemberResult {
  firstName: string;
  lastName: string;
  username: string;
  email: string;
  roles: string[];
  id: number;
  recently_accessed?: RecentlyAccessed;
  preferences?: Preferences;
  account_created: string;
  last_login: string;
  password: string | undefined;
}

interface RecentlyAccessed {
  /* eslint-disable @typescript-eslint/no-explicit-any */
  models: any[];
  subsystems: any[];
  projects: any[];
  /* eslint-disable @typescript-eslint/no-explicit-any */
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
  currentlySelected: string;
}
