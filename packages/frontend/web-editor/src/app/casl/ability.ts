import { AbilityBuilder, createMongoAbility, MongoAbility, RawRuleOf } from "@casl/ability";
import { GetAllRoles } from "shared-types/src/lib/api/roles/rolesApi";
import { PermissionSchemaDto, RoleSchemaDto } from "shared-types/src/openpra-zod-mef/role/role-schema";

type Actions = "create" | "read" | "update" | "delete" | "manage";
type Subjects = "users" | "roles" | "invitation" | "all";
type AppAbility = MongoAbility<[Actions, Subjects]>;

const DefineAbility = (roles: PermissionSchemaDto): MongoAbility<[Actions, Subjects]> => {
  const rules = roles as unknown as RawRuleOf<AppAbility>[];
  return createMongoAbility<AppAbility>(rules);
};

async function UpdateAbility(ability: AppAbility, roles: string[]): Promise<void> {
  const fetchedRoles: RoleSchemaDto[] = await GetAllRoles(roles);
  const extractedRoles: PermissionSchemaDto[] = fetchedRoles.map((fetchedRole: RoleSchemaDto) => {
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
