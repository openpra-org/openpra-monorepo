declare const AdminRole = "admin-role";
declare const MemberRole = "member-role";
declare const CollabRole = "collab-role";
interface Role {
    id: string;
    name: string;
    permissions: Permission[];
}
interface Permission {
    action: string | string[];
    subject: string | string[];
    fields?: any;
    conditionals?: any;
    inverted?: boolean;
    reason?: string;
}
declare const PredefinedRoles: Role[];
export { PredefinedRoles, AdminRole, CollabRole, MemberRole };
