import mongoose, { Connection } from "mongoose";
import { Test, TestingModule } from "@nestjs/testing";
import { getConnectionToken, MongooseModule } from "@nestjs/mongoose";
import { expect } from "@playwright/test";
import { NotFoundException } from "@nestjs/common";
import { RolesService } from "./roles.service";
import { RolesSchema, Roles } from "./schemas/roles.schema";

const BootstrapRoles = [
  {
    id: "admin-role",
    name: "Admin",
    permissions: [
      {
        action: "manage",
        subject: "all",
      },
    ],
  },
  {
    id: "sample-role",
    name: "Admin",
    permissions: [
      {
        action: "read",
        subject: "users",
      },
      {
        action: "update",
        subject: "all",
      },
    ],
  },
];

describe("rolesService", () => {
  let rolesService: RolesService;
  let connection: Connection;

  /**
   * Setup before all tests
   */
  beforeAll(async () => {
    const mongoUrl = process.env.MONGO_URI;
    const module: TestingModule = await Test.createTestingModule({
      imports: [
        MongooseModule.forRoot(mongoUrl),
        MongooseModule.forFeature([{ name: Roles.name, schema: RolesSchema }]),
      ],
      providers: [RolesService],
    }).compile();
    connection = await module.get(getConnectionToken());
    rolesService = module.get<RolesService>(RolesService);
  });

  /**
   * Drop database after each test
   */
  afterEach(async () => {
    await connection.dropDatabase();
  });

  /**
   * Disconnect from db after all tests
   */
  afterAll(async () => {
    await mongoose.disconnect();
  });

  describe("Tests for roles API endpoints", () => {
    it("Should return all roles in database", async () => {
      const roles = connection.collection<Roles>("roles");
      await roles.insertMany([...BootstrapRoles]);
      const fetchedRoles = await rolesService.getAllRoles(undefined);
      expect(fetchedRoles.length).toEqual(2);
      expect(fetchedRoles[0].id).toEqual(BootstrapRoles[0].id);
      expect(fetchedRoles[1].id).toEqual(BootstrapRoles[1].id);
    });

    it("Should return one role in database", async () => {
      const roles = connection.collection<Roles>("roles");
      await roles.insertMany([...BootstrapRoles]);
      const fetchedRole = await rolesService.getRole(BootstrapRoles[0].id);
      expect(fetchedRole.id).toEqual(BootstrapRoles[0].id);
      expect(fetchedRole.name).toEqual(BootstrapRoles[0].name);
      expect(fetchedRole.permissions.length).toEqual(BootstrapRoles[0].permissions.length);
    });

    it("Should return 404 if we find a role that doesnt exist", async () => {
      const roles = connection.collection<Roles>("roles");
      await roles.insertMany([...BootstrapRoles]);
      await expect(rolesService.getRole("some-role-that-doesnt-exist")).rejects.toThrow(NotFoundException);
    });

    it("Should update a role in database if it exists", async () => {
      const roles = connection.collection<Roles>("roles");
      await roles.insertMany([...BootstrapRoles]);
      const roleToUpdate = BootstrapRoles[0];
      roleToUpdate.permissions.push({ action: "say-hello", subject: "all" });
      await rolesService.updateRole(roleToUpdate);
      const fetchedRole = await roles.findOne({ id: roleToUpdate.id });
      expect(fetchedRole.permissions.length).toEqual(2);
      expect(fetchedRole.permissions[1].action).toEqual("say-hello");
      expect(fetchedRole.permissions[1].subject).toEqual("all");
    });

    it("Should delete a role if it exists in the database", async () => {
      const roles = connection.collection<Roles>("roles");
      await roles.insertMany([...BootstrapRoles]);
      await rolesService.deleteRole(BootstrapRoles[0].id);
      const fetchedRole = await roles.findOne({ id: BootstrapRoles[0].id });
      expect(fetchedRole).toBeFalsy();
    });
  });
});
