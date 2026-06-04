import mongoose, { Connection } from "mongoose";
import { MongooseModule, getConnectionToken } from "@nestjs/mongoose";
import { Test, TestingModule } from "@nestjs/testing";
import { MemberResult } from "shared-sdk";
import * as argon2 from "argon2";
import { CollabService } from "./collab.service";
import { User, UserSchema } from "./schemas/user.schema";
import { UserCounter, UserCounterSchema } from "./schemas/user-counter.schema";
import { CreateUserObject } from "./stubs/createNewUser.stub";
describe("CollabService", () => {
  let collabService: CollabService;
  let connection: Connection;
  beforeAll(async () => {
    const mongoUri = process.env.MONGO_URI;
    const module: TestingModule = await Test.createTestingModule({
      imports: [
        MongooseModule.forRoot(mongoUri),
        MongooseModule.forFeature([
          { name: User.name, schema: UserSchema },
          { name: UserCounter.name, schema: UserCounterSchema },
        ]),
      ],
      providers: [CollabService],
    }).compile();
    connection = await module.get(getConnectionToken());
    collabService = module.get<CollabService>(CollabService);
  });
  afterEach(async () => {
    await connection.dropDatabase();
  });
  afterAll(async () => {
    await mongoose.disconnect();
  });
  describe("CollabService", () => {
    it("CollabService should be defined", () => {
      expect(collabService).toBeDefined();
    });
  });
  describe("createNewUser", () => {
    it("should be defined", () => {
      expect(collabService.createNewUser).toBeDefined();
    });
    it("should create user and return object", async () => {
      const response = await collabService.createNewUser({ ...CreateUserObject, roles: [] });
      expect(response).toBeDefined();
    });
    it("should fail on duplicate username", async () => {
      const response = await collabService.createNewUser(CreateUserObject);
      expect(response).toBeDefined();
      try {
        await collabService.createNewUser({ ...CreateUserObject, roles: [] });
      } catch (err) {
        expect(err).toBeInstanceOf(Error);
      }
    });
  });
  describe("loginUser", () => {
    it("should be defined", () => {
      expect(collabService.loginUser).toBeDefined();
    });
    it("should return null if user does not exist", async () => {
      const username = "randomUserXYZ";
      const result = await collabService.loginUser(username);
      expect(result).toBeNull();
    });
    it("should return user document if user logged in successfully", async () => {
      await collabService.createNewUser({ ...CreateUserObject, roles: [] });
      const result = await collabService.loginUser(CreateUserObject.username);
      expect(result).toBeDefined();
    });
  });
  describe("getUserPreferences", () => {
    it("should be defined", () => {
      expect(collabService.getUserPreferences).toBeDefined();
    });
    it("should return user preferences", async () => {
      const response = await collabService.createNewUser({ ...CreateUserObject, roles: [] });
      if (typeof response !== "string") {
        const returnedValue = await collabService.getUserPreferences(String(response.id));
        expect(returnedValue).toBeDefined();
      }
    });
  });
  describe("getUserById", () => {
    it("should be defined", (): void => {
      expect(collabService.getUserById).toBeDefined();
    });
    it("should return a single user", async (): Promise<void> => {
      for (let i = 0; i < 30; i++) {
        const userObject = {
          firstName: "User" + String(i),
          lastName: "Last" + String(i),
          email: "xyz@gmail" + String(i) + ".com",
          username: "testUser" + String(i),
          password: "12345678",
        };
        await collabService.createNewUser(userObject);
      }
      const user: User = await collabService.getUserById("1");
      expect(user).not.toBeNull();
      expect(user.id).toEqual(1);
      expect(user.email).toEqual("xyz@gmail0.com");
      expect(user.firstName).toEqual("User0");
      expect(user.lastName).toEqual("Last0");
    });
  });
  describe("updateUserPreferences", () => {
    it("should be defined", () => {
      expect(collabService.updateUserPreferences).toBeDefined();
    });
    it("should update user preferences - theme", async () => {
      const userPreferenceObject = { preferences: { theme: "Dark" } };
      const response = await collabService.createNewUser(CreateUserObject);
      if (typeof response !== "string") {
        const returnedValue = await collabService.updateUserPreferences(String(response.id), userPreferenceObject);
        expect(returnedValue).toBeDefined();
        expect(returnedValue.preferences.theme).toMatch("Dark");
      }
    });
    it("should update user preferences - nodeIdsVisible", async () => {
      const userPreferenceObject = {
        preferences: { nodeIdsVisible: false },
      };
      const response = await collabService.createNewUser(CreateUserObject);
      if (typeof response !== "string") {
        const returnedValue = await collabService.updateUserPreferences(String(response.id), userPreferenceObject);
        expect(returnedValue.preferences.nodeIdsVisible).toBeFalsy();
      }
    });
    it("should update user preferences - outlineVisible", async () => {
      const userPreferenceObject = {
        preferences: { outlineVisible: false },
      };
      const response = await collabService.createNewUser(CreateUserObject);
      if (typeof response !== "string") {
        const returnedValue = await collabService.updateUserPreferences(String(response.id), userPreferenceObject);
        expect(returnedValue.preferences.outlineVisible).toBeFalsy();
      }
    });
  });
  describe("updateLastLogin", () => {
    it("should be defined", () => {
      expect(collabService.updateLastLogin).toBeDefined();
    });
    it("should update last login", async () => {
      const response = await collabService.createNewUser(CreateUserObject);
      const dateBefore = Date.now();
      if (typeof response !== "string") {
        await collabService.updateLastLogin(response.id);
        const returnedValue = await collabService.loginUser(CreateUserObject.username);
        const dateNumber = returnedValue.last_login.getTime();
        expect(dateNumber).toBeGreaterThanOrEqual(dateBefore);
      }
    });
  });
  describe("updateUser", (): void => {
    it("should update user", async () => {
      const emailChange = "hellotestchangeemail@gmail.com";
      const firstNameChange = "FirstName";
      const passwordChange = "newPassword";
      const users = connection.collection("users");
      const member: MemberResult = {
        account_created: "",
        last_login: "",
        preferences: undefined,
        recently_accessed: undefined,
        roles: [],
        firstName: "Test",
        lastName: "String",
        username: "TestString",
        email: "TestString@gmail.com",
        id: 786,
        password: "password",
      };
      const user = new User();
      user.email = member.email;
      user.firstName = member.firstName;
      user.lastName = member.lastName;
      user.username = member.username;
      user.id = member.id;
      user.password = await argon2.hash(member.password);
      await users.insertOne(user);
      member.email = emailChange;
      member.firstName = firstNameChange;
      member.password = passwordChange;
      await collabService.updateUser(member);
      const foundUser: User = await users.findOne<User>({ id: 786 });
      expect(await argon2.verify(foundUser.password, passwordChange)).toEqual(true);
      expect(foundUser.email).toEqual(emailChange);
      expect(foundUser.firstName).toEqual(firstNameChange);
    });
  });
  describe("getUsersList", () => {
    it("should be defined", () => {
      expect(collabService.getUsersList).toBeDefined();
    });
    it("should return empty list if no users in database", async () => {
      const url = "?limit=0&offset=0";
      const returnedValue = await collabService.getUsersList(url);
      expect(returnedValue).toBeDefined();
      expect(returnedValue.count).toBe(0);
      expect(returnedValue.results.length).toBe(0);
    });
    it("should return first page of users with limit 10 and offset 0 if 30 users exist", async () => {
      for (let i = 0; i < 30; i++) {
        const userObject = {
          firstName: "User" + String(i),
          lastName: "Last" + String(i),
          email: "xyz@gmail" + String(i) + ".com",
          username: "testUser" + String(i),
          password: "12345678",
        };
        await collabService.createNewUser(userObject);
      }
      const url = "?limit=10&offset=0";
      const returnedValue = await collabService.getUsersList(url);
      expect(returnedValue).toBeDefined();
      expect(returnedValue.count).toBe(30);
      expect(returnedValue.results.length).toBe(10);
      const results = returnedValue.results as Array<{
        username: string;
      }>;
      for (let i = 0; i < 10; i++) {
        expect(results[i].username).toMatch("testUser" + String(i));
      }
      expect(returnedValue.next).toMatch("?limit=10&offset=10");
    }, 30000);
    it("should return middle page of users with limit 10 and offset 10", async () => {
      for (let i = 0; i < 30; i++) {
        const userObject = {
          firstName: "User" + String(i),
          lastName: "Last" + String(i),
          email: "xyz@gmail" + String(i) + ".com",
          username: "testUser" + String(i),
          password: "12345678",
        };
        await collabService.createNewUser(userObject);
      }
      const url = "limit=10&offset=10";
      const returnedValue = await collabService.getUsersList(url, 10, 10);
      expect(returnedValue).toBeDefined();
      expect(returnedValue.count).toBe(30);
      expect(returnedValue.results.length).toBe(10);
      const resultsMid = returnedValue.results as Array<{
        username: string;
      }>;
      for (let i = 0; i < 10; i++) {
        expect(resultsMid[i].username).toMatch("testUser" + String(i + 10));
      }
      expect(returnedValue.next).toMatch("limit=10&offset=20");
      expect(returnedValue.previous).toMatch("limit=10&offset=0");
    }, 30000);
    it("should return last page of users with limit 10 and offset 20 if 30 users in database", async () => {
      for (let i = 0; i < 30; i++) {
        const userObject = {
          firstName: "User" + String(i),
          lastName: "Last" + String(i),
          email: "xyz@gmail" + String(i) + ".com",
          username: "testUser" + String(i),
          password: "12345678",
        };
        await collabService.createNewUser(userObject);
      }
      const url = "limit=10&offset=20";
      const returnedValue = await collabService.getUsersList(url, 10, 20);
      expect(returnedValue).toBeDefined();
      expect(returnedValue.count).toBe(30);
      expect(returnedValue.results.length).toBe(10);
      const resultsLast = returnedValue.results as Array<{
        username: string;
      }>;
      for (let i = 0; i < 10; i++) {
        expect(resultsLast[i].username).toMatch("testUser" + String(i + 20));
      }
      expect(returnedValue.next).toBeNull();
      expect(returnedValue.previous).toMatch("limit=10&offset=10");
    }, 30000);
    it("should return all users when limit greater than number of users in database", async () => {
      for (let i = 0; i < 3; i++) {
        const user_object = {
          firstName: "User" + String(i),
          lastName: "Last" + String(i),
          email: "xyz@gmail" + String(i) + ".com",
          username: "testUser" + String(i),
          password: "12345678",
        };
        await collabService.createNewUser(user_object);
      }
      const url = "limit=10&offset=0";
      const returnedValue = await collabService.getUsersList(url, 10, 0);
      expect(returnedValue).toBeDefined();
      expect(returnedValue.count).toBe(3);
      expect(returnedValue.results.length).toBe(3);
      const resultsAll = returnedValue.results as Array<{
        username: string;
      }>;
      for (let i = 0; i < 3; i++) {
        expect(resultsAll[i].username).toMatch("testUser" + String(i));
      }
      expect(returnedValue.next).toBeNull();
      expect(returnedValue.previous).toBeNull();
    }, 30000);
    it("should return empty list when offset greater than number of users in database", async () => {
      for (let i = 0; i < 3; i++) {
        const userObject = {
          firstName: "User" + String(i),
          lastName: "Last" + String(i),
          email: "xyz@gmail" + String(i) + ".com",
          username: "testUser" + String(i),
          password: "12345678",
        };
        await collabService.createNewUser(userObject);
      }
      const url = "limit=10&offset=100";
      const returnedValue = await collabService.getUsersList(url, 10, 100);
      expect(returnedValue).toBeDefined();
      expect(returnedValue.count).toBe(3);
      expect(returnedValue.results.length).toBe(0);
      expect(returnedValue.next).toBeNull();
      expect(returnedValue.previous).toBeNull();
    }, 30000);
  });
  describe("isValidUsername", () => {
    const userObject: User = {
      id: 1,
      firstName: "User1",
      lastName: "Last1",
      email: "xyz@gmail.com",
      username: "testUser",
      password: "12345678",
      preferences: {
        theme: "string",
        pageBreaksVisible: false,
        nodeDescriptionEnabled: false,
        outlineVisible: false,
        nodeIdsVisible: false,
        node_value_visible: false,
        quantificationConfigurations: {
          configurations: {},
          currentlySelected: "yes",
        },
      },
      recently_accessed: {
        models: [],
        projects: [],
        subsystems: [],
      },
      last_login: new Date(Date.now()),
      roles: [],
    };
    it("invalid username", async () => {
      const users = connection.collection<User>("users");
      await users.insertOne(userObject);
      const result = await collabService.isEmailValid("xyz@gmail.com");
      expect(result).toBe(false);
    });
    it("valid username", async () => {
      const users = connection.collection<User>("users");
      await users.insertOne(userObject);
      const result = await collabService.isEmailValid("xyz123@gmail.com");
      expect(result).toBe(true);
    });
  });
  describe("Valid/Invalid Emails", () => {
    const userObject: User = {
      id: 1,
      firstName: "User1",
      lastName: "Last1",
      email: "xyz@gmail.com",
      username: "testUser",
      password: "12345678",
      preferences: {
        theme: "string",
        pageBreaksVisible: false,
        nodeDescriptionEnabled: false,
        outlineVisible: false,
        nodeIdsVisible: false,
        node_value_visible: false,
        quantificationConfigurations: {
          configurations: {},
          currentlySelected: "yes",
        },
      },
      recently_accessed: {
        models: [],
        projects: [],
        subsystems: [],
      },
      last_login: new Date(Date.now()),
      roles: [],
    };
    it("invalid email", async () => {
      const users = connection.collection<User>("users");
      await users.insertOne(userObject);
      const result = await collabService.isUsernameValid("testUser");
      expect(result).toBe(false);
    });
    it("valid email", async () => {
      const users = connection.collection<User>("users");
      await users.insertOne(userObject);
      const result = await collabService.isUsernameValid("testUser123");
      expect(result).toBe(true);
    });
  });
});
