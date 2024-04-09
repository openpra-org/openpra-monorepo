import { MongoClient } from "mongodb";
import { SeismicEvent } from "./SeismicEvent";

describe("SeismicEvent", () => {
  let client: MongoClient;
  let seismicEvent: SeismicEvent;

  beforeAll(async () => {
    // Assuming the URI and dbName are accessible or can be retrieved after SetupDB
    const uri = "your_mongodb_memory_server_uri"; // Replace with actual URI from MongoMemoryServer
    const dbName = "your_db_name"; // Replace with your database name
    client = new MongoClient(uri);
    await client.connect();
    seismicEvent = new SeismicEvent(uri, dbName);
  });

  afterAll(async () => {
    await client.close();
  });

  test("should connect to the database", async () => {
    expect(seismicEvent).toBeDefined();
    const db = client.db("your_db_name"); // Replace with your database name
    const collections = await db.collections();
    expect(collections.length).toBeGreaterThan(0); // Assuming there's at least one collection
  });

  test("generateMainshockFaultTree should throw an error if MS_vector is not found", async () => {
    // Assuming a specific sscDocument structure that would lead to an error
    const sscDocument = {
      room_id: "1",
      name: "Test",
      description: "Test Description",
    };
    await expect(
      seismicEvent.generateMainshockFaultTree(sscDocument),
    ).rejects.toThrow("MS_vector is not found in the database.");
  });

  // Add more tests here to cover other methods and scenarios
});
