import { Test, TestingModule } from '@nestjs/testing';
import { CollabService } from '../collab/collab.service';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { User, UserSchema } from '../collab/schemas/user.schema';
import { UserCounter, UserCounterSchema } from '../collab/schemas/user-counter.schema';
import {MongooseModule , getConnectionToken} from '@nestjs/mongoose';
import mongoose, {Connection} from 'mongoose';
import { JwtService } from '@nestjs/jwt';


describe('AuthController', () => {
    let authService: AuthService;
    let authController: AuthController;
    let connection: Connection;
    let collabService: CollabService;

    /**
     * Before any test is run, start a new in-memory MongoDB instance and connect to it.
     * Create a new module with the AuthService and AuthController.
     * make connection object and authService and authController available to all tests.
     */
    beforeAll(async () => {
        const mongoUri = process.env.MONGO_URI; //get the URI from the environment variable
        const module: TestingModule = await Test.createTestingModule({
            imports:[
              MongooseModule.forRoot(mongoUri),
              MongooseModule.forFeature([{ name: User.name, schema: UserSchema },
                { name: UserCounter.name, schema: UserCounterSchema }])
            ],
            providers: [AuthService,CollabService,JwtService],
            controllers: [AuthController]
        }).compile();
        authService =  module.get<AuthService>(AuthService);
        authController = module.get<AuthController>(AuthController);
        collabService =  module.get<CollabService>(CollabService);
        connection = await module.get(getConnectionToken());
        await connection.collection('users').findOneAndDelete({username:'testUser'}); //delete test user before each test
    });

    /**
     * after all tests are done, disconnect from mongoose
     */
    afterAll(async () => {
        await mongoose.disconnect(); //disconnect from database
    });

    /**
     * after each test, drop the database
     */
    afterEach(async () => {
        //delete test user after each test
        await connection.dropDatabase();
    });

    describe('AuthController', () => {
        /**
         * Test that the AuthController is defined
         */
        it("AuthService should be defined", async () => {
            expect(authController).toBeDefined();
        });
    });
});
