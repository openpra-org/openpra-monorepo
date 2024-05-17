import mongoose, { Connection } from "mongoose";
import { MongooseModule, getConnectionToken } from "@nestjs/mongoose";
import { Test, TestingModule } from "@nestjs/testing";
import { InvitedUser, InvitedUserSchema } from "./schemas/invite.schema";
import { InviteService } from "./invite.service";
import { InviteController } from "./invite.controller";

describe("CollabController", () => {
  let inviteService: InviteService;
  let inviteController: InviteController;
  let connection: Connection;

  /**
   * Before any test is run, start a new in-memory MongoDB instance and connect to it.
   * Create a new module with the InviteService and InviteController.
   * make connection object and inviteService and inviteController available to all tests.
   */
  beforeAll(async () => {
    const mongoUri = process.env.MONGO_URI; //get the URI from the environment variable
    const module: TestingModule = await Test.createTestingModule({
      imports: [
        MongooseModule.forRoot(mongoUri),
        MongooseModule.forFeature([{ name: InvitedUser.name, schema: InvitedUserSchema }]),
      ],
      providers: [InviteService],
      controllers: [InviteController],
    }).compile();
    connection = await module.get(getConnectionToken());
    inviteService = module.get<InviteService>(InviteService);
    inviteController = module.get<InviteController>(InviteController);
  });

  /**
   * after each test, drop the database
   */
  afterEach(async () => {
    await connection.dropDatabase();
  });

  /**
   * after all tests are done, disconnect from mongoose
   */
  afterAll(async () => {
    await mongoose.disconnect(); //disconnect from database
  });

  describe("CollabController", () => {
    /**
     * Test that the CollabController is defined
     */
    it("CollabController should be defined", async () => {
      expect(inviteController).toBeDefined();
    });
  });
});
