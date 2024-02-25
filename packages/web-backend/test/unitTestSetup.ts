import { MongoMemoryServer } from 'mongodb-memory-server';

//global variable to store the mongo server
let mongoServer: MongoMemoryServer;


mongoServer = new MongoMemoryServer();

module.exports = async () => {
  console.log("Starting mongo server");
  await mongoServer.start();
  process.env.MONGO_URI = mongoServer.getUri(); // Store the URI in an environment variable
  global.__MONGOSERVER__ = mongoServer;
};
