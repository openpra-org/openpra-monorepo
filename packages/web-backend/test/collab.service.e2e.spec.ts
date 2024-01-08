import { Test, TestingModule } from '@nestjs/testing';
import { CollabService } from '../src/collab/collab.service';
import { User,UserSchema } from '../src/collab/schemas/user.schema';
import { UserCounter,UserCounterSchema } from '../src/collab/schemas/user-counter.schema';
import {MongooseModule , getConnectionToken} from '@nestjs/mongoose';
import mongoose,{Connection} from 'mongoose';

describe('CollabService', () => {
  let collabService: CollabService;
  let connection: Connection;
  const DB_URI = 'mongodb://localhost/27017'; 
  beforeEach(async () => {
      const module: TestingModule = await Test.createTestingModule({
          imports:[
            MongooseModule.forRoot(DB_URI),
            MongooseModule.forFeature([{ name: User.name, schema: UserSchema },
              { name: UserCounter.name, schema: UserCounterSchema }])
          ],
          providers: [CollabService]
      }).compile();
      connection = await module.get(getConnectionToken());
      collabService = module.get<CollabService>(CollabService);
  });
  
  afterAll(async () => {
    await mongoose.disconnect(); //disconnect from database
  });

  afterEach(async () => {
    //delete test user after each test
    await connection.collection('users').findOneAndDelete({username:'testUser'}); 
  });
    
    
  describe('CollabService', () => {
      it("CollabService should be defined", async () => {
          expect(collabService).toBeDefined();
      });
  });

  describe('createNewUser', () => {
    
    it('should create user', async () => {
      const user_object={firstName:'User1',lastName:'Last1',email:'xyz@gmail.com',username:'testUser',password:'12345678'}
      let response = await collabService.createNewUser(user_object); // create a new user  
      expect(response).toBeDefined(); // expect response to be defined
    });

    it('should fail on duplicate username', async () => {
      const user_object={firstName:'User1',lastName:'Last1',email:'xyz@gmail.com',username:'testUser',password:'12345678'}
      let response = await collabService.createNewUser(user_object); // create a new user  
      try{
        let returnedValue = await collabService.createNewUser(user_object);  // calling create new_user again with same username
      }catch(err){
        expect(err).toBeInstanceOf(Error); // expect an error to be thrown
      }
    });
  });

  describe('loginUser', () => {
    it('should return null if user does not exist', async () => {
      const username='randomUserXYZ'; // username that does not exist in database
      const result = await collabService.loginUser(username);// call loginUser function
      expect(result).toBeNull(); //expect result to be null, as username does not exist
    });
    it('should return user document if user logged in successfully', async () => {
      const user_object={firstName:'User1',lastName:'Last1',email:'xyz@gmail.com',username:'testUser',password:'12345678'}
      let response = await collabService.createNewUser(user_object); // create a new user  
      const result = await collabService.loginUser(user_object.username); // call loginUser function
      expect(result).toBeDefined(); //expect result to be defined, if login is successful
    });
  });

  describe('getUserPreferences', () => {
    it('should return user preferences', async () => {
      const user_object={firstName:'User1',lastName:'Last1',email:'xyz@gmail.com',username:'testUser',password:'12345678'}
      let response = await collabService.createNewUser(user_object); // create a new user  
      let returnedValue = await collabService.getUserPreferences(String(response.id));  // calling getUserPreferences
      expect(returnedValue).toBeDefined(); // user preferences should be defined
    });
  });


  describe('updateUserPreferences', () => {
    it('should update user preferences - theme', async () => {
      const userPreferenceObject = {preferences:{theme:'Dark'}}
      const user_object={firstName:'User1',lastName:'Last1',email:'xyz@gmail.com',username:'testUser',password:'12345678'}
      let response = await collabService.createNewUser(user_object); // create a new user  
      let returnedValue = await collabService.updateUserPreferences(String(response.id),userPreferenceObject);  // calling updateUserPreferences
      expect(returnedValue?.preferences.theme).toMatch('Dark'); // theme should be updated
    });

    it('should update user preferences - nodeIdsVisible', async () => {
      const userPreferenceObject = {preferences:{nodeIdsVisible:false}}
      const user_object={firstName:'User1',lastName:'Last1',email:'xyz@gmail.com',username:'testUser',password:'12345678'}
      let response = await collabService.createNewUser(user_object); // create a new user  
      let returnedValue = await collabService.updateUserPreferences(String(response.id),userPreferenceObject);  // calling updateUserPreferences
      expect(returnedValue?.preferences.nodeIdsVisible).toBeFalsy(); // nodeIdsVisible should be updated
    });

    it('should update user preferences - outlineVisible', async () => {
      const userPreferenceObject = {preferences:{outlineVisible:false}}
      const user_object={firstName:'User1',lastName:'Last1',email:'xyz@gmail.com',username:'testUser',password:'12345678'}
      let response = await collabService.createNewUser(user_object); // create a new user  
      let returnedValue = await collabService.updateUserPreferences(String(response.id),userPreferenceObject);  // calling updateUserPreferences
      expect(returnedValue?.preferences.outlineVisible).toBeFalsy(); // user preferences should be updated
    });
  });

  describe('updateLastLogin', () => {
    it('should update last login', async () => {
      const user_object={firstName:'User1',lastName:'Last1',email:'xyz@gmail.com',username:'testUser',password:'12345678'}
      let response = await collabService.createNewUser(user_object); // create a new user  
      const dateBefore = Date.now(); //get current timestamp
      await collabService.updateLastLogin(response.id);  // calling updateLastLogin
      let returnedValue = await collabService.loginUser(user_object.username); // calling loginUser to get the latest user object
      const dateNumber = returnedValue?.last_login.getTime(); // get Date object from returned value and convert to timestamp
      expect(dateNumber).toBeGreaterThanOrEqual(dateBefore); // last_login should be greater than 
    });
  });      
});

    