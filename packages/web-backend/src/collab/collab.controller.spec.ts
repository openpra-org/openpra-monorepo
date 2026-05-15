import mongoose, { Connection } from "mongoose";
import { MongooseModule, getConnectionToken } from "@nestjs/mongoose";
import { Test, TestingModule } from "@nestjs/testing";
import { CollabService } from "./collab.service";
import { CollabController } from "./collab.controller";
import { User, UserSchema } from "./schemas/user.schema";
import { UserCounter, UserCounterSchema } from "./schemas/user-counter.schema";
describe("CollabController", () => {
  let collabService: CollabService;
  let collabController: CollabController;
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
      controllers: [CollabController],
    }).compile();
    connection = await module.get(getConnectionToken());
    collabService = module.get<CollabService>(CollabService);
    collabController = module.get<CollabController>(CollabController);
  });
  afterEach(async () => {
    await connection.dropDatabase();
  });
  afterAll(async () => {
    await mongoose.disconnect();
  });
  describe("CollabController", () => {
    it("CollabController should be defined", async () => {
      expect(collabController).toBeDefined();
    });
  });
  describe("createNewUser", () => {
    it("should be defined", () => {
      expect(collabController.createNewUser).toBeDefined();
    });
    it("should create a user", async () => {
      const user_object: import("./dtos/createNewUser-schema").CreateNewUserSchemaDto = {
        firstName: "User1",
        lastName: "Last1",
        email: "xyz@gmail.com",
        username: "testUser",
        password: "12345678",
        roles: [],
      };
      const response = await collabController.createNewUser(user_object);
      expect(response).toBeDefined();
    });
  });
  describe("getUserPreferences", () => {
    it("should be defined", () => {
      expect(collabController.getUserPreferences).toBeDefined();
    });
    it("should return user preferences", async () => {
      const user_object: import("./dtos/createNewUser-schema").CreateNewUserSchemaDto = {
        firstName: "User1",
        lastName: "Last1",
        email: "xyz@gmail.com",
        username: "testUser",
        password: "12345678",
        roles: [],
      };
      await collabService.createNewUser(user_object);
      const created = await collabService.loginUser(user_object.username);
      const userId = String(created?.id ?? "");
      const result = await collabController.getUserPreferences(userId);
      expect(result).toBeDefined();
    });
  });
  describe("updateUserPreferences", () => {
    it("should be defined", () => {
      expect(collabController.updateUserPreferences).toBeDefined();
    });
    it("should update user preferences - theme", async () => {
      const user_object: import("./dtos/createNewUser-schema").CreateNewUserSchemaDto = {
        firstName: "User1",
        lastName: "Last1",
        email: "xyz@gmail.com",
        username: "testUser",
        password: "12345678",
        roles: [],
      };
      const userPreferenceObject: import("./dtos/user-preferences.dto").UserPreferencesDto = {
        preferences: { theme: "Dark" },
      } as unknown as import("./dtos/user-preferences.dto").UserPreferencesDto;
      await collabService.createNewUser(user_object);
      const created1 = await collabService.loginUser(user_object.username);
      const userId = String(created1?.id ?? "");
      const result = await collabController.updateUserPreferences(userId, userPreferenceObject);
      expect(result.preferences.theme).toMatch("Dark");
    });
    it("should update user preferences - nodeIdsVisible", async () => {
      const user_object: import("./dtos/createNewUser-schema").CreateNewUserSchemaDto = {
        firstName: "User1",
        lastName: "Last1",
        email: "xyz@gmail.com",
        username: "testUser",
        password: "12345678",
        roles: [],
      };
      const userPreferenceObject: import("./dtos/user-preferences.dto").UserPreferencesDto = {
        preferences: { nodeIdsVisible: false },
      } as unknown as import("./dtos/user-preferences.dto").UserPreferencesDto;
      await collabService.createNewUser(user_object);
      const created2 = await collabService.loginUser(user_object.username);
      const userId = String(created2?.id ?? "");
      const result = await collabController.updateUserPreferences(userId, userPreferenceObject);
      expect(result.preferences.nodeIdsVisible).toBeFalsy();
    });
    it("should update user preferences - outlineVisible", async () => {
      const user_object: import("./dtos/createNewUser-schema").CreateNewUserSchemaDto = {
        firstName: "User1",
        lastName: "Last1",
        email: "xyz@gmail.com",
        username: "testUser",
        password: "12345678",
        roles: [],
      };
      const userPreferenceObject: import("./dtos/user-preferences.dto").UserPreferencesDto = {
        preferences: { outlineVisible: false },
      } as unknown as import("./dtos/user-preferences.dto").UserPreferencesDto;
      await collabService.createNewUser(user_object);
      const created3 = await collabService.loginUser(user_object.username);
      const userId = String(created3?.id ?? "");
      const result = await collabController.updateUserPreferences(userId, userPreferenceObject);
      expect(result.preferences.outlineVisible).toBeFalsy();
    });
  });
});
