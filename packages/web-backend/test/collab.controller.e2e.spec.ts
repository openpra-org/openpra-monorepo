import { Test, TestingModule } from "@nestjs/testing";
import { MongooseModule, getConnectionToken } from "@nestjs/mongoose";
import mongoose, { Connection } from "mongoose";
import { CollabService } from "../src/collab/collab.service";
import { CollabController } from "../src/collab/collab.controller";
import { User, UserSchema } from "../src/collab/schemas/user.schema";
import { UserCounter, UserCounterSchema } from "../src/collab/schemas/user-counter.schema";

describe("CollabController", () => {
  let collabService: CollabService;
  let collabController: CollabController;
  let connection: Connection;
  const DB_HOST = "mongodb://localhost:27017";
  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [
        MongooseModule.forRoot(DB_HOST),
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
    await connection.collection("users").findOneAndDelete({ username: "testUser" });
  });

  afterAll(async () => {
    await mongoose.disconnect(); //disconnect from database
  });

  afterEach(async () => {
    //delete test user after each test
    await connection.collection("users").findOneAndDelete({ username: "testUser" });
  });

  describe("CollabController", () => {
    it("CollabController should be defined", () => {
      expect(collabController).toBeDefined();
    });
  });

  describe("createNewUser", () => {
    it("should create a user", async () => {
      const user_object = {
        firstName: "User1",
        lastName: "Last1",
        email: "xyz@gmail.com",
        username: "testUser",
        password: "12345678",
      };
      const response = await collabController.createNewUser(user_object);
      expect(response).toBeDefined(); //expect result to be defined, if login is successfulexpect(result).toBeDefined();
    });
  });

  describe("getUserPreferences", () => {
    it("should return user preferences", async () => {
      const user_object = {
        firstName: "User1",
        lastName: "Last1",
        email: "xyz@gmail.com",
        username: "testUser",
        password: "12345678",
      };
      const response = await collabService.createNewUser(user_object);
      const userId = String(response.id);
      const result = await collabController.getUserPreferences(userId);
      expect(result).toBeDefined(); //expect preferences to be defined for user
    });
  });

  describe("updateUserPreferences", () => {
    it("should update user preferences - theme", async () => {
      const user_object = {
        firstName: "User1",
        lastName: "Last1",
        email: "xyz@gmail.com",
        username: "testUser",
        password: "12345678",
      };
      const userPreferenceObject = { preferences: { theme: "Dark" } };
      const response = await collabService.createNewUser(user_object);
      const userId = String(response.id);
      const result = await collabController.updateUserPreferences(userId, userPreferenceObject);
      expect(result.preferences.theme).toMatch("Dark");
    });

    it("should update user preferences - nodeIdsVisible", async () => {
      const user_object = {
        firstName: "User1",
        lastName: "Last1",
        email: "xyz@gmail.com",
        username: "testUser",
        password: "12345678",
      };
      const userPreferenceObject = { preferences: { nodeIdsVisible: false } };
      const response = await collabService.createNewUser(user_object);
      const userId = String(response.id);
      const result = await collabController.updateUserPreferences(userId, userPreferenceObject);
      expect(result.preferences.nodeIdsVisible).toBeFalsy();
    });

    it("should update user preferences - outlineVisible", async () => {
      const user_object = {
        firstName: "User1",
        lastName: "Last1",
        email: "xyz@gmail.com",
        username: "testUser",
        password: "12345678",
      };
      const userPreferenceObject = { preferences: { outlineVisible: false } };
      const response = await collabService.createNewUser(user_object);
      const userId = String(response.id);
      const result = await collabController.updateUserPreferences(userId, userPreferenceObject);
      expect(result.preferences.outlineVisible).toBeFalsy();
    });
  });
});
