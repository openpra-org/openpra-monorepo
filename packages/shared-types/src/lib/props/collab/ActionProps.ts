import UserProps from "./UserProps";

export enum ACTION_TYPES {
  VIEWED = "v",
  EDITED = "e",
  CREATED = "c",
}

interface ActionProps {
  user: Partial<UserProps>;
  date: string;
  type: ACTION_TYPES;
}
export default ActionProps;
