import mongoose, { Connection } from "mongoose";
import { MongooseModule, getConnectionToken } from "@nestjs/mongoose";
import { Test, TestingModule } from "@nestjs/testing";
import { RolesService } from "./roles.service";
import { RolesController } from "./roles.controller";
import { RolesSchema, Roles } from "./schemas/roles.schema";
describe("Roles Controller", () => {
  let rolesController: RolesController;
  let connection: Connection;
  beforeAll(async () => {
    const mongoUri = process.env.MONGO_URI;
    const module: TestingModule = await Test.createTestingModule({
      imports: [
        MongooseModule.forRoot(mongoUri),
        MongooseModule.forFeature([{ name: Roles.name, schema: RolesSchema }]),
      ],
      providers: [RolesService],
      controllers: [RolesController],
    }).compile();
    connection = await module.get(getConnectionToken());
    rolesController = module.get<RolesController>(RolesController);
  });
  afterEach(async () => {
    await connection.dropDatabase();
  });
  afterAll(async () => {
    await mongoose.disconnect();
  });
  describe("Roles Controller", () => {
    it("RolesController should be defined", () => {
      expect(rolesController).toBeDefined();
    });
  });
});
