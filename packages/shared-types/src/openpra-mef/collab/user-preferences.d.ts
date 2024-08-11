import typia from "typia";

export interface UserPreferences {
  preferences: {
    theme?: string;
    nodeIdsVisible?: string | boolean;
    outlineVisible?: string | boolean;
    nodeDescriptionEnabled?: string | boolean;
    node_value_visible?: string | boolean;
    pageBreaksVisible?: string | boolean;
  };
}
export const UserPreferencesSchema = typia.json.application<[UserPreferences], "3.0">();
