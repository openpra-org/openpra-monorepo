import { AbilityBuilder, createMongoAbility, MongoAbility, RawRuleOf } from "@casl/ability";
import type { PermissionDto as Role } from "shared-types";
import { GetAllRoles } from "shared-sdk/lib/api/roles/rolesApi";
type Actions = "create" | "read" | "update" | "delete" | "manage";
type Subjects = "users" | "roles" | "invitation" | "all";
type AppAbility = MongoAbility<[Actions, Subjects]>;
const DefineAbility = (roles: Role[]): MongoAbility<[Actions, Subjects]> => {
  const rules = roles as unknown as RawRuleOf<AppAbility>[];
  return createMongoAbility<AppAbility>(rules);
};
async function UpdateAbility(ability: AppAbility, roles: string[]): Promise<void> {
  const fetchedRoles = await GetAllRoles(roles);
  const extractedRoles = fetchedRoles.map((fetchedRole) => {
    return fetchedRole.permissions;
  });
  const { rules } = DefineAbility(extractedRoles.flat());
  ability.update(rules);
}
const DefaultAbility = (): MongoAbility<[Actions, Subjects]> => {
  const { can, build } = new AbilityBuilder<AppAbility>(createMongoAbility);
  can("read", "all");
  return build();
};
export { DefineAbility, Actions, Subjects, AppAbility, DefaultAbility, UpdateAbility };
