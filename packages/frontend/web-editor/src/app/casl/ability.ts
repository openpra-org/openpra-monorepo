import {
  AbilityBuilder,
  createMongoAbility,
  MongoAbility,
  RawRuleOf,
} from '@casl/ability';
import type { PermissionDto as Role } from 'shared-types';
import { GetAllRoles } from 'shared-sdk/lib/api/roles/rolesApi';

type Actions = 'create' | 'read' | 'update' | 'delete' | 'manage';
type Subjects = 'users' | 'roles' | 'invitation' | 'all';
type AppAbility = MongoAbility<[Actions, Subjects]>;

/**
 * Defines the ability (permissions) for a given set of roles.
 *
 * @param roles - An array of `Role` objects that define the permissions for the user.
 * @returns A `MongoAbility` instance that represents the user's permissions.
 *
 * This function converts the provided roles into a format that can be used by CASL's `MongoAbility`.
 * It uses the `createMongoAbility` function to create an ability instance based on the provided roles.
 */
const DefineAbility = (roles: Role[]): MongoAbility<[Actions, Subjects]> => {
  const rules = roles as unknown as RawRuleOf<AppAbility>[];
  return createMongoAbility<AppAbility>(rules);
};

/**
 * Updates the existing ability with new roles.
 *
 * @param ability - The current `AppAbility` instance that needs to be updated.
 * @param roles - An array of role names (strings) that will be used to fetch the updated permissions.
 * @returns A promise that resolves when the ability has been updated.
 *
 * This function fetches the latest roles from the API using `GetAllRoles`, extracts the permissions,
 * and updates the provided `AppAbility` instance with the new rules.
 */
async function UpdateAbility(
  ability: AppAbility,
  roles: string[],
): Promise<void> {
  const fetchedRoles = await GetAllRoles(roles);
  const extractedRoles = fetchedRoles.map((fetchedRole) => {
    return fetchedRole.permissions;
  });
  const { rules } = DefineAbility(extractedRoles.flat());
  ability.update(rules);
}

/**
 * Creates a default ability with basic permissions.
 *
 * @returns A `MongoAbility` instance with default permissions.
 *
 * This function creates a default ability where the user is allowed to "read" all subjects.
 * It uses the `AbilityBuilder` to define the default rules and then builds the ability.
 */
const DefaultAbility = (): MongoAbility<[Actions, Subjects]> => {
  const { can, build } = new AbilityBuilder<AppAbility>(createMongoAbility);
  can('read', 'all');
  return build();
};

export {
  DefineAbility,
  Actions,
  Subjects,
  AppAbility,
  DefaultAbility,
  UpdateAbility,
};
