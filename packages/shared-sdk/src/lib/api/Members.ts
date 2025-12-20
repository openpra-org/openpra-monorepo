/** Paginated list response for member directory queries. */
export interface Members {
  count: number;
  next: any;
  previous: any;
  results: MemberResult[];
}

/** Shape of a single member record returned by the backend. */
export interface MemberResult {
  firstName: string;
  lastName: string;
  username: string;
  email: string;
  roles: string[];
  id: number;
  recently_accessed: RecentlyAccessed;
  preferences: Preferences;
  account_created: string;
  last_login: string;
  password: string | undefined;
}

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

// Allow a free-form configuration object; use Record to avoid empty interface
type Configurations = Record<string, unknown>;
