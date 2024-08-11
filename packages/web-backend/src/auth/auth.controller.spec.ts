import { Connection } from "mongoose";
import { MongooseModule, getConnectionToken } from "@nestjs/mongoose";
import { JwtService } from "@nestjs/jwt";
import { Test, TestingModule } from "@nestjs/testing";
import { CollabService } from "../collab/collab.service";
import { User, UserSchema } from "../collab/schemas/user.schema";
import { UserCounter, UserCounterSchema } from "../collab/schemas/user-counter.schema";
import { AuthService } from "./auth.service";
import { AuthController } from "./auth.controller";

describe("AuthController", () => {
  let authController: AuthController;
  let connection: Connection;
  /**
   * Before any test is run, start a new in-memory MongoDB instance and connect to it.
   * Create a new module with the AuthService and AuthController.
   * make connection object and authService and authController available to all tests.
   */
  beforeAll(async () => {
    const mongoUri: string = process.env.MONGO_URI ? process.env.MONGO_URI : ""; //get the URI from the environment variable
    const module: TestingModule = await Test.createTestingModule({
      imports: [
        MongooseModule.forRoot(mongoUri),
        MongooseModule.forFeature([
          { name: User.name, schema: UserSchema },
          { name: UserCounter.name, schema: UserCounterSchema },
        ]),
      ],
      providers: [AuthService, CollabService, JwtService],
      controllers: [AuthController],
    }).compile();
    authController = module.get<AuthController>(AuthController);
    connection = await module.get(getConnectionToken());
    await connection.collection("users").findOneAndDelete({ username: "testUser" }); //delete test user before each test
  });

  /**
   * after each test, drop the database
   */
  afterEach(async () => {
    //delete test user after each test
    await connection.dropDatabase();
  });

  describe("AuthController", () => {
    /**
     * Test that the AuthController is defined
     */
    it("AuthService should be defined", () => {
      expect(authController).toBeDefined();
    });
  });
});
