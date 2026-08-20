import { AbilityBuilder, createMongoAbility, MongoAbility } from "@casl/ability";

type Actions = "create" | "read" | "update" | "delete" | "manage";
type Subjects = "users" | "roles" | "invitation" | "all";
type AppRole = MongoAbility<[Actions, Subjects]>;

function UpdateRole(role: AppRole, roleNames: string[]): void {
  const { can, rules } = new AbilityBuilder<AppRole>(createMongoAbility);
  if (roleNames.includes("admin-role")) {
    can("manage", "all");
  } else {
    can("read", "all");
  }
  role.update(rules);
}

const DefaultRole = (): AppRole => {
  const { can, build } = new AbilityBuilder<AppRole>(createMongoAbility);
  can("read", "all");
  return build();
};

export { UpdateRole, DefaultRole };
export type { Actions, Subjects, AppRole };
