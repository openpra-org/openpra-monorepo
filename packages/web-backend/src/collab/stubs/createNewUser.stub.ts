import { MemberRole } from "shared-sdk";
import { CreateNewUserSchemaDto } from "../dtos/createNewUser-schema";

export const CreateUserObject: CreateNewUserSchemaDto = {
  firstName: "User1",
  lastName: "Last1",
  email: "xyz@gmail.com",
  username: "testUser",
  password: "12345678",
  roles: [MemberRole],
};
