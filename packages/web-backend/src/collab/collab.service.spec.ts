import mongoose, { Connection } from "mongoose";
import { MongooseModule, getConnectionToken } from "@nestjs/mongoose";
import { Test, TestingModule } from "@nestjs/testing";
import { MemberResult } from "shared-types/src/lib/api/Members";
import { expect } from "@playwright/test";
import * as argon2 from "argon2";
import { UserPreferences } from "shared-types/src/openpra-mef/collab/user-preferences";
import { UserType } from "shared-types/src/openpra-mef/collab/user";
import { CollabService } from "./collab.service";
import { User, UserSchema } from "./schemas/user.schema";
import { UserCounter, UserCounterSchema } from "./schemas/user-counter.schema";
import { CreateUserObject } from "./stubs/createNewUser.stub";

describe("CollabService", () => {
  let collabService: CollabService;
  let connection: Connection;
  /**
   * Before all tests
   * Create a new mongoDB instance using MongoMemoryServer
   * Start the mongoDB server
   * Create a new Testing module
   * define connection and collabService
   */
  beforeAll(async () => {
    const mongoUri = process.env.MONGO_URI ? process.env.MONGO_URI : ""; //get the URI from the environment variable
    const module: TestingModule = await Test.createTestingModule({
      imports: [
        MongooseModule.forRoot(mongoUri),
        MongooseModule.forFeature([
          { name: User.name, schema: UserSchema },
          { name: UserCounter.name, schema: UserCounterSchema },
        ]),
      ],
      providers: [CollabService],
    }).compile();
    connection = await module.get(getConnectionToken()); // create mongoose connection object to call functions like put, get, find
    collabService = module.get<CollabService>(CollabService);
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

  describe("CollabService", () => {
    /**
     * Test if collabService is defined
     */
    it("CollabService should be defined", () => {
      expect(collabService).toBeDefined();
    });
  });

  describe("createNewUser", () => {
    it("should be defined", () => {
      expect(collabService.createNewUser(CreateUserObject)).toBeDefined();
    });

    /**
     * define user_object
     * call createNewUser function
     * expect response to be defined
     */
    it("should create user and return object", async () => {
      const response = await collabService.createNewUser(CreateUserObject);
      expect(response).toBeDefined();
    });

    /**
     * define user_object
     * call createNewUser function
     * expect response to be defined
     * call createNewUser function again with same username
     * expect an error to be thrown
     */
    it("should fail on duplicate username", async () => {
      const response = await collabService.createNewUser(CreateUserObject);
      expect(response).toBeDefined();
      try {
        await collabService.createNewUser(CreateUserObject); // calling create new_user again with same username
      } catch (err) {
        expect(err).toBeInstanceOf(Error); // expect an error to be thrown
      }
    });
  });

  describe("loginUser", () => {
    it("should be defined", () => {
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(collabService.loginUser).toBeDefined();
    });

    /**
     * define username which does not exist in database
     * call loginUser function
     * expect result to be null
     */
    it("should return null if user does not exist", async () => {
      const username = "randomUserXYZ"; // username that does not exist in database
      const result = await collabService.loginUser(username); // call loginUser function
      expect(result).toBeNull(); //expect result to be null, as username does not exist
    });

    /**
     * define user_object
     * call createNewUser function
     * call loginUser function using username
     * expect result to be defined
     */
    it("should return user document if user logged in successfully", async () => {
      await collabService.createNewUser(CreateUserObject); // create a new user
      const result = await collabService.loginUser(CreateUserObject.username); // call loginUser function
      expect(result).toBeDefined(); //expect result to be defined, if login is successful
    });
  });

  describe("getUserPreferences", () => {
    it("should be defined", () => {
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(collabService.getUserPreferences).toBeDefined();
    });

    /**
     * define user_object
     * call createNewUser function
     * call getUserPreferences function
     * expect result to be defined
     */
    it("should return user preferences", async () => {
      const response = await collabService.createNewUser(CreateUserObject); // create a new user
      if (typeof response !== "string") {
        const returnedValue = await collabService.getUserPreferences(String(response.id)); // calling getUserPreferences
        expect(returnedValue).toBeDefined(); // user preferences should be defined
      }
    });
  });

  describe("getUserById", () => {
    it("should be defined", (): void => {
      expect(collabService.getUserById("1")).toBeDefined();
    });

    it("should return a single user", async (): Promise<void> => {
      for (let i = 0; i < 30; i++) {
        const userObject = {
          firstName: "User" + String(i),
          lastName: "Last" + String(i),
          email: "xyz@gmail" + String(i) + ".com",
          username: "testUser" + String(i),
          password: "12345678",
          roles: ["Collaborator"],
        };
        await collabService.createNewUser(userObject);
      }
      const user = await collabService.getUserById("1");
      if (user) {
        expect(user).not.toBeNull();
        expect(user.id).toEqual(1);
        expect(user.email).toEqual("xyz@gmail0.com");
        expect(user.firstName).toEqual("User0");
        expect(user.lastName).toEqual("Last0");
      }
    });
  });

  describe("updateUserPreferences", () => {
    it("should be defined", () => {
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(collabService.updateUserPreferences).toBeDefined();
    });

    /**
     * define user_object and userPreferenceObject
     * call createNewUser function
     * call updateUserPreferences function - theme is originally light when user is created
     * expect result to be defined
     * expect theme to be updated to dark
     */
    it("should update user preferences - theme", async () => {
      const userPreferenceObject = { preferences: { theme: "Dark" } };
      const response = (await collabService.createNewUser(CreateUserObject)) as UserType; // create a new user
      await collabService.updateUserPreferences(String(response.id), userPreferenceObject); // calling updateUserPreferences
      const returnedValue = (await collabService.getUserPreferences(String(response.id))) as UserPreferences;
      expect(returnedValue).toBeDefined(); // user preferences should be defined
      expect(returnedValue.preferences.theme).toBe("Dark"); // theme should be updated
    });

    /**
     * define user_object and userPreferenceObject
     * call createNewUser function
     * call updateUserPreferences function - nodeIdsVisible is originally true when user is created
     * expect nodeIdsVisible to be updated to false
     */
    it("should update user preferences - nodeIdsVisible", async () => {
      const userPreferenceObject = { preferences: { nodeIdsVisible: false } };
      const response = (await collabService.createNewUser(CreateUserObject)) as UserType; // create a new user
      await collabService.updateUserPreferences(String(response.id), userPreferenceObject); // calling updateUserPreferences
      const returnedValue = (await collabService.getUserPreferences(String(response.id))) as UserPreferences;
      expect(returnedValue).toBeDefined(); // user preferences should be defined
      expect(returnedValue.preferences.nodeIdsVisible).toBeFalsy(); // nodeIdsVisible should be updated
    });

    /**
     * define user_object and userPreferenceObject
     * call createNewUser function
     * call updateUserPreferences function - outlineVisible is originally true when user is created
     * expect outlineVisible to be updated to false
     */
    it("should update user preferences - outlineVisible", async () => {
      const userPreferenceObject = { preferences: { outlineVisible: false } };
      const response = (await collabService.createNewUser(CreateUserObject)) as UserType; // create a new user
      await collabService.updateUserPreferences(String(response.id), userPreferenceObject); // calling updateUserPreferences
      const returnedValue = (await collabService.getUserPreferences(String(response.id))) as UserPreferences;
      expect(returnedValue).toBeDefined(); // user preferences should be defined
      expect(returnedValue.preferences.outlineVisible).toBeFalsy(); // user preferences should be updated
    });

    describe("updateLastLogin", () => {
      it("should be defined", () => {
        // eslint-disable-next-line @typescript-eslint/unbound-method
        expect(collabService.updateLastLogin).toBeDefined();
      });

      /**
       * define user_object
       * call createNewUser function
       * store current timestamp
       * call updateLastLogin function
       * call loginUser function to get the latest user object
       * convert last_login to timestamp
       * expect last_login to be greater than timestamp before updateLastLogin
       */
      it("should update last login", async () => {
        const response = (await collabService.createNewUser(CreateUserObject)) as UserType; // create a new user
        const dateBefore = Date.now(); //get current timestamp
        await collabService.updateLastLogin(response.id); // calling updateLastLogin
        const returnedValue = (await collabService.loginUser(CreateUserObject.username)) as UserType; // calling loginUser to get the latest user object
        const dateNumber = returnedValue.last_login.getTime(); // get Date object from returned value and convert to timestamp
        expect(dateNumber).toBeGreaterThanOrEqual(dateBefore); // last_login should be greater than
      });

      /**
       * state user email change, firstname change and password change
       * create new user using mongo api (not by calling our own backend implementation)
       * create a MemberResult object which contains the changes
       * create a new User object and push to mongodb
       * use updateUser api to update User to MemberResult
       * compare results expect email to be changed, first name changed and password change
       */
      describe("updateUser", (): void => {
        it("should update user", async () => {
          const emailChange = "hellotestchangeemail@gmail.com";
          const firstNameChange = "FirstName";
          const passwordChange = "newPassword";
          const users = connection.collection("users");
          const member: MemberResult = {
            account_created: "",
            last_login: "",
            preferences: undefined,
            recently_accessed: undefined,
            firstName: "Test",
            lastName: "String",
            username: "TestString",
            email: "TestString@gmail.com",
            id: 786,
            password: "password",
            roles: ["Admin", "Member", "Collaborator"],
          };
          const user = new User();
          user.email = member.email;
          user.firstName = member.firstName;
          user.lastName = member.lastName;
          user.username = member.username;
          user.id = member.id;
          if (member.password) {
            const hashedPassword = await argon2.hash(member.password);
            user.password = hashedPassword;
          }

          await users.insertOne(user);
          member.email = emailChange;
          member.firstName = firstNameChange;
          member.password = passwordChange;
          await collabService.updateUser(member);
          const foundUser = (await users.findOne<User>({ id: 786 })) as UserType;
          expect(await argon2.verify(foundUser.password, passwordChange)).toEqual(true);
          expect(foundUser.email).toEqual(emailChange);
          expect(foundUser.firstName).toEqual(firstNameChange);
        });
      });

      describe("getUsersList", () => {
        it("should be defined", () => {
          // eslint-disable-next-line @typescript-eslint/unbound-method
          expect(collabService.getUsersList).toBeDefined();
        });

        /**
         * call getUsersList function
         * expect result to be defined
         * expect count to be 0
         * expect results to be empty
         */
        it("should return empty list if no users in database", async () => {
          const url = "?limit=0&offset=0";
          const returnedValue = await collabService.getUsersList(url); // calling getUsersList
          expect(returnedValue).toBeDefined(); // users list should be defined
          expect(returnedValue.count).toBe(0); // users list should have 0 users
          expect(returnedValue.results.length).toBe(0); // users list should have be empty
        });

        /**
         * create 30 users using for loop
         * call getUsersList function with limit 10 and offset 0
         * expect result to be defined
         * expect count to be 30
         * expect results to have 10 users
         * expect first 10 users to be testUser0 to testUser9
         * expect next page url to be ?limit=10&offset=10
         * expect previous page url to be null
         *
         * NOTE: increase timeout of test to 30 seconds as it takes time to create 30 users
         */
        it("should return first page of users with limit 10 and offset 0 if 30 users exist", async () => {
          for (let i = 0; i < 30; i++) {
            const userObject = {
              firstName: "User" + String(i),
              lastName: "Last" + String(i),
              email: "xyz@gmail" + String(i) + ".com",
              username: "testUser" + String(i),
              password: "12345678",
              roles: ["Member"],
            };
            await collabService.createNewUser(userObject); // create a new user
          }
          const url = "?limit=10&offset=0";
          const returnedValue = await collabService.getUsersList(url); // calling getUsersList
          expect(returnedValue).toBeDefined(); // users list should be defined
          expect(returnedValue.count).toBe(30); // users list should have 10 users
          expect(returnedValue.results.length).toBe(10); // result should have 10 user objects
          for (let i = 0; i < 10; i++) {
            const traverseReturnedValue = (await collabService.getUserById(String(i))) as UserType;
            expect(traverseReturnedValue.username).toMatch("testUser" + String(i)); // first 10 users should be testUser0 to testUser9
          }
          expect(returnedValue.next).toMatch("?limit=10&offset=10"); // next page url should be ?limit=10&offset=10
        }, 30000);

        /**
         * create 30 users using for loop
         * call getUsersList function with limit 10 and offset 10
         * expect result to be defined
         * expect count to be 30
         * expect results to have 10 users
         * expect middle 10 users to be testUser10 to testUser19
         * expect next page url to be ?limit=10&offset=20
         * expect previous page url to be ?limit=10&offset=0
         *
         * NOTE: increase timeout of test to 30 seconds as it takes time to create 30 users
         */
        it("should return middle page of users with limit 10 and offset 10", async () => {
          for (let i = 0; i < 30; i++) {
            const userObject = {
              firstName: "User" + String(i),
              lastName: "Last" + String(i),
              email: "xyz@gmail" + String(i) + ".com",
              username: "testUser" + String(i),
              password: "12345678",
              roles: ["Member"],
            };
            await collabService.createNewUser(userObject);
          }
          const url = "limit=10&offset=10";
          const returnedValue = await collabService.getUsersList(url, 10, 10);
          expect(returnedValue).toBeDefined(); // users list should be defined
          expect(returnedValue.count).toBe(30); // users list should have 10 users
          expect(returnedValue.results.length).toBe(10); // users list should have 10 users
          for (let i = 0; i < 10; i++) {
            const traverseReturnedValue = (await collabService.getUserById(String(i))) as UserType;
            expect(traverseReturnedValue.username).toMatch("testUser" + String(i + 10)); // last 10 users should be testUser10 to testUser19
          }
          expect(returnedValue.next).toMatch("limit=10&offset=20");
          expect(returnedValue.previous).toMatch("limit=10&offset=0");
        }, 30000);

        /**
         * create 30 users using for loop
         * call getUsersList function with limit 10 and offset 20
         * expect result to be defined
         * expect count to be 30
         * expect results to have 10 users
         * expect last 10 users to be testUser20 to testUser29
         * expect next page url to be null
         * expect previous page url to be ?limit=10&offset=10
         *
         * NOTE: increase timeout of test to 30 seconds as it takes time to create 30 users
         */
        it("should return last page of users with limit 10 and offset 20 if 30 users in database", async () => {
          //add 30 users to database using for loop
          for (let i = 0; i < 30; i++) {
            const userObject = {
              firstName: "User" + String(i),
              lastName: "Last" + String(i),
              email: "xyz@gmail" + String(i) + ".com",
              username: "testUser" + String(i),
              password: "12345678",
              roles: ["Member"],
            };
            await collabService.createNewUser(userObject);
          }
          const url = "limit=10&offset=20";
          const returnedValue = await collabService.getUsersList(url, 10, 20);
          expect(returnedValue).toBeDefined(); // users list should be defined
          expect(returnedValue.count).toBe(30); // users list should have 10 users
          expect(returnedValue.results.length).toBe(10); // users list should have 10 users
          for (let i = 0; i < 10; i++) {
            const traverseReturnedValue = (await collabService.getUserById(String(i))) as UserType;
            expect(traverseReturnedValue.username).toMatch("testUser" + String(i + 20)); // last 10 users should be testUser20to testUser29
          }
          expect(returnedValue.next).toBeNull(); // next page url should be null
          expect(returnedValue.previous).toMatch("limit=10&offset=10"); // previous page url should be ?limit=10&offset=20
        }, 30000);

        /**
         * create 3 users using for loop
         * call getUsersList function with limit 10 and offset 0
         * Here limit is greater than number of users in database
         * expect count to be 3
         * expect results to have 3 users
         * expect users to be testUser0 to testUser2
         * expect next page url to be null
         * expect previous page url to be null
         *
         * NOTE: increase timeout of test to 30 seconds as it takes time to create 3 users
         */
        it("should return all users when limit greater than number of users in database", async () => {
          for (let i = 0; i < 3; i++) {
            const user_object = {
              firstName: "User" + String(i),
              lastName: "Last" + String(i),
              email: "xyz@gmail" + String(i) + ".com",
              username: "testUser" + String(i),
              password: "12345678",
              roles: ["Member"],
            };
            await collabService.createNewUser(user_object);
          }
          const url = "limit=10&offset=0";
          const returnedValue = await collabService.getUsersList(url, 10, 0);
          expect(returnedValue).toBeDefined(); // users list should be defined
          expect(returnedValue.count).toBe(3); // users list should have 3 users
          expect(returnedValue.results.length).toBe(3); // users list should have 3 users
          for (let i = 0; i < 3; i++) {
            const traverseReturnedValue = (await collabService.getUserById(String(i))) as UserType;
            expect(traverseReturnedValue.username).toMatch("testUser" + String(i));
          }
          expect(returnedValue.next).toBeNull(); // next page url should be null
          expect(returnedValue.previous).toBeNull(); // previous page url should be null
        }, 30000);

        /**
         * create 3 users and add them to database using for loop
         * call getUsersList function with limit 10 and offset 10
         * Here offset is greater than number of users in database
         * expect count to be 3
         * expect results to be empty
         * expect next page url to be null
         * expect previous page url to be null
         *
         * NOTE: increase timeout of test to 30 seconds as it takes time to create 3 users
         */
        it("should return empty list when offset greater than number of users in database", async () => {
          //add 3 users to database using for loop
          for (let i = 0; i < 3; i++) {
            const userObject = {
              firstName: "User" + String(i),
              lastName: "Last" + String(i),
              email: "xyz@gmail" + String(i) + ".com",
              username: "testUser" + String(i),
              password: "12345678",
              roles: ["Member"],
            };
            await collabService.createNewUser(userObject);
          }
          const url = "limit=10&offset=100";
          const returnedValue = await collabService.getUsersList(url, 10, 100);
          expect(returnedValue).toBeDefined(); // users list should be defined
          expect(returnedValue.count).toBe(3); // users list should have 3 users
          expect(returnedValue.results.length).toBe(0); // users list should have 3 users
          expect(returnedValue.next).toBeNull(); // next page url should be null
          expect(returnedValue.previous).toBeNull(); // previous page url should be null
        }, 30000);
      });

      /**
       * Tests for checking if email is valid service is working
       */
      describe("isValidUsername", () => {
        const userObject: User = {
          id: 1,
          firstName: "User1",
          lastName: "Last1",
          email: "xyz@gmail.com",
          username: "testUser",
          password: "12345678",
          preferences: {
            theme: "string",
            pageBreaksVisible: false,
            nodeDescriptionEnabled: false,
            outlineVisible: false,
            nodeIdsVisible: false,
            node_value_visible: false,
            quantificationConfigurations: {
              configurations: {},
              currentlySelected: "yes",
            },
          },
          recently_accessed: {
            models: [],
            projects: [],
            subsystems: [],
          },
          last_login: new Date(Date.now()),
          roles: [],
        };

        /**
         * Unit test for invalid email
         */
        it("invalid username", async () => {
          const users = connection.collection<User>("users");
          await users.insertOne(userObject);
          const result = await collabService.isEmailValid("xyz@gmail.com");
          expect(result).toBe(false);
        });

        /**
         * Unit test for valid email
         */
        it("valid username", async () => {
          const users = connection.collection<User>("users");
          await users.insertOne(userObject);
          const result = await collabService.isEmailValid("xyz123@gmail.com");
          expect(result).toBe(true);
        });
      });

      /**
       * Tests for checking if username is valid service is working
       */
      describe("Valid/Invalid Emails", () => {
        const userObject: User = {
          id: 1,
          firstName: "User1",
          lastName: "Last1",
          email: "xyz@gmail.com",
          username: "testUser",
          password: "12345678",
          preferences: {
            theme: "string",
            pageBreaksVisible: false,
            nodeDescriptionEnabled: false,
            outlineVisible: false,
            nodeIdsVisible: false,
            node_value_visible: false,
            quantificationConfigurations: {
              configurations: {},
              currentlySelected: "yes",
            },
          },
          recently_accessed: {
            models: [],
            projects: [],
            subsystems: [],
          },
          last_login: new Date(Date.now()),
          roles: [],
        };

        /**
         * Unit test for invalid username
         */
        it("invalid email", async () => {
          const users = connection.collection<User>("users");
          await users.insertOne(userObject);
          const result = await collabService.isUsernameValid("testUser");
          expect(result).toBe(false);
        });

        /**
         * Unit test for valid username
         */
        it("valid email", async () => {
          const users = connection.collection<User>("users");
          await users.insertOne(userObject);
          const result = await collabService.isUsernameValid("testUser123");
          expect(result).toBe(true);
        });
      });
    });
  });
});
