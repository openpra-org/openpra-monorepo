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
      providers: [AuthService, CollabService, JwtService],
      controllers: [AuthController],
    }).compile();
    authController = module.get<AuthController>(AuthController);
    connection = await module.get(getConnectionToken());
    await connection.collection("users").findOneAndDelete({ username: "testUser" });
  });
  afterEach(async () => {
    await connection.dropDatabase();
  });
  describe("AuthController", () => {
    it("AuthService should be defined", () => {
      expect(authController).toBeDefined();
    });
  });
});
