import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { CollabService } from '../collab/collab.service';
import { JwtService } from '@nestjs/jwt';
import { User, UserSchema } from '../collab/schemas/user.schema';
import { UserCounter, UserCounterSchema } from '../collab/schemas/user-counter.schema';
import {MongooseModule , getConnectionToken} from '@nestjs/mongoose';
import mongoose, {Connection} from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

describe('AuthService', () => {
    let authService: AuthService;
    let collabService: CollabService;
    let mongoServer: MongoMemoryServer;
    let connection: Connection;
    
    /**
     * Before any test is run, start a new in-memory MongoDB instance and connect to it.
     * Create a new module with the AuthService and CollabService.
     * make connection object and authService and collabService available to all tests.
     */
    beforeAll(async () => {
        mongoServer = new MongoMemoryServer();
        await mongoServer.start();
        const mongoUri = mongoServer.getUri();

        const module: TestingModule = await Test.createTestingModule({
            imports:[
              MongooseModule.forRoot(mongoUri),
              MongooseModule.forFeature([{ name: User.name, schema: UserSchema },
                { name: UserCounter.name, schema: UserCounterSchema }])
            ],
            providers: [AuthService,CollabService,JwtService]
        }).compile();
        authService =  module.get<AuthService>(AuthService);
        collabService =  module.get<CollabService>(CollabService);
        connection = await module.get(getConnectionToken());
    });

    
    afterAll(async () => {
        await mongoose.disconnect(); //disconnect from database
        await mongoServer.stop();
    });

    afterEach(async () => {
        await connection.dropDatabase();
      });


    describe('AuthService', () => {
        it("AuthService should be defined", async () => {
            expect(authService).toBeDefined();
        });
    });

    describe('loginUser', () => {
        it("should be defined",async () =>{
            expect(authService.loginUser).toBeDefined();
        });
          
        /**
         * define a user object and create a new user
         * store correct password in a variable
         * should process login with correct password
         * expect result to be an instance of User
         */
        it("should process login with correct password", async () => {
            const user_object={firstName:'User1',lastName:'Last1',email:'xyz@gmail.com',username:'testUser',password:'12345678'}
            let correctPassword = user_object.password
            let response = await collabService.createNewUser(user_object); // create a new user
            const result = await authService.loginUser(user_object.username,correctPassword); // call loginUser function
            expect(result).toBeInstanceOf(Object); //expect result to be an instance of User
        });
        
        /**
         * define a user object and create a new user
         * store incorrect password in a variable
         * should fail login with incorrect password
         * expect result to be an instance of Error
         */
        it ("should fail login with incorrect password", async () => {
            const user_object={firstName:'User1',lastName:'Last1',email:'xyz@gmail.com',username:'testUser',password:'12345678'}
            let incorrectPassword = '123';
            let response = await collabService.createNewUser(user_object); // create a new user
            try {
                const result = await authService.loginUser(user_object.username,incorrectPassword); // call loginUser function
            } catch (err) {
                expect(err).toBeInstanceOf(Error); //expect result to be an instance of User
            }
        });
        
        /**
         * define a user object and create a new user
         * store incorrect username in a variable
         * should fail login with incorrect username
         * expect result to be an instance of Error
         */
        it ("should fail login with incorrect username", async () => {
            const user_object={firstName:'User1',lastName:'Last1',email:'xyz@gmail.com',username:'testUser',password:'12345678'}
            let incorrectUsername = 'testUserABCD';
            let response = await collabService.createNewUser(user_object); // create a new user
            try {
                const result = await authService.loginUser(incorrectUsername,user_object.password); // call loginUser function
            } catch (err) {
                expect(err).toBeInstanceOf(Error); //expect result to be an instance of User
            }
        });
    });
});
