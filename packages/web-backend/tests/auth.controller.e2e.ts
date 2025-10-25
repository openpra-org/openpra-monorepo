import { Test, TestingModule } from "@nestjs/testing";
import { MongooseModule, getConnectionToken } from "@nestjs/mongoose";
import mongoose, { Connection } from "mongoose";
import { JwtService } from "@nestjs/jwt";
import { CollabService } from "../src/collab/collab.service";
import { AuthService } from "../src/auth/auth.service";
import { AuthController } from "../src/auth/auth.controller";
import { User, UserSchema } from "../src/collab/schemas/user.schema";
import { UserCounter, UserCounterSchema } from "../src/collab/schemas/user-counter.schema";

describe("AuthController", () => {
  let _authService: AuthService;
  let authController: AuthController;
  let connection: Connection;
  let _collabService: CollabService;
  const DB_URI = "mongodb://localhost/27017";

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [
        MongooseModule.forRoot(DB_URI),
        MongooseModule.forFeature([
          { name: User.name, schema: UserSchema },
          { name: UserCounter.name, schema: UserCounterSchema },
        ]),
      ],
      providers: [AuthService, CollabService, JwtService],
      controllers: [AuthController],
    }).compile();
  _authService = module.get<AuthService>(AuthService);
    authController = module.get<AuthController>(AuthController);
  _collabService = module.get<CollabService>(CollabService);
    connection = await module.get(getConnectionToken());
    await connection.collection("users").findOneAndDelete({ username: "testUser" }); //delete test user before each test
  });

  afterAll(async () => {
    await mongoose.disconnect(); //disconnect from database
  });

  afterEach(async () => {
    //delete test user after each test
    await connection.collection("users").findOneAndDelete({ username: "testUser" });
  });

  describe("AuthController", () => {
    it("AuthService should be defined", async () => {
      expect(authController).toBeDefined();
    });
  });
});
