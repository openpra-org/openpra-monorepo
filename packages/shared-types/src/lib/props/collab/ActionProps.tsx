import UserProps from "./UserProps";

export enum ACTION_TYPES {
    VIEWED = 'v',
    EDITED = 'e',
    CREATED = 'c',
}

export default interface ActionProps {
    user: Partial<UserProps>;
    date: string;
    type: ACTION_TYPES;
}
