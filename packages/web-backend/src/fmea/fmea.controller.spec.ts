import { Test, TestingModule } from '@nestjs/testing';
import { FmeaController } from './fmea.controller';
import { FmeaService } from './fmea.service';
import { Fmea, FmeaSchema } from './schemas/fmea.schema';
import { ModelCounter, ModelCounterSchema } from '../schemas/model-counter.schema';
import { MongooseModule, getConnectionToken } from '@nestjs/mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose, { Connection } from 'mongoose';


describe('FmeaController', () => {
    let fmeaService: FmeaService;
    let fmeaController: FmeaController;
    let mongoServer: MongoMemoryServer;
    let connection: Connection;
  
    beforeAll(async () => {
        mongoServer = new MongoMemoryServer();
        await mongoServer.start();
        const mongoUri = mongoServer.getUri();
        const module: TestingModule = await Test.createTestingModule({
            imports:[
            MongooseModule.forRoot(mongoUri),
            MongooseModule.forFeature([
                {name: Fmea.name, schema: FmeaSchema },
                {name: ModelCounter.name, schema: ModelCounterSchema}
            ])
            ],
            controllers: [FmeaController],
            providers: [FmeaService],
        }).compile();
        connection = await module.get(getConnectionToken());
        fmeaService= module.get<FmeaService>(FmeaService);
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

    describe('createFmea', () => {
        it('should create a new FMEA object', async () => {
            const body = {"title":"test fmea1","description":"for test"}; 
            const createdFmea = await fmeaController.createFmea(body);
            expect(createdFmea.title).toEqual(body.title);
            expect(createdFmea).toBeDefined();
        });
    });

    describe("getFmea",() => {
        it("should be defined",()=>{
            expect(fmeaController.getFmea).toBeDefined();
        });
        it("should return a FMEA object",async()=>{
            const body = {"title":"test fmea1","description":"for test"}; 
            const createdFmea = await fmeaController.createFmea(body);
            const fmea = await fmeaController.getFmea(createdFmea.id);
            expect(fmea).toBeDefined();
        });
    });

    describe("addColumn",() => {
        it("should be defined",()=>{
            expect(fmeaController.addColumn).toBeDefined();
        });
        it("should add string column",async()=>{
            const body = {"title":"test fmea1","description":"for test"}; 
            const createdFmea = await fmeaController.createFmea(body);
            const addColumnObject = {"name":"test","type":"string"};
            const fmea = await fmeaController.addColumn(createdFmea.id,addColumnObject);
            expect(fmea).toBeDefined();
        });
        it("should add dropdown column",async()=>{
            const body = {"title":"test fmea1","description":"for test"}; 
            const createdFmea = await fmeaController.createFmea(body);
            const addColumnObject = {
                name: "test",
                type: "dropdown",
                dropdownOptions: [{
                    number: 1,
                    description: "test"
                    },
                    {
                    number: 2,
                    description: "test2"
                  }
                ]
            }
            const fmea = await fmeaController.addColumn(createdFmea.id,addColumnObject);
            expect(fmea).toBeDefined();
            expect(fmea.columns[0].dropdownOptions[0].number).toEqual(1);
            expect(fmea.columns[0].dropdownOptions[0].description).toEqual("test");
            expect(fmea.columns[0].dropdownOptions[1].number).toEqual(2);
            expect(fmea.columns[0].dropdownOptions[1].description).toEqual("test2");
        });
    });

    describe("addRow",() => {
        it("should be defined",()=>{
            expect(fmeaController.addRow).toBeDefined();
        });
        it("should return a FMEA object",async()=>{
            const body = {"title":"test fmea1","description":"for test"}; 
            const createdFmea = await fmeaController.createFmea(body);
            const addColumnObject = {"name":"test","type":"string"};
            await fmeaController.addColumn(createdFmea.id,addColumnObject);
            const fmea = await fmeaController.addRow(createdFmea.id);
            expect(fmea).toBeDefined();
            expect(fmea.rows[0].row_data['test']).toEqual("");
        });
    });

    describe("updateCell",() => {
        it("should be defined",()=>{
            expect(fmeaController.updateCell).toBeDefined();
        });
        it("should update the cell value",async()=>{
            const body = {"title":"test fmea1","description":"for test"}; 
            const createdFmea = await fmeaController.createFmea(body);
            const addColumnObject = {"name":"test","type":"string"};
            await fmeaController.addColumn(createdFmea.id,addColumnObject);
            const returned_fmea= await fmeaController.addRow(createdFmea.id);
            expect(returned_fmea?.rows[0].row_data['test']).toEqual("");
            const updateCellObject = {"rowId":returned_fmea?.rows[0].id,"column":"test","value":"test"};
            const updateResult = await fmeaController.updateCell(createdFmea.id,updateCellObject);
            expect(updateResult).toEqual(true);
        });
    });

    describe("updateDropdownOptions",() => {
        it("should be defined",()=>{
            expect(fmeaController.updateDropdownOptions).toBeDefined();
        });
        it("should update the dropdown options",async()=>{
            const body = {"title":"test fmea1","description":"for test"}; 
            const createdFmea = await fmeaController.createFmea(body);
            const addColumnObject = {
                name: "test",
                type: "dropdown",
                dropdownOptions: [{
                    number: 1,
                    description: "test"
                    },
                    {
                    number: 2,
                    description: "test2"
                  }
                ]
            }
            const addColumnObject2 = {"name":"test2","type":"string"};
            const addColumnObject3 = {
                "name":"test3","type":"dropdown",
                "dropdownOptions": [
                    {number:10,description:"test10"},
                    {number:20,description:"test20"}
                ]
            };
            await fmeaController.addColumn(createdFmea.id,addColumnObject);
            await fmeaController.addColumn(createdFmea.id,addColumnObject2);
            await fmeaController.addColumn(createdFmea.id,addColumnObject3);
            const updateDropdownOptionsObject = {"column":"test","dropdownOptions":[{"number":1,"description":"test"},{"number":2,"description":"test2"},{"number":3,"description":"test3"}]};
            const fmea = await fmeaController.updateDropdownOptions(createdFmea.id,updateDropdownOptionsObject);
            expect(fmea).toBeDefined();
            expect(fmea.columns[0].dropdownOptions[0].number).toEqual(1);
            expect(fmea.columns[0].dropdownOptions[0].description).toEqual("test");
            expect(fmea.columns[0].dropdownOptions[1].number).toEqual(2);
            expect(fmea.columns[0].dropdownOptions[1].description).toEqual("test2");
            expect(fmea.columns[0].dropdownOptions[2].number).toEqual(3);
            expect(fmea.columns[0].dropdownOptions[2].description).toEqual("test3");
        });
    });

    describe("deleteFmea",() => {
        it("should be defined",()=>{
            expect(fmeaController.deleteFmea).toBeDefined();
        });
        it("should delete the FMEA object",async()=>{
            const body = {"title":"test fmea1","description":"for test"}; 
            const createdFmea = await fmeaController.createFmea(body);
            const result = await fmeaController.deleteFmea(createdFmea.id);
            console.log(result);
            expect(result).toEqual(true);
        });

        it("should return false if FMEA object not found",async()=>{
            const result = await fmeaController.deleteFmea(1);
            expect(result).toEqual(false);
        });
    });

    describe("deleteColumn",() => {
        it("should be defined",()=>{
            expect(fmeaController.deleteColumn).toBeDefined();
        });
        it("should delete the column",async()=>{
            const body = {"title":"test fmea1","description":"for test"}; 
            const createdFmea = await fmeaController.createFmea(body);
            const addColumnObject = {
                name: "test",
                type: "dropdown",
                dropdownOptions: [{
                    number: 1,
                    description: "test"
                    },
                    {
                    number: 2,
                    description: "test2"
                  }
                ]
            }
            await fmeaController.addColumn(createdFmea.id,addColumnObject);
            const result = await fmeaController.deleteColumn(createdFmea.id,"test");
            expect(result).toBeDefined();
        });
    });

    describe("deleteRow",() => {
        it("should be defined",()=>{
            expect(fmeaController.deleteRow).toBeDefined();
        });
        it("should delete the row",async()=>{
            const body = {"title":"test fmea1","description":"for test"}; 
            const createdFmea = await fmeaController.createFmea(body);
            const addColumnObject = {"name":"test","type":"string"};
            await fmeaController.addColumn(createdFmea.id,addColumnObject);
            const returned_fmea= await fmeaController.addRow(createdFmea.id);
            const result = await fmeaController.deleteRow(createdFmea.id,returned_fmea?.rows[0].id);
            expect(result).toBeDefined();
            expect(result?.rows.length).toEqual(0);
        });
    });
});
