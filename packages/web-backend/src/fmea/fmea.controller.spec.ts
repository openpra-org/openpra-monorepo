import { Test, TestingModule } from "@nestjs/testing";
import { MongooseModule, getConnectionToken } from "@nestjs/mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose, { Connection } from "mongoose";
import { FmeaType } from "shared-types/src/openpra-mef/fmea/fmea";
import { ModelCounter, ModelCounterSchema } from "../schemas/model-counter.schema";
import { FmeaController } from "./fmea.controller";
import { FmeaService } from "./fmea.service";
import { Fmea, FmeaSchema } from "./schemas/fmea.schema";

describe("FmeaController", () => {
  let fmeaController: FmeaController;
  let mongoServer: MongoMemoryServer;
  let connection: Connection;

  beforeAll(async () => {
    mongoServer = new MongoMemoryServer();
    await mongoServer.start();
    const mongoUri = mongoServer.getUri();
    const module: TestingModule = await Test.createTestingModule({
      imports: [
        MongooseModule.forRoot(mongoUri),
        MongooseModule.forFeature([
          { name: Fmea.name, schema: FmeaSchema },
          { name: ModelCounter.name, schema: ModelCounterSchema },
        ]),
      ],
      controllers: [FmeaController],
      providers: [FmeaService],
    }).compile();
    connection = await module.get(getConnectionToken());
    fmeaController = module.get<FmeaController>(FmeaController);
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
   * Stop mongoDB server
   */
  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  describe("createFmea", () => {
    it("should create a new FMEA object", async () => {
      const body = { title: "test fmea1", description: "for test" };
      const createdFmea = await fmeaController.createFmea(body);
      expect(createdFmea.title).toEqual(body.title);
      expect(createdFmea).toBeDefined();
    });
  });

  describe("getFmea", () => {
    it("should be defined", () => {
      expect(fmeaController.getFmea.bind(fmeaController)).toBeDefined();
    });
    it("should return a FMEA object", async () => {
      const body = { title: "test fmea1", description: "for test" };
      const createdFmea = await fmeaController.createFmea(body);
      const fmea = await fmeaController.getFmea(Number(createdFmea.id));
      expect(fmea).toBeDefined();
    });
  });

  describe("addColumn", () => {
    it("should be defined", () => {
      expect(fmeaController.addColumn.bind(fmeaController)).toBeDefined();
    });
    it("should add string column", async () => {
      const body = { title: "test fmea1", description: "for test" };
      const createdFmea = await fmeaController.createFmea(body);
      const addColumnObject = { name: "test", type: "string" };
      const fmea = await fmeaController.addColumn(Number(createdFmea.id), addColumnObject);
      expect(fmea).toBeDefined();
    });
    it("should add dropdown column", async () => {
      const body = { title: "test fmea1", description: "for test" };
      const createdFmea = await fmeaController.createFmea(body);
      const addColumnObject = {
        name: "test",
        type: "dropdown",
        dropdownOptions: [
          {
            number: 1,
            description: "test",
          },
          {
            number: 2,
            description: "test2",
          },
        ],
      };
      const fmea = (await fmeaController.addColumn(Number(createdFmea.id), addColumnObject)) as FmeaType;
      expect(fmea).toBeDefined();
      expect(fmea.columns?.[0].dropdownOptions?.[0].number).toEqual(1);
      expect(fmea.columns?.[0].dropdownOptions?.[0].description).toEqual("test");
      expect(fmea.columns?.[0].dropdownOptions?.[1].number).toEqual(2);
      expect(fmea.columns?.[0].dropdownOptions?.[1].description).toEqual("test2");
    });
  });

  describe("addRow", () => {
    it("should be defined", () => {
      expect(fmeaController.addRow.bind(fmeaController)).toBeDefined();
    });
    it("should return a FMEA object", async () => {
      const body = { title: "test fmea1", description: "for test" };
      const createdFmea = await fmeaController.createFmea(body);
      const addColumnObject = { name: "test", type: "string" };
      await fmeaController.addColumn(Number(createdFmea.id), addColumnObject);
      const fmea = (await fmeaController.addRow(Number(createdFmea.id))) as FmeaType;
      expect(fmea).toBeDefined();
      expect(fmea.rows?.[0].row_data?.get("test")).toEqual("");
    });
  });

  describe("updateCell", () => {
    it("should be defined", () => {
      expect(fmeaController.updateCell.bind(fmeaController)).toBeDefined();
    });
    it("should update the cell value", async () => {
      const body = { title: "test fmea1", description: "for test" };
      const createdFmea = await fmeaController.createFmea(body);
      const addColumnObject = { name: "test", type: "string" };
      await fmeaController.addColumn(Number(createdFmea.id), addColumnObject);
      const returnedFmea = (await fmeaController.addRow(Number(createdFmea.id))) as FmeaType;
      expect(returnedFmea.rows?.[0].row_data?.get("test")).toEqual("");
      const updateCellObject = { rowId: Number(returnedFmea.rows?.[0].id), column: "test", value: "test" };
      const updateResult = await fmeaController.updateCell(Number(createdFmea.id), updateCellObject);
      expect(updateResult).toEqual(true);
    });
  });

  describe("updateDropdownOptions", () => {
    it("should be defined", () => {
      expect(fmeaController.updateDropdownOptions.bind(fmeaController)).toBeDefined();
    });
    it("should update the dropdown options", async () => {
      const body = { title: "test fmea1", description: "for test" };
      const createdFmea = await fmeaController.createFmea(body);
      const addColumnObject = {
        name: "test",
        type: "dropdown",
        dropdownOptions: [
          {
            number: 1,
            description: "test",
          },
          {
            number: 2,
            description: "test2",
          },
        ],
      };
      const addColumnObject2 = { name: "test2", type: "string" };
      const addColumnObject3 = {
        name: "test3",
        type: "dropdown",
        dropdownOptions: [
          { number: 10, description: "test10" },
          { number: 20, description: "test20" },
        ],
      };
      await fmeaController.addColumn(Number(createdFmea.id), addColumnObject);
      await fmeaController.addColumn(Number(createdFmea.id), addColumnObject2);
      await fmeaController.addColumn(Number(createdFmea.id), addColumnObject3);
      const updateDropdownOptionsObject = {
        column: "test",
        dropdownOptions: [
          { number: 1, description: "test" },
          { number: 2, description: "test2" },
          { number: 3, description: "test3" },
        ],
      };
      const fmea = (await fmeaController.updateDropdownOptions(
        Number(createdFmea.id),
        updateDropdownOptionsObject,
      )) as FmeaType;
      expect(fmea).toBeDefined();
      expect(fmea.columns?.[0].dropdownOptions?.[0].number).toEqual(1);
      expect(fmea.columns?.[0].dropdownOptions?.[0].description).toEqual("test");
      expect(fmea.columns?.[0].dropdownOptions?.[1].number).toEqual(2);
      expect(fmea.columns?.[0].dropdownOptions?.[1].description).toEqual("test2");
      expect(fmea.columns?.[0].dropdownOptions?.[2].number).toEqual(3);
      expect(fmea.columns?.[0].dropdownOptions?.[2].description).toEqual("test3");
    });
  });

  describe("deleteFmea", () => {
    it("should be defined", () => {
      expect(fmeaController.deleteFmea.bind(fmeaController)).toBeDefined();
    });
    it("should delete the FMEA object", async () => {
      const body = { title: "test fmea1", description: "for test" };
      const createdFmea = await fmeaController.createFmea(body);
      const result = await fmeaController.deleteFmea(Number(createdFmea.id));
      expect(result).toEqual(true);
    });

    it("should return false if FMEA object not found", async () => {
      const result = await fmeaController.deleteFmea(1);
      expect(result).toEqual(false);
    });
  });

  describe("deleteColumn", () => {
    it("should be defined", () => {
      expect(fmeaController.deleteColumn.bind(fmeaController)).toBeDefined();
    });
    it("should delete the column", async () => {
      const body = { title: "test fmea1", description: "for test" };
      const createdFmea = await fmeaController.createFmea(body);
      const addColumnObject = {
        name: "test",
        type: "dropdown",
        dropdownOptions: [
          {
            number: 1,
            description: "test",
          },
          {
            number: 2,
            description: "test2",
          },
        ],
      };
      await fmeaController.addColumn(Number(createdFmea.id), addColumnObject);
      const result = await fmeaController.deleteColumn(Number(createdFmea.id), "test");
      expect(result).toBeDefined();
    });
  });

  describe("deleteRow", () => {
    it("should be defined", () => {
      expect(fmeaController.deleteRow.bind(fmeaController)).toBeDefined();
    });
    it("should delete the row", async () => {
      const body = { title: "test fmea1", description: "for test" };
      const createdFmea = await fmeaController.createFmea(body);
      const addColumnObject = { name: "test", type: "string" };
      await fmeaController.addColumn(Number(createdFmea.id), addColumnObject);
      const returnedFmea = (await fmeaController.addRow(Number(createdFmea.id))) as FmeaType;
      const result = (await fmeaController.deleteRow(
        Number(createdFmea.id),
        Number(returnedFmea.rows?.[0].id),
      )) as FmeaType;
      expect(result).toBeDefined();
      expect(result.rows?.length).toEqual(0);
    });
  });
});
