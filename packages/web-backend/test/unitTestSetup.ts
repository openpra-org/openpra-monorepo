import { MongoMemoryServer } from 'mongodb-memory-server';

//global variable to store the mongo server
let mongoServer: MongoMemoryServer;


mongoServer = new MongoMemoryServer();

module.exports = async () => {
  console.log("Starting mongo server");
  await mongoServer.start();
  process.env.MONGO_URI = mongoServer.getUri(); // Store the URI in an environment variable
  console.log("Started server at", process.env.MONGO_URI);
  global.__MONGOSERVER__ = mongoServer;
};
