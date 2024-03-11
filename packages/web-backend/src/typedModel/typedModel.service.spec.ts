import { Connection } from "mongoose";
import { MongooseModule, getConnectionToken } from "@nestjs/mongoose";
import { Test, TestingModule } from "@nestjs/testing";
import { expect } from "@playwright/test";
import {
  ModelCounter,
  ModelCounterSchema,
} from "../schemas/model-counter.schema";
import { TypedModelService } from "./typedModel.service";
import {
  InternalEvents,
  InternalEventsSchema,
} from "./schemas/internal-events.schema";
import {
  InternalHazards,
  InternalHazardsSchema,
} from "./schemas/internal-hazards.schema";
import {
  ExternalHazards,
  ExternalHazardsSchema,
} from "./schemas/external-hazards.schema";
import { FullScope, FullScopeSchema } from "./schemas/full-scope.schema";
import { createFullScopeRequest } from "./stubs/createFullScopeRequest.stub";
import { createInternalEventRequest } from "./stubs/createInternalEventRequest.stub";
import { createInternalHazardRequest } from "./stubs/createInternalHazardRequest.stub";
import { createExternalHazardRequest } from "./stubs/createExternalHazardRequest.stub";
import { nestedObjects } from "./stubs/nestedModelArray.stub";

describe("CollabService", () => {
  let typedmodelService: TypedModelService;
  let connection: Connection;
  /**
   * Before all tests
   * Create a new mongoDB instance using MongoMemoryServer
   * Start the mongoDB server
   * Create a new Testing module
   * define connection and collabService
   */
  beforeAll(async () => {
    const mongoUri = process.env.MONGO_URI; //get the URI from the environment variable
    const module: TestingModule = await Test.createTestingModule({
      imports: [
        MongooseModule.forRoot(mongoUri),
        MongooseModule.forFeature([
          { name: ModelCounter.name, schema: ModelCounterSchema },
          { name: InternalEvents.name, schema: InternalEventsSchema },
          { name: InternalHazards.name, schema: InternalHazardsSchema },
          { name: ExternalHazards.name, schema: ExternalHazardsSchema },
          { name: FullScope.name, schema: FullScopeSchema },
        ]),
      ],
      providers: [TypedModelService],
    }).compile();
    connection = await module.get(getConnectionToken()); // create mongoose connection object to call functions like put, get, find
    typedmodelService = module.get<TypedModelService>(TypedModelService);
  });

  /**
   * After each test drop database
   */
  afterEach(async () => {
    await connection.dropDatabase();
  });

  /**
   * After all tests stop mongoDB server
   */
  afterAll(async () => {
    await connection.close();
  });

  describe("TypedModelService", () => {
    it("should be defined", () => {
      expect(typedmodelService).toBeDefined();
    });
  });

  describe("CreateInternalEventModel", () => {
    it("should be defined", () => {
      expect(typedmodelService.createInternalEventModel).toBeDefined();
    });

    it("should create a new internal event model", async () => {
      const internalEventObject = createInternalEventRequest;
      const internalEvent =
        await typedmodelService.createInternalEventModel(internalEventObject);
      expect(internalEvent).toBeDefined();
      expect(internalEvent.label.name).toEqual(internalEventObject.label.name);
      expect(internalEvent.label.description).toEqual(
        internalEventObject.label.description,
      );
      expect(internalEvent.users).toEqual(internalEventObject.users);
      expect(internalEvent.initiatingEvents).toEqual([]);
      expect(internalEvent.eventSequenceDiagrams).toEqual([]);
      expect(internalEvent.functionalEvents).toEqual([]);
      expect(internalEvent.eventTrees).toEqual([]);
      expect(internalEvent.faultTrees).toEqual([]);
      expect(internalEvent.bayesianNetworks).toEqual([]);
      expect(internalEvent.markovChains).toEqual([]);
      expect(internalEvent.bayesianEstimations).toEqual([]);
      expect(internalEvent.weibullAnalysis).toEqual([]);
    });
  });

  describe("CreateInternalHazardModel", () => {
    it("should be defined", () => {
      expect(typedmodelService.createInternalHazardModel).toBeDefined();
    });

    it("should create a new internal hazard model", async () => {
      const internalHazardObject = createInternalHazardRequest;
      const internalHazard =
        await typedmodelService.createInternalHazardModel(internalHazardObject);
      expect(internalHazard).toBeDefined();
      expect(internalHazard.label.name).toEqual(
        internalHazardObject.label.name,
      );
      expect(internalHazard.label.description).toEqual(
        internalHazardObject.label.description,
      );
      expect(internalHazard.users).toEqual(internalHazardObject.users);
      expect(internalHazard.initiatingEvents).toEqual([]);
      expect(internalHazard.eventSequenceDiagrams).toEqual([]);
      expect(internalHazard.functionalEvents).toEqual([]);
      expect(internalHazard.eventTrees).toEqual([]);
      expect(internalHazard.faultTrees).toEqual([]);
      expect(internalHazard.bayesianNetworks).toEqual([]);
      expect(internalHazard.markovChains).toEqual([]);
      expect(internalHazard.bayesianEstimations).toEqual([]);
      expect(internalHazard.weibullAnalysis).toEqual([]);
    });
  });

  describe("CreateExternalHazardModel", () => {
    it("should be defined", () => {
      expect(typedmodelService.createExternalHazardModel).toBeDefined();
    });

    it("should create a new external hazard model", async () => {
      const externalHazardObject = createExternalHazardRequest;
      const externalHazard =
        await typedmodelService.createExternalHazardModel(externalHazardObject);
      expect(externalHazard).toBeDefined();
      expect(externalHazard.label.name).toEqual(
        externalHazardObject.label.name,
      );
      expect(externalHazard.label.description).toEqual(
        externalHazardObject.label.description,
      );
      expect(externalHazard.users).toEqual(externalHazardObject.users);
      expect(externalHazard.initiatingEvents).toEqual([]);
      expect(externalHazard.eventSequenceDiagrams).toEqual([]);
      expect(externalHazard.functionalEvents).toEqual([]);
      expect(externalHazard.eventTrees).toEqual([]);
      expect(externalHazard.faultTrees).toEqual([]);
      expect(externalHazard.bayesianNetworks).toEqual([]);
      expect(externalHazard.markovChains).toEqual([]);
      expect(externalHazard.bayesianEstimations).toEqual([]);
      expect(externalHazard.weibullAnalysis).toEqual([]);
    });
  });

  describe("CreateFullScopeModel", () => {
    it("should be defined", () => {
      expect(typedmodelService.createFullScopeModel).toBeDefined();
    });

    it("should create a new full scope model", async () => {
      const fullScopeObject = createFullScopeRequest;
      const fullScope =
        await typedmodelService.createFullScopeModel(fullScopeObject);
      expect(fullScope).toBeDefined();
      expect(fullScope.label.name).toEqual(fullScopeObject.label.name);
      expect(fullScope.label.description).toEqual(
        fullScopeObject.label.description,
      );
      expect(fullScope.users).toEqual(fullScopeObject.users);
      expect(fullScope.initiatingEvents).toEqual([]);
      expect(fullScope.eventSequenceDiagrams).toEqual([]);
      expect(fullScope.functionalEvents).toEqual([]);
      expect(fullScope.eventTrees).toEqual([]);
      expect(fullScope.faultTrees).toEqual([]);
      expect(fullScope.bayesianNetworks).toEqual([]);
      expect(fullScope.markovChains).toEqual([]);
      expect(fullScope.bayesianEstimations).toEqual([]);
      expect(fullScope.weibullAnalysis).toEqual([]);
    });
  });

  describe("getInternalEvents", () => {
    it("should be defined", () => {
      expect(typedmodelService.getInternalEvents).toBeDefined();
    });

    it("should get all internal events - single event for a user", async () => {
      const internalEventObject = createInternalEventRequest;
      await typedmodelService.createInternalEventModel(internalEventObject);
      const internalEvents = await typedmodelService.getInternalEvents(1);
      expect(internalEvents).toBeDefined();
      expect(internalEvents.length).toEqual(1);
      expect(internalEvents[0].label.name).toEqual(
        internalEventObject.label.name,
      );
      expect(internalEvents[0].label.description).toEqual(
        internalEventObject.label.description,
      );
      expect(internalEvents[0].users).toEqual(internalEventObject.users);
      expect(internalEvents[0].initiatingEvents).toEqual([]);
      expect(internalEvents[0].eventSequenceDiagrams).toEqual([]);
      expect(internalEvents[0].functionalEvents).toEqual([]);
      expect(internalEvents[0].eventTrees).toEqual([]);
      expect(internalEvents[0].faultTrees).toEqual([]);
      expect(internalEvents[0].bayesianNetworks).toEqual([]);
      expect(internalEvents[0].markovChains).toEqual([]);
      expect(internalEvents[0].bayesianEstimations).toEqual([]);
      expect(internalEvents[0].weibullAnalysis).toEqual([]);
    });

    it("should get all internal events for a user - multiple events", async () => {
      const internalEventObject1 = createInternalEventRequest;
      await typedmodelService.createInternalEventModel(internalEventObject1);
      const internalEventObject2 = {
        label: {
          name: "Internal Event 2",
          description: "Description for Internal Event 2",
        },
        users: [1, 2],
      };
      await typedmodelService.createInternalEventModel(internalEventObject2);
      const internalEvents = await typedmodelService.getInternalEvents(1);
      expect(internalEvents).toBeDefined();
      expect(internalEvents.length).toEqual(2);
      expect(internalEvents[0].label.name).toEqual(
        internalEventObject1.label.name,
      );
      expect(internalEvents[0].label.description).toEqual(
        internalEventObject1.label.description,
      );
      expect(internalEvents[0].users).toEqual(internalEventObject1.users);
      expect(internalEvents[1].label.name).toEqual(
        internalEventObject2.label.name,
      );
      expect(internalEvents[1].label.description).toEqual(
        internalEventObject2.label.description,
      );
      expect(internalEvents[1].users).toEqual(internalEventObject2.users);
    });
  });

  describe("getInternalHazards", () => {
    it("should be defined", () => {
      expect(typedmodelService.getInternalHazards).toBeDefined();
    });

    it("should get all internal hazards - single hazard for a user", async () => {
      const internalHazardObject = createInternalHazardRequest;
      await typedmodelService.createInternalHazardModel(internalHazardObject);
      const internalHazards = await typedmodelService.getInternalHazards(1);
      expect(internalHazards).toBeDefined();
      expect(internalHazards.length).toEqual(1);
      expect(internalHazards[0].label.name).toEqual(
        internalHazardObject.label.name,
      );
      expect(internalHazards[0].label.description).toEqual(
        internalHazardObject.label.description,
      );
      expect(internalHazards[0].users).toEqual(internalHazardObject.users);
      expect(internalHazards[0].initiatingEvents).toEqual([]);
      expect(internalHazards[0].eventSequenceDiagrams).toEqual([]);
      expect(internalHazards[0].functionalEvents).toEqual([]);
      expect(internalHazards[0].eventTrees).toEqual([]);
      expect(internalHazards[0].faultTrees).toEqual([]);
      expect(internalHazards[0].bayesianNetworks).toEqual([]);
      expect(internalHazards[0].markovChains).toEqual([]);
      expect(internalHazards[0].bayesianEstimations).toEqual([]);
      expect(internalHazards[0].weibullAnalysis).toEqual([]);
    });

    it("should get all internal hazards for a user - multiple hazards", async () => {
      const internalHazardObject1 = createInternalHazardRequest;
      await typedmodelService.createInternalHazardModel(internalHazardObject1);
      const internalHazardObject2 = {
        label: {
          name: "Internal Hazard 2",
          description: "Description for Internal Hazard 2",
        },
        users: [1, 2],
      };
      await typedmodelService.createInternalHazardModel(internalHazardObject2);
      const internalHazards = await typedmodelService.getInternalHazards(1);
      expect(internalHazards).toBeDefined();
      expect(internalHazards.length).toEqual(2);
      expect(internalHazards[0].label.name).toEqual(
        internalHazardObject1.label.name,
      );
      expect(internalHazards[0].label.description).toEqual(
        internalHazardObject1.label.description,
      );
      expect(internalHazards[0].users).toEqual(internalHazardObject1.users);
      expect(internalHazards[1].label.name).toEqual(
        internalHazardObject2.label.name,
      );
      expect(internalHazards[1].label.description).toEqual(
        internalHazardObject2.label.description,
      );
      expect(internalHazards[1].users).toEqual(internalHazardObject2.users);
    });
  });

  describe("getExternalHazards", () => {
    it("should be defined", () => {
      expect(typedmodelService.getExternalHazards).toBeDefined();
    });

    it("should get all external hazards - single hazard for a user", async () => {
      const externalHazardObject = createExternalHazardRequest;
      await typedmodelService.createExternalHazardModel(externalHazardObject);
      const externalHazards = await typedmodelService.getExternalHazards(1);
      expect(externalHazards).toBeDefined();
      expect(externalHazards.length).toEqual(1);
      expect(externalHazards[0].label.name).toEqual(
        externalHazardObject.label.name,
      );
      expect(externalHazards[0].label.description).toEqual(
        externalHazardObject.label.description,
      );
      expect(externalHazards[0].users).toEqual(externalHazardObject.users);
      expect(externalHazards[0].initiatingEvents).toEqual([]);
      expect(externalHazards[0].eventSequenceDiagrams).toEqual([]);
      expect(externalHazards[0].functionalEvents).toEqual([]);
      expect(externalHazards[0].eventTrees).toEqual([]);
      expect(externalHazards[0].faultTrees).toEqual([]);
      expect(externalHazards[0].bayesianNetworks).toEqual([]);
      expect(externalHazards[0].markovChains).toEqual([]);
      expect(externalHazards[0].bayesianEstimations).toEqual([]);
      expect(externalHazards[0].weibullAnalysis).toEqual([]);
    });

    it("should get all external hazards for a user - multiple hazards", async () => {
      const externalHazardObject1 = createExternalHazardRequest;
      await typedmodelService.createExternalHazardModel(externalHazardObject1);
      const externalHazardObject2 = {
        label: {
          name: "External Hazard 2",
          description: "Description for External Hazard 2",
        },
        users: [1, 2],
      };
      await typedmodelService.createExternalHazardModel(externalHazardObject2);
      const externalHazards = await typedmodelService.getExternalHazards(1);
      expect(externalHazards).toBeDefined();
      expect(externalHazards.length).toEqual(2);
      expect(externalHazards[0].label.name).toEqual(
        externalHazardObject1.label.name,
      );
      expect(externalHazards[0].label.description).toEqual(
        externalHazardObject1.label.description,
      );
      expect(externalHazards[0].users).toEqual(externalHazardObject1.users);
      expect(externalHazards[1].label.name).toEqual(
        externalHazardObject2.label.name,
      );
      expect(externalHazards[1].label.description).toEqual(
        externalHazardObject2.label.description,
      );
      expect(externalHazards[1].users).toEqual(externalHazardObject2.users);
    });
  });

  describe("getFullScopes", () => {
    it("should be defined", () => {
      expect(typedmodelService.getFullScopes).toBeDefined();
    });

    it("should get all full scopes - single full scope for a user", async () => {
      const fullScopeObject = createFullScopeRequest;
      await typedmodelService.createFullScopeModel(fullScopeObject);
      const fullScopes = await typedmodelService.getFullScopes(1);
      expect(fullScopes).toBeDefined();
      expect(fullScopes.length).toEqual(1);
      expect(fullScopes[0].label.name).toEqual(fullScopeObject.label.name);
      expect(fullScopes[0].label.description).toEqual(
        fullScopeObject.label.description,
      );
      expect(fullScopes[0].users).toEqual(fullScopeObject.users);
      expect(fullScopes[0].initiatingEvents).toEqual([]);
      expect(fullScopes[0].eventSequenceDiagrams).toEqual([]);
      expect(fullScopes[0].functionalEvents).toEqual([]);
      expect(fullScopes[0].eventTrees).toEqual([]);
      expect(fullScopes[0].faultTrees).toEqual([]);
      expect(fullScopes[0].bayesianNetworks).toEqual([]);
      expect(fullScopes[0].markovChains).toEqual([]);
      expect(fullScopes[0].bayesianEstimations).toEqual([]);
      expect(fullScopes[0].weibullAnalysis).toEqual([]);
    });

    it("should get all full scopes for a user - multiple full scopes", async () => {
      const fullScopeObject1 = createFullScopeRequest;
      await typedmodelService.createFullScopeModel(fullScopeObject1);
      const fullScopeObject2 = {
        label: {
          name: "Full Scope 2",
          description: "Description for Full Scope 2",
        },
        users: [1, 2],
      };
      await typedmodelService.createFullScopeModel(fullScopeObject2);
      const fullScopes = await typedmodelService.getFullScopes(1);
      expect(fullScopes).toBeDefined();
      expect(fullScopes.length).toEqual(2);
      expect(fullScopes[0].label.name).toEqual(fullScopeObject1.label.name);
      expect(fullScopes[0].label.description).toEqual(
        fullScopeObject1.label.description,
      );
      expect(fullScopes[0].users).toEqual(fullScopeObject1.users);
      expect(fullScopes[1].label.name).toEqual(fullScopeObject2.label.name);
      expect(fullScopes[1].label.description).toEqual(
        fullScopeObject2.label.description,
      );
      expect(fullScopes[1].users).toEqual(fullScopeObject2.users);
    });
  });

  describe("getInternalEvent", () => {
    it("should be defined", () => {
      expect(typedmodelService.getInternalEvent).toBeDefined();
    });

    it("should get internal event", async () => {
      const internalEventObject = createInternalEventRequest;
      const internalEvent =
        await typedmodelService.createInternalEventModel(internalEventObject);
      //convert the id to a string
      const modelId = internalEvent.id.toString();
      const internalEventReturned = await typedmodelService.getInternalEvent(
        modelId,
        internalEventObject.users[0],
      );
      expect(internalEventReturned).toBeDefined();
      expect(internalEventReturned.label.name).toEqual(
        internalEventObject.label.name,
      );
      expect(internalEventReturned.label.description).toEqual(
        internalEventObject.label.description,
      );
      expect(internalEventReturned.users).toEqual(internalEventObject.users);
      expect(internalEventReturned.initiatingEvents).toEqual([]);
    });

    it("should return null if internal event not associated with user", async () => {
      const internalEvent = await typedmodelService.createInternalEventModel(
        createInternalEventRequest,
      );
      const modelId = internalEvent.id.toString();
      const internalEventReturned = await typedmodelService.getInternalEvent(
        modelId,
        4,
      );
      expect(internalEventReturned).toBeNull();
    });

    it("should return null if internal event not found", async () => {
      const internalEventReturned = await typedmodelService.getInternalEvent(
        "123",
        1,
      );
      expect(internalEventReturned).toBeNull();
    });
  });

  describe("getInternalHazard", () => {
    it("should be defined", () => {
      expect(typedmodelService.getInternalHazard).toBeDefined();
    });

    it("should get internal hazard", async () => {
      const internalHazardObject = createInternalHazardRequest;
      const internalHazard =
        await typedmodelService.createInternalHazardModel(internalHazardObject);
      const modelId = internalHazard.id.toString();
      const internalHazardReturned = await typedmodelService.getInternalHazard(
        modelId,
        internalHazardObject.users[0],
      );
      expect(internalHazardReturned).toBeDefined();
      expect(internalHazardReturned.label.name).toEqual(
        internalHazardObject.label.name,
      );
      expect(internalHazardReturned.label.description).toEqual(
        internalHazardObject.label.description,
      );
      expect(internalHazardReturned.users).toEqual(internalHazardObject.users);
      expect(internalHazardReturned.initiatingEvents).toEqual([]);
    });

    it("should return null if internal hazard not associated with user", async () => {
      const internalHazard = await typedmodelService.createInternalHazardModel(
        createInternalHazardRequest,
      );
      const modelId = internalHazard.id.toString();
      const internalHazardReturned = await typedmodelService.getInternalHazard(
        modelId,
        4,
      );
      expect(internalHazardReturned).toBeNull();
    });

    it("should return null if internal hazard not found", async () => {
      const internalHazardReturned = await typedmodelService.getInternalHazard(
        "123",
        1,
      );
      expect(internalHazardReturned).toBeNull();
    });
  });

  describe("getExternalHazard", () => {
    it("should be defined", () => {
      expect(typedmodelService.getExternalHazard).toBeDefined();
    });

    it("should get external hazard", async () => {
      const externalHazardObject = createExternalHazardRequest;
      const externalHazard =
        await typedmodelService.createExternalHazardModel(externalHazardObject);
      const modelId = externalHazard.id.toString();
      const externalHazardReturned = await typedmodelService.getExternalHazard(
        modelId,
        externalHazardObject.users[0],
      );
      expect(externalHazardReturned).toBeDefined();
      expect(externalHazardReturned.label.name).toEqual(
        externalHazardObject.label.name,
      );
      expect(externalHazardReturned.label.description).toEqual(
        externalHazardObject.label.description,
      );
      expect(externalHazardReturned.users).toEqual(externalHazardObject.users);
      expect(externalHazardReturned.initiatingEvents).toEqual([]);
    });

    it("should return null if external hazard not associated with user", async () => {
      const externalHazard = await typedmodelService.createExternalHazardModel(
        createExternalHazardRequest,
      );
      const modelId = externalHazard.id.toString();
      const externalHazardReturned = await typedmodelService.getExternalHazard(
        modelId,
        4,
      );
      expect(externalHazardReturned).toBeNull();
    });

    it("should return null if external hazard not found", async () => {
      const externalHazardReturned = await typedmodelService.getExternalHazard(
        "123",
        1,
      );
      expect(externalHazardReturned).toBeNull();
    });
  });

  describe("getFullScope", () => {
    it("should be defined", () => {
      expect(typedmodelService.getFullScope).toBeDefined();
    });

    it("should get full scope", async () => {
      const fullScopeObject = createFullScopeRequest;
      const fullScope =
        await typedmodelService.createFullScopeModel(fullScopeObject);
      const modelId = fullScope.id.toString();
      const fullScopeReturned = await typedmodelService.getFullScope(
        modelId,
        fullScopeObject.users[0],
      );
      expect(fullScopeReturned).toBeDefined();
      expect(fullScopeReturned.label.name).toEqual(fullScopeObject.label.name);
      expect(fullScopeReturned.label.description).toEqual(
        fullScopeObject.label.description,
      );
      expect(fullScopeReturned.users).toEqual(fullScopeObject.users);
      expect(fullScopeReturned.initiatingEvents).toEqual([]);
    });

    it("should return null if full scope not associated with user", async () => {
      const fullScope = await typedmodelService.createFullScopeModel(
        createFullScopeRequest,
      );
      const modelId = fullScope.id.toString();
      const fullScopeReturned = await typedmodelService.getFullScope(
        modelId,
        4,
      );
      expect(fullScopeReturned).toBeNull();
    });

    it("should return null if full scope not found", async () => {
      const fullScopeReturned = await typedmodelService.getFullScope("123", 1);
      expect(fullScopeReturned).toBeNull();
    });
  });

  describe("deleteInternalEvent", () => {
    it("should be defined", () => {
      expect(typedmodelService.deleteInternalEvent).toBeDefined();
    });

    it("should remove user when there are multiple users associated with model", async () => {
      const internalEventObject = createInternalEventRequest;
      const internalEvent =
        await typedmodelService.createInternalEventModel(internalEventObject);
      const internalEventReturned = await typedmodelService.deleteInternalEvent(
        internalEvent.id,
        internalEventObject.users[0],
      );
      expect(internalEventReturned).toBeDefined();
      const getInternalEventModel = await typedmodelService.getInternalEvent(
        internalEvent.id.toString(),
        internalEventObject.users[1],
      );
      expect(getInternalEventModel).toBeDefined();
      expect(getInternalEventModel.users).toEqual([2, 3]);
    });

    it("should remove model if only one user associated with model", async () => {
      const internalEventObject = createInternalEventRequest;
      const internalEvent =
        await typedmodelService.createInternalEventModel(internalEventObject);
      const returnedObject = await typedmodelService.deleteInternalEvent(
        internalEvent.id,
        internalEventObject.users[0],
      );
      expect(returnedObject).toBeDefined();
      const getInternalEventModel = await typedmodelService.getInternalEvent(
        internalEvent.id.toString(),
        internalEventObject.users[0],
      );
      expect(getInternalEventModel).toBeNull();
    });
  });

  describe("deleteFullScope", () => {
    it("should be defined", () => {
      expect(typedmodelService.deleteFullScope).toBeDefined();
    });
    it("should delete Full Scope Model", async () => {
      const fullScope = await typedmodelService.createFullScopeModel(
        createFullScopeRequest,
      );
      const returnedObject = await typedmodelService.deleteFullScope(
        fullScope.id,
        fullScope.users[0],
      );
      expect(returnedObject).toBeDefined();
      expect(returnedObject.users).toEqual([2, 3]);
    });
  });

  describe("addNestedToInternalEvent", () => {
    it("should be defined", () => {
      expect(typedmodelService.addNestedToInternalEvent).toBeDefined();
    });

    it("should add nested model to internal event", async () => {
      const internalEventObject = createInternalEventRequest;
      const internalEvent =
        await typedmodelService.createInternalEventModel(internalEventObject);
      const nestedObject = {
        modelId: internalEvent.id,
        nestedId: 9,
        nestedType: "faultTrees",
      };
      const returnedObject = await typedmodelService.addNestedToInternalEvent(
        nestedObject.modelId,
        nestedObject.nestedId,
        nestedObject.nestedType,
      );

      expect(returnedObject).toBeDefined();
      const latestInternalEvent = await typedmodelService.getInternalEvent(
        internalEvent.id.toString(),
        internalEventObject.users[0],
      );
      expect(latestInternalEvent.faultTrees).toEqual([9]);
    });

    it("should add events of type initiatingEvents, eventSequenceDiagrams, functionalEvents, faultTrees, eventTrees, bayesianNetworks, markovChains, bayesianEstimations, weibullAnalysis", async () => {
      const internalEventObject = createInternalEventRequest;
      const internalEvent =
        await typedmodelService.createInternalEventModel(internalEventObject);
      //create an array containing all nested objects

      //add each nested object to the internal event
      for (const nestedObject of nestedObjects) {
        await typedmodelService.addNestedToInternalEvent(
          internalEvent.id,
          nestedObject.nestedId,
          nestedObject.nestedType,
        );
      }

      const latestInternalEvent = await typedmodelService.getInternalEvent(
        internalEvent.id.toString(),
        internalEventObject.users[0],
      );
      expect(latestInternalEvent.initiatingEvents).toEqual([9]);
      expect(latestInternalEvent.eventSequenceDiagrams).toEqual([10]);
      expect(latestInternalEvent.functionalEvents).toEqual([11]);
      expect(latestInternalEvent.faultTrees).toEqual([12]);
      expect(latestInternalEvent.eventTrees).toEqual([13]);
      expect(latestInternalEvent.bayesianNetworks).toEqual([14]);
      expect(latestInternalEvent.markovChains).toEqual([15]);
      expect(latestInternalEvent.bayesianEstimations).toEqual([16]);
      expect(latestInternalEvent.weibullAnalysis).toEqual([17]);
    });
  });

  describe("addNestedToInternalHazard", () => {
    it("should be defined", () => {
      expect(typedmodelService.addNestedToInternalHazard).toBeDefined();
    });

    it("should add nested model to internal hazard", async () => {
      const internalHazardObject = createInternalHazardRequest;
      const internalHazard =
        await typedmodelService.createInternalHazardModel(internalHazardObject);
      const nestedObject = {
        modelId: internalHazard.id,
        nestedId: 9,
        nestedType: "faultTrees",
      };
      const returnedObject = await typedmodelService.addNestedToInternalHazard(
        nestedObject.modelId,
        nestedObject.nestedId,
        nestedObject.nestedType,
      );
      expect(returnedObject).toBeDefined();
      const latestInternalHazard = await typedmodelService.getInternalHazard(
        internalHazard.id.toString(),
        internalHazardObject.users[0],
      );
      expect(latestInternalHazard.faultTrees).toEqual([9]);
    });

    it("should add events of type initiatingEvents, eventSequenceDiagrams, functionalEvents, faultTrees, eventTrees, bayesianNetworks, markovChains, bayesianEstimations, weibullAnalysis", async () => {
      const internalHazard = await typedmodelService.createInternalHazardModel(
        createInternalHazardRequest,
      );
      //create an array containing all nested objects

      //add each nested object to the internal hazard
      for (const nestedObject of nestedObjects) {
        await typedmodelService.addNestedToInternalHazard(
          internalHazard.id,
          nestedObject.nestedId,
          nestedObject.nestedType,
        );
      }

      const latestInternalHazard = await typedmodelService.getInternalHazard(
        internalHazard.id.toString(),
        internalHazard.users[0],
      );
      expect(latestInternalHazard.initiatingEvents).toEqual([9]);
      expect(latestInternalHazard.eventSequenceDiagrams).toEqual([10]);
      expect(latestInternalHazard.functionalEvents).toEqual([11]);
      expect(latestInternalHazard.faultTrees).toEqual([12]);
      expect(latestInternalHazard.eventTrees).toEqual([13]);
      expect(latestInternalHazard.bayesianNetworks).toEqual([14]);
      expect(latestInternalHazard.markovChains).toEqual([15]);
      expect(latestInternalHazard.bayesianEstimations).toEqual([16]);
      expect(latestInternalHazard.weibullAnalysis).toEqual([17]);
    });
  });

  describe("addNestedToExternalHazard", () => {
    it("should be defined", () => {
      expect(typedmodelService.addNestedToExternalHazard).toBeDefined();
    });

    it("should add nested model to external hazard", async () => {
      const externalHazard = await typedmodelService.createExternalHazardModel(
        createExternalHazardRequest,
      );
      const nestedObject = {
        modelId: externalHazard.id,
        nestedId: 9,
        nestedType: "faultTrees",
      };
      const returnedObject = await typedmodelService.addNestedToExternalHazard(
        nestedObject.modelId,
        nestedObject.nestedId,
        nestedObject.nestedType,
      );

      expect(returnedObject).toBeDefined();
      const latestExternalHazard = await typedmodelService.getExternalHazard(
        externalHazard.id.toString(),
        externalHazard.users[0],
      );
      expect(latestExternalHazard.faultTrees).toEqual([9]);
    });

    it("should add events of type initiatingEvents, eventSequenceDiagrams, functionalEvents, faultTrees, eventTrees, bayesianNetworks, markovChains, bayesianEstimations, weibullAnalysis", async () => {
      const externalHazard = await typedmodelService.createExternalHazardModel(
        createExternalHazardRequest,
      );
      //create an array containing all nested objects

      //add each nested object to the external hazard
      for (const nestedObject of nestedObjects) {
        await typedmodelService.addNestedToExternalHazard(
          externalHazard.id,
          nestedObject.nestedId,
          nestedObject.nestedType,
        );
      }

      const latestExternalHazard = await typedmodelService.getExternalHazard(
        externalHazard.id.toString(),
        externalHazard.users[0],
      );
      expect(latestExternalHazard.initiatingEvents).toEqual([9]);
      expect(latestExternalHazard.eventSequenceDiagrams).toEqual([10]);
      expect(latestExternalHazard.functionalEvents).toEqual([11]);
      expect(latestExternalHazard.faultTrees).toEqual([12]);
      expect(latestExternalHazard.eventTrees).toEqual([13]);
      expect(latestExternalHazard.bayesianNetworks).toEqual([14]);
      expect(latestExternalHazard.markovChains).toEqual([15]);
      expect(latestExternalHazard.bayesianEstimations).toEqual([16]);
      expect(latestExternalHazard.weibullAnalysis).toEqual([17]);
    });
  });

  describe("addNestedToFullScope", () => {
    it("should be defined", () => {
      expect(typedmodelService.addNestedToFullScope).toBeDefined();
    });

    it("should add nested model to full scope", async () => {
      const fullScope = await typedmodelService.createFullScopeModel(
        createFullScopeRequest,
      );
      const nestedObject = {
        modelId: fullScope.id,
        nestedId: 9,
        nestedType: "faultTrees",
      };
      const returnedObject = await typedmodelService.addNestedToFullScope(
        nestedObject.modelId,
        nestedObject.nestedId,
        nestedObject.nestedType,
      );

      expect(returnedObject).toBeDefined();
      const latestFullScope = await typedmodelService.getFullScope(
        fullScope.id.toString(),
        fullScope.users[0],
      );
      expect(latestFullScope.faultTrees).toEqual([9]);
    });

    it("should add events of type initiatingEvents, eventSequenceDiagrams, functionalEvents, faultTrees, eventTrees, bayesianNetworks, markovChains, bayesianEstimations, weibullAnalysis", async () => {
      const fullScope = await typedmodelService.createFullScopeModel(
        createFullScopeRequest,
      );
      //create an array containing all nested objects

      //add each nested object to the full scope
      for (const nestedObject of nestedObjects) {
        await typedmodelService.addNestedToFullScope(
          fullScope.id,
          nestedObject.nestedId,
          nestedObject.nestedType,
        );
      }

      const latestFullScope = await typedmodelService.getFullScope(
        fullScope.id.toString(),
        fullScope.users[0],
      );
      expect(latestFullScope.initiatingEvents).toEqual([9]);
      expect(latestFullScope.eventSequenceDiagrams).toEqual([10]);
      expect(latestFullScope.functionalEvents).toEqual([11]);
      expect(latestFullScope.faultTrees).toEqual([12]);
      expect(latestFullScope.eventTrees).toEqual([13]);
      expect(latestFullScope.bayesianNetworks).toEqual([14]);
      expect(latestFullScope.markovChains).toEqual([15]);
      expect(latestFullScope.bayesianEstimations).toEqual([16]);
      expect(latestFullScope.weibullAnalysis).toEqual([17]);
    });
  });

  describe("deleteNestedFromInternalEvent", () => {
    it("should be defined", () => {
      expect(typedmodelService.deleteNestedFromInternalEvent).toBeDefined();
    });

    it("should remove nested model from internal event", async () => {
      const internalEvent = await typedmodelService.createInternalEventModel(
        createInternalEventRequest,
      );
      const nestedObject = {
        modelId: internalEvent.id,
        nestedId: 9,
        nestedType: "faultTrees",
      };
      await typedmodelService.addNestedToInternalEvent(
        nestedObject.modelId,
        nestedObject.nestedId,
        nestedObject.nestedType,
      );
      const returnedObject =
        await typedmodelService.deleteNestedFromInternalEvent(
          nestedObject.modelId.toString(),
          nestedObject.nestedId,
          nestedObject.nestedType,
        );
      expect(returnedObject).toBeDefined();
      const latestInternalEvent = await typedmodelService.getInternalEvent(
        internalEvent.id.toString(),
        internalEvent.users[0],
      );
      expect(latestInternalEvent.faultTrees).toEqual([]);
    });

    it("should delete all types of nested models", async () => {
      const internalEvent = await typedmodelService.createInternalEventModel(
        createInternalEventRequest,
      );
      //create an array containing all nested objects

      //add each nested object to the internal event
      for (const nestedObject of nestedObjects) {
        await typedmodelService.addNestedToInternalEvent(
          internalEvent.id,
          nestedObject.nestedId,
          nestedObject.nestedType,
        );
      }

      //delete each nested object from the internal event
      for (const nestedObject of nestedObjects) {
        await typedmodelService.deleteNestedFromInternalEvent(
          internalEvent.id.toString(),
          nestedObject.nestedId,
          nestedObject.nestedType,
        );
      }

      const latestInternalEvent = await typedmodelService.getInternalEvent(
        internalEvent.id.toString(),
        internalEvent.users[0],
      );
      expect(latestInternalEvent.initiatingEvents).toEqual([]);
      expect(latestInternalEvent.eventSequenceDiagrams).toEqual([]);
      expect(latestInternalEvent.functionalEvents).toEqual([]);
      expect(latestInternalEvent.faultTrees).toEqual([]);
      expect(latestInternalEvent.eventTrees).toEqual([]);
      expect(latestInternalEvent.bayesianNetworks).toEqual([]);
      expect(latestInternalEvent.markovChains).toEqual([]);
      expect(latestInternalEvent.bayesianEstimations).toEqual([]);
      expect(latestInternalEvent.weibullAnalysis).toEqual([]);
    });
  });

  describe("deleteNestedFromInternalHazard", () => {
    it("should be defined", () => {
      expect(typedmodelService.deleteNestedFromInternalHazard).toBeDefined();
    });

    it("should remove nested model from internal hazard", async () => {
      const internalHazard = await typedmodelService.createInternalHazardModel(
        createInternalHazardRequest,
      );
      const nestedObject = {
        modelId: internalHazard.id,
        nestedId: 9,
        nestedType: "faultTrees",
      };
      await typedmodelService.addNestedToInternalHazard(
        nestedObject.modelId,
        nestedObject.nestedId,
        nestedObject.nestedType,
      );
      const returnedObject =
        await typedmodelService.deleteNestedFromInternalHazard(
          nestedObject.modelId.toString(),
          nestedObject.nestedId,
          nestedObject.nestedType,
        );
      expect(returnedObject).toBeDefined();
      const latestInternalHazard = await typedmodelService.getInternalHazard(
        internalHazard.id.toString(),
        internalHazard.users[0],
      );
      expect(latestInternalHazard.faultTrees).toEqual([]);
    });

    it("should delete all types of nested models", async () => {
      const internalHazard = await typedmodelService.createInternalHazardModel(
        createInternalHazardRequest,
      );
      //create an array containing all nested objects

      //add each nested object to the internal hazard
      for (const nestedObject of nestedObjects) {
        await typedmodelService.addNestedToInternalHazard(
          internalHazard.id,
          nestedObject.nestedId,
          nestedObject.nestedType,
        );
      }

      //delete each nested object from the internal hazard
      for (const nestedObject of nestedObjects) {
        await typedmodelService.deleteNestedFromInternalHazard(
          internalHazard.id.toString(),
          nestedObject.nestedId,
          nestedObject.nestedType,
        );
      }

      const latestInternalHazard = await typedmodelService.getInternalHazard(
        internalHazard.id.toString(),
        internalHazard.users[0],
      );
      expect(latestInternalHazard.initiatingEvents).toEqual([]);
      expect(latestInternalHazard.eventSequenceDiagrams).toEqual([]);
      expect(latestInternalHazard.functionalEvents).toEqual([]);
      expect(latestInternalHazard.faultTrees).toEqual([]);
      expect(latestInternalHazard.eventTrees).toEqual([]);
      expect(latestInternalHazard.bayesianNetworks).toEqual([]);
      expect(latestInternalHazard.markovChains).toEqual([]);
      expect(latestInternalHazard.bayesianEstimations).toEqual([]);
      expect(latestInternalHazard.weibullAnalysis).toEqual([]);
    });
  });

  describe("deleteNestedFromExternalHazard", () => {
    it("should be defined", () => {
      expect(typedmodelService.deleteNestedFromExternalHazard).toBeDefined();
    });

    it("should remove nested model from external hazard", async () => {
      const externalHazard = await typedmodelService.createExternalHazardModel(
        createExternalHazardRequest,
      );
      const nestedObject = {
        modelId: externalHazard.id,
        nestedId: 9,
        nestedType: "faultTrees",
      };
      await typedmodelService.addNestedToExternalHazard(
        nestedObject.modelId,
        nestedObject.nestedId,
        nestedObject.nestedType,
      );
      const returnedObject =
        await typedmodelService.deleteNestedFromExternalHazard(
          nestedObject.modelId.toString(),
          nestedObject.nestedId,
          nestedObject.nestedType,
        );
      expect(returnedObject).toBeDefined();
      const latestExternalHazard = await typedmodelService.getExternalHazard(
        externalHazard.id.toString(),
        externalHazard.users[0],
      );
      expect(latestExternalHazard.faultTrees).toEqual([]);
    });

    it("should delete all types of nested models", async () => {
      const externalHazard = await typedmodelService.createExternalHazardModel(
        createExternalHazardRequest,
      );
      //create an array containing all nested objects

      //add each nested object to the external hazard
      for (const nestedObject of nestedObjects) {
        await typedmodelService.addNestedToExternalHazard(
          externalHazard.id,
          nestedObject.nestedId,
          nestedObject.nestedType,
        );
      }

      //delete each nested object from the external hazard
      for (const nestedObject of nestedObjects) {
        await typedmodelService.deleteNestedFromExternalHazard(
          externalHazard.id.toString(),
          nestedObject.nestedId,
          nestedObject.nestedType,
        );
      }

      const latestExternalHazard = await typedmodelService.getExternalHazard(
        externalHazard.id.toString(),
        externalHazard.users[0],
      );
      expect(latestExternalHazard.initiatingEvents).toEqual([]);
      expect(latestExternalHazard.eventSequenceDiagrams).toEqual([]);
      expect(latestExternalHazard.functionalEvents).toEqual([]);
      expect(latestExternalHazard.faultTrees).toEqual([]);
      expect(latestExternalHazard.eventTrees).toEqual([]);
      expect(latestExternalHazard.bayesianNetworks).toEqual([]);
      expect(latestExternalHazard.markovChains).toEqual([]);
      expect(latestExternalHazard.bayesianEstimations).toEqual([]);
      expect(latestExternalHazard.weibullAnalysis).toEqual([]);
    });
  });

  describe("deleteNestedFromFullScope", () => {
    it("should be defined", () => {
      expect(typedmodelService.deleteNestedFromFullScope).toBeDefined();
    });

    it("should remove nested model from full scope", async () => {
      const fullScope = await typedmodelService.createFullScopeModel(
        createFullScopeRequest,
      );
      const nestedObject = {
        modelId: fullScope.id,
        nestedId: 9,
        nestedType: "faultTrees",
      };
      await typedmodelService.addNestedToFullScope(
        nestedObject.modelId,
        nestedObject.nestedId,
        nestedObject.nestedType,
      );
      const returnedObject = await typedmodelService.deleteNestedFromFullScope(
        nestedObject.modelId.toString(),
        nestedObject.nestedId,
        nestedObject.nestedType,
      );
      expect(returnedObject).toBeDefined();
      const latestFullScope = await typedmodelService.getFullScope(
        fullScope.id.toString(),
        fullScope.users[0],
      );
      expect(latestFullScope.faultTrees).toEqual([]);
    });

    it("should delete all types of nested models", async () => {
      const fullScope = await typedmodelService.createFullScopeModel(
        createFullScopeRequest,
      );
      //create an array containing all nested objects

      //add each nested object to the full scope
      for (const nestedObject of nestedObjects) {
        await typedmodelService.addNestedToFullScope(
          fullScope.id,
          nestedObject.nestedId,
          nestedObject.nestedType,
        );
      }

      //delete each nested object from the full scope
      for (const nestedObject of nestedObjects) {
        await typedmodelService.deleteNestedFromFullScope(
          fullScope.id.toString(),
          nestedObject.nestedId,
          nestedObject.nestedType,
        );
      }

      const latestFullScope = await typedmodelService.getFullScope(
        fullScope.id.toString(),
        fullScope.users[0],
      );
      expect(latestFullScope.initiatingEvents).toEqual([]);
      expect(latestFullScope.eventSequenceDiagrams).toEqual([]);
      expect(latestFullScope.functionalEvents).toEqual([]);
      expect(latestFullScope.faultTrees).toEqual([]);
      expect(latestFullScope.eventTrees).toEqual([]);
      expect(latestFullScope.bayesianNetworks).toEqual([]);
      expect(latestFullScope.markovChains).toEqual([]);
      expect(latestFullScope.bayesianEstimations).toEqual([]);
      expect(latestFullScope.weibullAnalysis).toEqual([]);
    });
  });
});
