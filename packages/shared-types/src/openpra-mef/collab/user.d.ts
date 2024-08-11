import typia from "typia";

/* These 4 interfaces have been removed
 * export interface Instances {}
 * export interface Subsystems {}
 * export interface Projects {}
 * export interface Configurations {}
 * */

export interface Models {
  id?: number;
  creator?: number;
  title?: string;
  description?: string;
  assigned_users?: number[];
  date_created?: Date;
  date_modified?: Date;
  type?: string;
  path?: string;
  actions?: Action[];
}
export const ModelsSchema = typia.json.application<[Models], "3.0">();

export interface RecentlyAccessed {
  models?: Models[];
}
export const RecentlyAccessedSchema = typia.json.application<[RecentlyAccessed], "3.0">();

export interface QuantificationConfigurations {
  currentlySelected?: string;
}
export const QuantificationConfigurationsSchema = typia.json.application<[QuantificationConfigurations], "3.0">();

export interface Preferences {
  theme?: string;
  nodeIdsVisible?: boolean | string;
  outlineVisible?: boolean | string;
  node_value_visible?: boolean | string;
  nodeDescriptionEnabled?: boolean | string;
  pageBreaksVisible?: boolean | string;
  quantificationConfigurations?: QuantificationConfigurations;
}
export const PreferencesSchema = typia.json.application<[Preferences], "3.0">();

export interface UserType {
  id: number;
  firstName: string;
  lastName: string;
  username: string;
  email: string;
  password: string;
  recently_accessed?: RecentlyAccessed;
  preferences?: Preferences;
  roles: string[];
  last_login: Date;
}
export const UserSchema = typia.json.application<[UserType], "3.0">();
