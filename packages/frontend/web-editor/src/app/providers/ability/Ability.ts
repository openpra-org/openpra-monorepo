import { AbilityBuilder, createMongoAbility, MongoAbility, RawRuleOf } from "@casl/ability";
import { Role } from "shared-types/src/openpra-mef/role/role-type";
import { GetAllRoles } from "shared-types/src/lib/api/roles/rolesApi";

type Actions = "create" | "read" | "update" | "delete" | "manage";
type Subjects = "users" | "roles" | "invitation" | "all";
type AppAbility = MongoAbility<[Actions, Subjects]>;

/**
 * Defines the user's abilities based on their roles.
 * @param roles - Array of roles assigned to the user.
 * @returns A `MongoAbility` instance configured with the given roles.
 */
const DefineAbility = (roles: Role[]): MongoAbility<[Actions, Subjects]> => {
  const rules = roles as unknown as RawRuleOf<AppAbility>[];
  return createMongoAbility<AppAbility>(rules);
};

/**
 * Updates the provided ability instance with new roles.
 * @param ability - The `MongoAbility` instance to update.
 * @param roles - Array of role identifiers to fetch and update the ability with.
 */
async function UpdateAbility(ability: AppAbility, roles: string[]): Promise<void> {
  const fetchedRoles = await GetAllRoles(roles);
  const extractedRoles = fetchedRoles.map((fetchedRole) => {
    return fetchedRole.permissions;
  });
  const { rules } = DefineAbility(extractedRoles.flat());
  ability.update(rules);
}

/**
 * Creates a default `MongoAbility` instance with minimal permissions.
 * @returns A `MongoAbility` instance with default permissions.
 */
const DefaultAbility = (): MongoAbility<[Actions, Subjects]> => {
  const { can, build } = new AbilityBuilder<AppAbility>(createMongoAbility);
  can("read", "all");
  return build();
};

export { DefineAbility, Actions, Subjects, AppAbility, DefaultAbility, UpdateAbility };
