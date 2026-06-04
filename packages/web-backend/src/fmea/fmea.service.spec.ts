import { Test, TestingModule } from "@nestjs/testing";
import { MongooseModule, getConnectionToken } from "@nestjs/mongoose";
import mongoose, { Connection } from "mongoose";
import { ModelCounter, ModelCounterSchema } from "../schemas/model-counter.schema";
import { Fmea, FmeaSchema } from "./schemas/fmea.schema";
import { FmeaService } from "./fmea.service";
describe("CollabService", () => {
  let fmeaService: FmeaService;
  let connection: Connection;
  beforeAll(async () => {
    const mongoUri = process.env.MONGO_URI;
    const module: TestingModule = await Test.createTestingModule({
      imports: [
        MongooseModule.forRoot(mongoUri),
        MongooseModule.forFeature([
          { name: Fmea.name, schema: FmeaSchema },
          { name: ModelCounter.name, schema: ModelCounterSchema },
        ]),
      ],
      providers: [FmeaService],
    }).compile();
    connection = await module.get(getConnectionToken());
    fmeaService = module.get<FmeaService>(FmeaService);
  });
  afterEach(async () => {
    await connection.dropDatabase();
  });
  afterAll(async () => {
    await mongoose.disconnect();
  });
  describe("FmeaService", () => {
    it("FmeaService should be defined", async () => {
      expect(fmeaService).toBeDefined();
    });
  });
  describe("createFmea", () => {
    it("createFmea should be defined", async () => {
      expect(fmeaService.createFmea).toBeDefined();
    });
    it("createFmea should create a new fmea", async () => {
      const fmea = await fmeaService.createFmea({ title: "test", description: "test" });
      expect(fmea).toBeDefined();
    });
  });
  describe("getFmea", () => {
    it("getFmea should be defined", async () => {
      expect(fmeaService.getFmeaById).toBeDefined();
    });
    it("getFmea should return a fmea", async () => {
      const fmea = await fmeaService.createFmea({ title: "test", description: "test" });
      const fmea2 = await fmeaService.getFmeaById(fmea.id);
      console.log(fmea2);
      expect(fmea2).toBeDefined();
    });
  });
  describe("addColumn", () => {
    it("addColumn should be defined", async () => {
      expect(fmeaService.addColumn).toBeDefined();
    });
    it("addColumn should add a column to a fmea", async () => {
      const fmea = await fmeaService.createFmea({ title: "test", description: "test" });
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
      const res = await fmeaService.addColumn(fmea.id, addColumnObject);
      console.log(res);
      expect(res).toBeDefined();
    });
  });
  describe("addRow", () => {
    it("addRow should be defined", async () => {
      expect(fmeaService.addRow).toBeDefined();
    });
    it("addRow should add a row to a fmea", async () => {
      const fmea = await fmeaService.createFmea({ title: "test", description: "test" });
      const res = await fmeaService.addRow(fmea.id);
      console.log(res);
      expect(res).toBeDefined();
    });
    it("addRow should work with existing columns", async () => {
      const fmea = await fmeaService.createFmea({ title: "test", description: "test" });
      const addColumnObject1 = {
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
      await fmeaService.addColumn(fmea.id, addColumnObject1);
      const addColumnObject2 = {
        name: "test2",
        type: "string",
        dropdownOptions: [],
      };
      await fmeaService.addColumn(fmea.id, addColumnObject2);
      const res = await fmeaService.addRow(fmea.id);
      expect(res).toBeDefined();
      expect(res.rows[0].row_data.test).toEqual(String(addColumnObject1.dropdownOptions[0].number));
      expect(res.rows[0].row_data.test2).toEqual("");
    });
  });
  describe("updateCell", () => {
    it("should be defined", async () => {
      expect(fmeaService.updateCell).toBeDefined();
    });
    it("should update cell", async () => {
      const fmea = await fmeaService.createFmea({ title: "test", description: "test" });
      const addColumnObject1 = {
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
      await fmeaService.addColumn(fmea.id, addColumnObject1);
      const addColumnObject2 = {
        name: "test2",
        type: "string",
        dropdownOptions: [],
      };
      await fmeaService.addColumn(fmea.id, addColumnObject2);
      await fmeaService.addRow(fmea.id);
      const getFmea = await fmeaService.getFmeaById(fmea.id);
      const rowId = getFmea.rows[0].id;
      await fmeaService.updateCell(fmea.id, rowId, "test2", "value1");
      const res = await fmeaService.updateCell(fmea.id, rowId, "test2", "changed value");
      expect(res).toBeDefined();
      expect(res).toBeTruthy();
    });
  });
  describe("updateDropdownOptions", () => {
    it("updateDropdownOptions should be defined", async () => {
      expect(fmeaService.updateDropdownOptions).toBeDefined();
    });
    it("updateDropdownOptions should update dropdownOptions", async () => {
      const fmea = await fmeaService.createFmea({ title: "test", description: "test" });
      const addColumnObject1 = {
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
      await fmeaService.addColumn(fmea.id, addColumnObject1);
      const addColumnObject2 = {
        name: "test2",
        type: "string",
        dropdownOptions: [],
      };
      await fmeaService.addColumn(fmea.id, addColumnObject2);
      const res = await fmeaService.updateDropdownOptions(fmea.id, "test", [
        { number: 1, description: "changed description" },
      ]);
      expect(res).toBeDefined();
    });
    it("should not update if column of type string", async () => {
      const fmea = await fmeaService.createFmea({ title: "test", description: "test" });
      const addColumnObject1 = {
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
      await fmeaService.addColumn(fmea.id, addColumnObject1);
      const addColumnObject2 = {
        name: "test2",
        type: "string",
        dropdownOptions: [],
      };
      await fmeaService.addColumn(fmea.id, addColumnObject2);
      const res = await fmeaService.updateDropdownOptions(fmea.id, "test2", [
        { number: 1, description: "changed description" },
      ]);
      expect(res.columns[1].dropdownOptions).toEqual([]);
    });
  });
  describe("deleteFmea", () => {
    it("deleteFmea should be defined", async () => {
      expect(fmeaService.deleteFmea).toBeDefined();
    });
    it("deleteFmea should delete a fmea", async () => {
      const fmea = await fmeaService.createFmea({ title: "test", description: "test" });
      const res = await fmeaService.deleteFmea(fmea.id);
      expect(res).toBeDefined();
      expect(res).toBeTruthy();
    });
    it("should return false if fmea does not exist", async () => {
      const res = await fmeaService.deleteFmea(1);
      expect(res).toBeFalsy();
    });
  });
  describe("deleteColumn", () => {
    it("deleteColumn should be defined", async () => {
      expect(fmeaService.deleteColumn).toBeDefined();
    });
    it("deleteColumn should delete a column", async () => {
      const fmea = await fmeaService.createFmea({ title: "test", description: "test" });
      const addColumnObject1 = {
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
      await fmeaService.addColumn(fmea.id, addColumnObject1);
      const addColumnObject2 = {
        name: "test2",
        type: "string",
        dropdownOptions: [],
      };
      await fmeaService.addColumn(fmea.id, addColumnObject2);
      const res = await fmeaService.deleteColumn(fmea.id, "test2");
      console.log(res);
      console.log(res.columns);
      console.log(res.rows);
      expect(res).toBeDefined();
      expect(res.columns.length).toEqual(1);
    });
    it("should delete column with rows", async () => {
      const fmea = await fmeaService.createFmea({ title: "test", description: "test" });
      const addColumnObject1 = {
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
      await fmeaService.addColumn(fmea.id, addColumnObject1);
      const addColumnObject2 = {
        name: "test2",
        type: "string",
        dropdownOptions: [],
      };
      await fmeaService.addColumn(fmea.id, addColumnObject2);
      await fmeaService.addRow(fmea.id);
      const res = await fmeaService.deleteColumn(fmea.id, "test");
      expect(res).toBeDefined();
      expect(res.columns.length).toEqual(1);
      expect(res.rows[0].row_data.test).toBeUndefined();
    });
  });
  describe("deleteRow", () => {
    it("deleteRow should be defined", async () => {
      expect(fmeaService.deleteRow).toBeDefined();
    });
    it("deleteRow should delete a row", async () => {
      const fmea = await fmeaService.createFmea({ title: "test", description: "test" });
      const addColumnObject1 = {
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
      await fmeaService.addColumn(fmea.id, addColumnObject1);
      const addColumnObject2 = {
        name: "test2",
        type: "string",
        dropdownOptions: [],
      };
      await fmeaService.addColumn(fmea.id, addColumnObject2);
      const _added = await fmeaService.addRow(fmea.id);
      const current = await fmeaService.getFmeaById(fmea.id);
      const rowId = current?.rows?.[0]?.id as string;
      const res = await fmeaService.deleteRow(fmea.id, rowId);
      expect(res).toBeDefined();
      expect(res.rows.length).toEqual(0);
    });
  });
});
