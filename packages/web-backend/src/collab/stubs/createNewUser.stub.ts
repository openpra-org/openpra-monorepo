import { CreateNewUserSchemaDto } from "shared-types/src/openpra-zod-mef/collab/createNewUser-schema";
import { MemberRole } from "shared-types/src/lib/data/predefiniedRoles";

export const CreateUserObject: CreateNewUserSchemaDto = {
  firstName: "User1",
  lastName: "Last1",
  email: "xyz@gmail.com",
  username: "testUser",
  password: "12345678",
  roles: [MemberRole],
};
