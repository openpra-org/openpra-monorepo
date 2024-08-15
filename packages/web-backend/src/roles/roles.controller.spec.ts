import mongoose, { Connection } from "mongoose";
import { MongooseModule, getConnectionToken } from "@nestjs/mongoose";
import { Test, TestingModule } from "@nestjs/testing";
import { RolesService } from "./roles.service";
import { RolesController } from "./roles.controller";
import { RolesSchema, Roles } from "./schemas/roles.schema";

describe("Roles Controller", () => {
  let rolesController: RolesController;
  let connection: Connection;

  /**
   * Before any test is run, start a new in-memory MongoDB instance and connect to it.
   * Create a new module with the InviteService and InviteController.
   * make connection object and inviteService and inviteController available to all tests.
   */
  beforeAll(async () => {
    const mongoUri = process.env.MONGO_URI ? process.env.MONGO_URI : ""; //get the URI from the environment variable
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

  describe("Roles Controller", () => {
    /**
     * Test that the Roles Controller is defined
     */
    it("RolesController should be defined", () => {
      expect(rolesController).toBeDefined();
    });
  });
});
