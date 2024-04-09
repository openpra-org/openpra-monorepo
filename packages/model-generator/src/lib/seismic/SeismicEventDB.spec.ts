import { MongoClient } from "mongodb";
import { SeismicEventDB } from "./SeismicEventDB";

describe("SeismicEventDB", () => {
  let client: MongoClient;
  let seismicEvent: SeismicEventDB;

  beforeAll(async () => {
    // Assuming the URI and dbName are accessible or can be retrieved after SetupDB
    const uri = process.env.MONGO_URI ?? "localhost:27017"; // Replace with actual URI from MongoMemoryServer
    const dbName = "test"; // Replace with your database name
    client = new MongoClient(uri);
    await client.connect();
    seismicEvent = new SeismicEventDB(uri, dbName);
  });

  afterAll(async () => {
    await client.close();
  });

  test("should connect to the database", async () => {
    expect(seismicEvent).toBeDefined();
    const db = client.db("test"); // Replace with your database name
    const collections = await db.collections();
    expect(collections.length).toBeGreaterThan(0); // Assuming there's at least one collection
  });

  test("generateMainshockFaultTree should generate a basic fault tree", async () => {
    // Assuming a specific ssc structure
    const ssc = {
      _id: 'ObjectId("65026bd07358e5227605e7a6")',
      room_id: 'ObjectId("65026bd07358e5227605e7a3")',
      failure_model: {
        distribution_type: "SL",
        median_seismic_acceleration: 0.8639648675349997,
        beta_r_uncertainty: 0.4473192548918091,
        beta_u_uncertainty: 0.13227964097583897,
        pga: "",
        amplification: {
          $numberDecimal: "1.0",
        },
      },
      description: "Flooding Source 6",
      name: "FLD-SRC-6",
      type: "SBE",
      logic_type: "BE",
      ssc_id: 'ObjectId("6591ee526f5b2a848ec3e6fe")',
    };

    await expect(
      seismicEvent.generateMainshockFaultTree(ssc),
    ).resolves.toBeDefined();
  });

  test("successfully retrieve ssc components", async () => {
    expect(seismicEvent).toBeDefined();
    const db = client.db("test");
    const sscDocuments = await db.collection("components").find().toArray();
    expect(sscDocuments.length).toEqual(5); // number of docs in `components.json`
  });

  test("successfully generate mainshock fault trees with SSCs from the `components` collection", async () => {
    expect(seismicEvent).toBeDefined();
    const db = client.db("test");
    const sscDocuments = await db.collection("components").find().toArray();

    // Map each document to a promise returned by generateMainshockFaultTree
    const faultTreePromises = sscDocuments.map((ssc) =>
      seismicEvent.generateMainshockFaultTree(ssc),
    );

    // Wait for all promises to resolve
    const faultTrees = await Promise.all(faultTreePromises);

    // Assert that each resolved value (fault tree) is defined
    faultTrees.forEach((faultTree) => {
      expect(faultTree).toBeDefined();
    });
  });

  // Add more tests here to cover other methods and scenarios
});
