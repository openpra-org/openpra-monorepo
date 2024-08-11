import { MemberRole } from "shared-types/src/lib/data/predefiniedRoles";
import { NewUser } from "shared-types/src/openpra-mef/collab/new-user";

export const CreateUserObject: NewUser = {
  firstName: "User1",
  lastName: "Last1",
  email: "xyz@gmail.com",
  username: "testUser",
  password: "12345678",
  roles: [MemberRole],
};
