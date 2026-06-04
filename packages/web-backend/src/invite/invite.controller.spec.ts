import mongoose, { Connection } from "mongoose";
import { MongooseModule, getConnectionToken } from "@nestjs/mongoose";
import { Test, TestingModule } from "@nestjs/testing";
import { InvitedUser, InvitedUserSchema } from "./schemas/invite.schema";
import { InviteService } from "./invite.service";
import { InviteController } from "./invite.controller";
describe("CollabController", () => {
  let _inviteService: InviteService;
  let inviteController: InviteController;
  let connection: Connection;
  beforeAll(async () => {
    const mongoUri = process.env.MONGO_URI;
    const module: TestingModule = await Test.createTestingModule({
      imports: [
        MongooseModule.forRoot(mongoUri),
        MongooseModule.forFeature([{ name: InvitedUser.name, schema: InvitedUserSchema }]),
      ],
      providers: [InviteService],
      controllers: [InviteController],
    }).compile();
    connection = await module.get(getConnectionToken());
    _inviteService = module.get<InviteService>(InviteService);
    inviteController = module.get<InviteController>(InviteController);
  });
  afterEach(async () => {
    await connection.dropDatabase();
  });
  afterAll(async () => {
    await mongoose.disconnect();
  });
  describe("CollabController", () => {
    it("CollabController should be defined", async () => {
      expect(inviteController).toBeDefined();
    });
  });
});
