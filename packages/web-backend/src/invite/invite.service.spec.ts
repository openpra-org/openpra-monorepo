import mongoose, { Connection } from "mongoose";
import { MongooseModule, getConnectionToken } from "@nestjs/mongoose";
import { Test, TestingModule } from "@nestjs/testing";
import { expect } from "@playwright/test";
import { InvitedUser, InvitedUserSchema } from "./schemas/invite.schema";
import { InviteService } from "./invite.service";

describe("inviteService", () => {
  let inviteService: InviteService;
  let connection: Connection;
  /**
   * Before all tests
   * Create a new mongoDB instance using MongoMemoryServer
   * Start the mongoDB server
   * Create a new Testing module
   * define connection and inviteService
   */
  beforeAll(async () => {
    const mongoUri = process.env.MONGO_URI; //get the URI from the environment variable
    const module: TestingModule = await Test.createTestingModule({
      imports: [
        MongooseModule.forRoot(mongoUri),
        MongooseModule.forFeature([{ name: InvitedUser.name, schema: InvitedUserSchema }]),
      ],
      providers: [InviteService],
    }).compile();
    connection = await module.get(getConnectionToken()); // create mongoose connection object to call functions like put, get, find
    inviteService = module.get<InviteService>(InviteService);
  });

  /**
   * After each test drop database
   */
  afterEach(async () => {
    await connection.dropDatabase();
  });

  /**
   * After all tests
   * Disconnect mongoose
   */
  afterAll(async () => {
    await mongoose.disconnect();
  });

  describe("Tests for generating user invite", () => {
    it("should create new invite", async () => {
      const invitedUsers = connection.collection<InvitedUser>("invitedusers");
      const date = new Date(new Date().getTime() + 24 * 60 * 60 * 1000);
      const result = await inviteService.generateUserInvite({
        firstname: "Firstname",
        lastname: "Lastname",
        email: "xyz@gmail.com",
        username: "sampleusername",
        numberOfInvites: 1,
        expiry: date,
      });
      const res = await invitedUsers.findOne({ id: result.id });
      expect(res).not.toBeNull();
      expect(res.numberOfInvites).toBe(1);
      expect(res.expiry).toStrictEqual(date);
    });

    it("should create multiple invites", async () => {
      const invitedUsers = connection.collection<InvitedUser>("invitedusers");
      const date = new Date(new Date().getTime() + 24 * 60 * 60 * 1000);
      const result = await inviteService.generateUserInvite({
        firstname: "Firstname",
        lastname: "Lastname",
        email: "xyz@gmail.com",
        username: "sampleusername",
        numberOfInvites: 3,
        expiry: date,
      });
      const res = await invitedUsers.findOne({ id: result.id });
      expect(res).not.toBeNull();
      expect(res.numberOfInvites).toBe(3);
      expect(res.expiry).toStrictEqual(date);
    });

    it("should return user if invite is valid", async () => {
      const invitedUsers = connection.collection<InvitedUser>("invitedusers");
      await invitedUsers.insertOne({
        firstName: "Firstname",
        email: "email",
        username: "username",
        id: "SampleID",
        lastName: "lastname",
        expiry: new Date(new Date().getTime() + 24 * 60 * 60 * 1000),
        numberOfInvites: 1,
      });
      const result = await inviteService.verifyUserInvite("SampleID");
      expect(result).not.toBeNull();
      expect(result.numberOfInvites).toBe(1);
    });

    it("should decrease count if user is logged in", async () => {
      const invitedUsers = connection.collection<InvitedUser>("invitedusers");
      await invitedUsers.insertOne({
        firstName: "Firstname",
        email: "email",
        username: "username",
        id: "SampleID",
        lastName: "lastname",
        expiry: new Date(new Date().getTime() + 24 * 60 * 60 * 1000),
        numberOfInvites: 2,
      });
      const updatedUser = {
        firstname: "firstNameChange",
        email: "emailChange",
        username: "usernameChange",
        id: "SampleID",
        lastname: "lastNameChange",
        expiry: new Date(new Date().getTime() + 24 * 60 * 60 * 1000),
        numberOfInvites: 1,
      };
      const result = await inviteService.updateInvite(updatedUser);
      const iUsers = await invitedUsers.findOne({ id: "SampleID" });
      expect(iUsers.numberOfInvites).toBe(1);
      expect(iUsers.email).toBe("emailChange");
      expect(iUsers.lastName).toBe("lastNameChange");
      expect(iUsers.firstName).toBe("firstNameChange");
      expect(result).not.toBeNull();
    });

    it("should return null if guid is invalid", async () => {
      const invitedUsers = connection.collection<InvitedUser>("invitedusers");
      await invitedUsers.insertOne({
        firstName: "Firstname",
        email: "email",
        username: "username",
        id: "SampleID",
        lastName: "lastname",
        expiry: new Date(new Date().getTime() + 24 * 60 * 60 * 1000),
        numberOfInvites: 1,
      });
      const result = await inviteService.verifyUserInvite("SampleID123");
      expect(result).toBeNull();
    });

    it("should return null if invite count is less than 1", async () => {
      const invitedUsers = connection.collection<InvitedUser>("invitedusers");
      await invitedUsers.insertOne({
        firstName: "Firstname",
        email: "email",
        username: "username",
        id: "SampleID",
        lastName: "lastname",
        expiry: new Date(new Date().getTime() + 24 * 60 * 60 * 1000),
        numberOfInvites: 0,
      });
      const result = await inviteService.verifyUserInvite("SampleID");
      expect(result).toBeNull();
    });

    it("should return null if guid is expired", async () => {
      const invitedUsers = connection.collection<InvitedUser>("invitedusers");
      await invitedUsers.insertOne({
        firstName: "Firstname",
        email: "email",
        username: "username",
        id: "SampleID",
        lastName: "lastname",
        expiry: new Date(new Date().getTime() - 12 * 60 * 60 * 1000),
        numberOfInvites: 1,
      });
      const result = await inviteService.verifyUserInvite("SampleID123");
      expect(result).toBeNull();
    });

    it("should return list of invited users", async () => {
      const invitedUsers = connection.collection<InvitedUser>("invitedusers");
      await invitedUsers.insertMany([
        {
          firstName: "Firstname",
          email: "email",
          username: "username",
          id: "SampleID",
          lastName: "lastname",
          expiry: new Date(new Date().getTime() + 12 * 60 * 60 * 1000),
          numberOfInvites: 1,
        },
        {
          firstName: "Firstname",
          email: "email",
          username: "username",
          id: "SampleID",
          lastName: "lastname",
          expiry: new Date(new Date().getTime() + 12 * 60 * 60 * 1000),
          numberOfInvites: 1,
        },
        {
          firstName: "Firstname",
          email: "email",
          username: "username",
          id: "SampleID",
          lastName: "lastname",
          expiry: new Date(new Date().getTime() + 12 * 60 * 60 * 1000),
          numberOfInvites: 1,
        },
      ]);
      const result = await inviteService.getAllInvitedUsers();
      expect(result.length).toEqual(3);
    });

    it("should return true if an invited user is deleted", async () => {
      const invitedUsers = connection.collection<InvitedUser>("invitedusers");
      await invitedUsers.insertOne({
        firstName: "Firstname",
        email: "email",
        username: "username",
        id: "SampleID",
        lastName: "lastname",
        expiry: new Date(new Date().getTime() - 12 * 60 * 60 * 1000),
        numberOfInvites: 1,
      });
      const result = await inviteService.deleteInviteById("SampleID");
      expect(result).toBe(true);
      expect(await invitedUsers.countDocuments()).toBe(0);
    });

    it("should return false if a user invite which doesnt exist is deleted", async () => {
      const invitedUsers = connection.collection<InvitedUser>("invitedusers");
      await invitedUsers.insertOne({
        firstName: "Firstname",
        email: "email",
        username: "username",
        id: "SampleID",
        lastName: "lastname",
        expiry: new Date(new Date().getTime() - 12 * 60 * 60 * 1000),
        numberOfInvites: 1,
      });
      const result = await inviteService.deleteInviteById("SampleID123");
      expect(result).toBe(false);
      expect(await invitedUsers.countDocuments()).toBe(1);
    });

    it("should add invite with multiple counts", async () => {
      const invitedUsers = connection.collection<InvitedUser>("invitedusers");
      const userObj = {
        firstName: "Firstname",
        email: "email",
        username: "username",
        lastName: "lastname",
        expiry: new Date(new Date().getTime() + 12 * 60 * 60 * 1000),
        numberOfInvites: 3,
      };
      const user = await inviteService.generateUserInvite(userObj);
      const invitedUser = await invitedUsers.findOne({ id: user.id });
      expect(invitedUser.numberOfInvites).toBe(3);
    });

    it("should get a user", async () => {
      const invitedUsers = connection.collection<InvitedUser>("invitedusers");
      await invitedUsers.insertOne({
        firstName: "Firstname",
        email: "email",
        username: "username",
        id: "SampleID",
        lastName: "lastname",
        expiry: new Date(new Date().getTime() - 12 * 60 * 60 * 1000),
        numberOfInvites: 1,
      });
      const user = await inviteService.getInviteById("SampleID");
      expect(user.id).toBe("SampleID");
    });
  });
});
