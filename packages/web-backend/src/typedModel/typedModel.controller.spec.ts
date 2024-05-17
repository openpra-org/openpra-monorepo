import { expect } from "@playwright/test";
import { Connection } from "mongoose";
import { getConnectionToken, MongooseModule } from "@nestjs/mongoose";
import { Test, TestingModule } from "@nestjs/testing";
import { ModelCounter, ModelCounterSchema } from "../schemas/model-counter.schema";
import { TypedModelController } from "./typedModel.controller";
import { TypedModelService } from "./typedModel.service";
import { InternalEvents, InternalEventsSchema } from "./schemas/internal-events.schema";
import { InternalHazards, InternalHazardsSchema } from "./schemas/internal-hazards.schema";
import { ExternalHazards, ExternalHazardsSchema } from "./schemas/external-hazards.schema";
import { FullScope, FullScopeSchema } from "./schemas/full-scope.schema";

import { createFullScopeRequest } from "./stubs/createFullScopeRequest.stub";
import { createInternalEventRequest } from "./stubs/createInternalEventRequest.stub";
import { createInternalHazardRequest } from "./stubs/createInternalHazardRequest.stub";
import { createExternalHazardRequest } from "./stubs/createExternalHazardRequest.stub";
import { nestedObjects } from "./stubs/nestedModelArray.stub";
import { request } from "./stubs/request.stub";

describe("TypedModel Controller", () => {
  let typedModelController: TypedModelController;
  let connection: Connection;

  /**
   *
   * Read the URI from the environment variable and connect to the database
   * Create a test module with the TypedModelService and TypedModelController
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
      providers: [TypedModelService, TypedModelController],
    }).compile();
    typedModelController = module.get<TypedModelController>(TypedModelController);
    connection = module.get(getConnectionToken());
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

  describe("createInternalEvent", () => {
    it("should be defined", () => {
      expect(typedModelController.createInternalEvent).toBeDefined();
    });

    /**
     * Create an Internal Event using the createInternalEventRequest stub
     * Check if the created Internal Event has the correct properties
     */
    it("Should return the newly created Internal Event Model", async () => {
      const createdInternalEvent = await typedModelController.createInternalEvent(createInternalEventRequest);
      expect(createdInternalEvent).toBeDefined();
      expect(createdInternalEvent).toHaveProperty("id");
      expect(createdInternalEvent.users).toEqual([1, 2, 3]);
      expect(createdInternalEvent.label.name).toEqual("Internal Event Model");
      expect(createdInternalEvent.initiatingEvents).toEqual([]);
    });

    /**
     * Create two Internal Events using the createInternalEventRequest stub
     * check is IDs are generated incrementally
     */
    it("should create multiple internal events", async () => {
      const createdInternalEvent = await typedModelController.createInternalEvent(createInternalEventRequest);
      const createdInternalEvent2 = await typedModelController.createInternalEvent(createInternalEventRequest);
      expect(createdInternalEvent).toBeDefined();
      expect(createdInternalEvent2).toBeDefined();
      expect(createdInternalEvent.id).toEqual(1);
      expect(createdInternalEvent2.id).toEqual(2);
    });
  });

  describe("createInternalHazard", () => {
    it("should be defined", () => {
      expect(typedModelController.createInternalHazard).toBeDefined();
    });

    /**
     * Create an Internal Hazard using the createInternalHazardRequest stub
     * Check if the created Internal Hazard has the correct properties
     */
    it("Should return the newly created Internal Hazard Model", async () => {
      const createdInternalHazard = await typedModelController.createInternalHazard(createInternalHazardRequest);

      expect(createdInternalHazard).toBeDefined();
      expect(createdInternalHazard).toHaveProperty("id");
      expect(createdInternalHazard.users).toEqual([1, 2, 3]);
      expect(createdInternalHazard.label.name).toEqual("Internal Hazard Model");
      expect(createdInternalHazard.initiatingEvents).toEqual([]);
    });

    /**
     *
     * Create two Internal Hazards using the createInternalHazardRequest stub
     * check is IDs are generated incrementally
     */
    it("should create multiple internal hazards", async () => {
      const createdInternalHazard = await typedModelController.createInternalHazard(createInternalHazardRequest);
      const createdInternalHazard2 = await typedModelController.createInternalHazard(createInternalHazardRequest);
      expect(createdInternalHazard).toBeDefined();
      expect(createdInternalHazard2).toBeDefined();
      expect(createdInternalHazard.id).toEqual(1);
      expect(createdInternalHazard2.id).toEqual(2);
    });
  });

  describe("createExternalHazard", () => {
    it("should be defined", () => {
      expect(typedModelController.createExternalHazard).toBeDefined();
    });

    /**
     * Create an External Hazard using the createExternalHazardRequest stub
     * Check if the created External Hazard has the correct properties
     */
    it("Should return the newly created External Hazard Model", async () => {
      const createdExternalHazard = await typedModelController.createExternalHazard(createExternalHazardRequest);
      expect(createdExternalHazard).toBeDefined();
      expect(createdExternalHazard).toHaveProperty("id");
      expect(createdExternalHazard.users).toEqual([1, 2, 3]);
      expect(createdExternalHazard.label.name).toEqual("External Hazard Model");
      expect(createdExternalHazard.initiatingEvents).toEqual([]);
    });

    /**
     * Create two External Hazards using the createExternalHazardRequest stub
     * check is IDs are generated incrementally
     */
    it("should create multiple external hazards", async () => {
      const createdExternalHazard = await typedModelController.createExternalHazard(createExternalHazardRequest);
      const createdExternalHazard2 = await typedModelController.createExternalHazard(createExternalHazardRequest);
      expect(createdExternalHazard).toBeDefined();
      expect(createdExternalHazard2).toBeDefined();
      expect(createdExternalHazard.id).toEqual(1);
      expect(createdExternalHazard2.id).toEqual(2);
    });
  });

  describe("createFullScope", () => {
    it("should be defined", () => {
      expect(typedModelController.createFullScope).toBeDefined();
    });

    /**
     * Create a Full Scope using the createFullScopeRequest stub
     * Check if the created Full Scope has the correct properties
     */
    it("Should return the newly created Full Scope Model", async () => {
      const createdFullScope = await typedModelController.createFullScope(createFullScopeRequest);
      expect(createdFullScope).toBeDefined();
      expect(createdFullScope).toHaveProperty("id");
      expect(createdFullScope.users).toEqual([1, 2, 3]);
      expect(createdFullScope.label.name).toEqual("Full Scope Model");
      expect(createdFullScope.initiatingEvents).toEqual([]);
    });

    /**
     * Create two Full Scopes using the createFullScopeRequest stub
     * check is IDs are generated incrementally
     */
    it("should create multiple full scopes", async () => {
      const createdFullScope = await typedModelController.createFullScope(createFullScopeRequest);
      const createdFullScope2 = await typedModelController.createFullScope(createFullScopeRequest);
      expect(createdFullScope).toBeDefined();
      expect(createdFullScope2).toBeDefined();
      expect(createdFullScope.id).toEqual(1);
      expect(createdFullScope2.id).toEqual(2);
    });
  });

  describe("patchInternalEvent", () => {
    it("should be defined", () => {
      expect(typedModelController.patchInternalEvent).toBeDefined();
    });

    /**
     * Create an Internal Event using the createInternalEventRequest stub
     * Update the created Internal Event model
     * Make a patch request to update the Internal Event Model by passing the new model and the model ID
     * Check if the updated Internal Event has the new properties
     */
    it("Should return the updated Internal Event Model", async () => {
      const createdInternalEvent = await typedModelController.createInternalEvent(createInternalEventRequest);
      createdInternalEvent.users = [1];
      createdInternalEvent.label.name = "Updated Internal Event Model";

      const modelId = createdInternalEvent.id;
      const updatedInternalEvent = await typedModelController.patchInternalEvent(
        request,
        String(modelId),
        createdInternalEvent,
      );
      expect(updatedInternalEvent).toBeDefined();
      expect(updatedInternalEvent).toHaveProperty("id");
      expect(updatedInternalEvent.users).toEqual([1]);
      expect(updatedInternalEvent.label.name).toEqual("Updated Internal Event Model");
    });
  });

  describe("patchInternalHazard", () => {
    it("should be defined", () => {
      expect(typedModelController.patchInternalHazard).toBeDefined();
    });

    /**
     * Create an Internal Hazard using the createInternalHazardRequest stub
     * Update the created Internal Hazard model
     * Make a patch request to update the Internal Hazard Model by passing the new model and the model ID
     * Check if the updated Internal Hazard has the new properties
     */
    it("Should return the updated Internal Hazard Model", async () => {
      const createdInternalHazard = await typedModelController.createInternalHazard(createInternalHazardRequest);
      createdInternalHazard.users = [1];
      createdInternalHazard.label.name = "Updated Internal Hazard Model";
      const modelId = createdInternalHazard.id;
      const updatedInternalHazard = await typedModelController.patchInternalHazard(
        request,
        String(modelId),
        createdInternalHazard,
      );
      expect(updatedInternalHazard).toBeDefined();
      expect(updatedInternalHazard).toHaveProperty("id");
      expect(updatedInternalHazard.users).toEqual([1]);
      expect(updatedInternalHazard.label.name).toEqual("Updated Internal Hazard Model");
    });
  });

  describe("patchExternalHazard", () => {
    it("should be defined", () => {
      expect(typedModelController.patchExternalHazard).toBeDefined();
    });

    /**
     * Create an External Hazard using the createExternalHazardRequest stub
     * Update the created External Hazard model
     * Make a patch request to update the External Hazard Model by passing the new model and the model ID
     * Check if the updated External Hazard has the new properties
     */
    it("Should return the updated External Hazard Model", async () => {
      const createdExternalHazard = await typedModelController.createExternalHazard(createExternalHazardRequest);
      createdExternalHazard.users = [1];
      createdExternalHazard.label.name = "Updated External Hazard Model";
      const modelId = createdExternalHazard.id;
      const updatedExternalHazard = await typedModelController.patchExternalHazard(
        request,
        String(modelId),
        createdExternalHazard,
      );
      expect(updatedExternalHazard).toBeDefined();
      expect(updatedExternalHazard).toHaveProperty("id");
      expect(updatedExternalHazard.users).toEqual([1]);
      expect(updatedExternalHazard.label.name).toEqual("Updated External Hazard Model");
    });
  });

  describe("patchFullScope", () => {
    it("should be defined", () => {
      expect(typedModelController.patchFullScope).toBeDefined();
    });

    /**
     * Create a Full Scope using the createFullScopeRequest stub
     * Update the created Full Scope model
     * Make a patch request to update the Full Scope Model by passing the new model and the model ID
     * Check if the updated Full Scope has the new properties
     */
    it("Should return the updated Full Scope Model", async () => {
      const createdFullScope = await typedModelController.createFullScope(createFullScopeRequest);
      createdFullScope.users = [1];
      createdFullScope.label.name = "Updated Full Scope Model";
      const modelId = createdFullScope.id;
      const updatedFullScope = await typedModelController.patchFullScope(request, String(modelId), createdFullScope);
      expect(updatedFullScope).toBeDefined();
      expect(updatedFullScope).toHaveProperty("id");
      expect(updatedFullScope.users).toEqual([1]);
      expect(updatedFullScope.label.name).toEqual("Updated Full Scope Model");
    });
  });

  describe("getInternalEvents", () => {
    it("should be defined", () => {
      expect(typedModelController.getInternalEvents).toBeDefined();
    });

    /**
     * Create two Internal Events using the createInternalEventRequest stub
     * Check if the getInternalEvents function returns all Internal Event Models for a given user ID
     * Check if all the Internal Event models for the given user are returned correctly
     */
    it("Should return all Internal Event Models", async () => {
      await typedModelController.createInternalEvent(createInternalEventRequest);
      await typedModelController.createInternalEvent(createInternalEventRequest);
      const internalEvents = await typedModelController.getInternalEvents(request);
      expect(internalEvents).toBeDefined();
      expect(internalEvents.length).toEqual(2);
      expect(internalEvents[0].id).toEqual(1);
      expect(internalEvents[1].id).toEqual(2);
    });
  });

  describe("getInternalHazards", () => {
    it("should be defined", () => {
      expect(typedModelController.getInternalHazards).toBeDefined();
    });

    /**
     * Create two Internal Hazards using the createInternalHazardRequest stub
     * Check if the getInternalHazards function returns all Internal Hazard Models for a given user ID
     * Check if all the Internal Hazard models for the given user are returned correctly
     *
     */
    it("Should return all Internal Hazard Models", async () => {
      await typedModelController.createInternalHazard(createInternalHazardRequest);
      await typedModelController.createInternalHazard(createInternalHazardRequest);
      const internalHazards = await typedModelController.getInternalHazards(request);
      expect(internalHazards).toBeDefined();
      expect(internalHazards.length).toEqual(2);
      expect(internalHazards[0].id).toEqual(1);
      expect(internalHazards[1].id).toEqual(2);
    });
  });

  describe("getExternalHazards", () => {
    it("should be defined", () => {
      expect(typedModelController.getExternalHazards).toBeDefined();
    });

    /**
     * Create two External Hazards using the createExternalHazardRequest stub
     * Check if the getExternalHazards function returns all External Hazard Models for a given user ID
     * Check if all the External Hazard models for the given user are returned correctly
     */
    it("Should return all External Hazard Models", async () => {
      await typedModelController.createExternalHazard(createExternalHazardRequest);
      await typedModelController.createExternalHazard(createExternalHazardRequest);
      const externalHazards = await typedModelController.getExternalHazards(request);
      expect(externalHazards).toBeDefined();
      expect(externalHazards.length).toEqual(2);
      expect(externalHazards[0].id).toEqual(1);
      expect(externalHazards[1].id).toEqual(2);
    });
  });

  describe("getFullScopes", () => {
    it("should be defined", () => {
      expect(typedModelController.getFullScopes).toBeDefined();
    });

    /**
     * Create two Full Scopes using the createFullScopeRequest stub
     * Check if the getFullScopes function returns all Full Scope Models for a given user ID
     * Check if all the Full Scope models for the given user are returned correctly
     */
    it("Should return all Full Scope Models", async () => {
      await typedModelController.createFullScope(createFullScopeRequest);
      await typedModelController.createFullScope(createFullScopeRequest);
      const fullScopes = await typedModelController.getFullScopes(request);
      expect(fullScopes).toBeDefined();
      expect(fullScopes.length).toEqual(2);
      expect(fullScopes[0].id).toEqual(1);
      expect(fullScopes[1].id).toEqual(2);
    });
  });

  describe("getInternalEvent", () => {
    it("should be defined", () => {
      expect(typedModelController.getInternalEvent).toBeDefined();
    });

    /**
     * Create an Internal Event using the createInternalEventRequest stub
     * Check if the getInternalEvent function returns the Internal Event Model for a given user ID and model ID
     * Check if the Internal Event model for the given user is returned correctly
     */
    it("Should return the Internal Event Model", async () => {
      const createdInternalEvent = await typedModelController.createInternalEvent(createInternalEventRequest);
      const internalEvent = await typedModelController.getInternalEvent(request, String(createdInternalEvent.id));
      expect(internalEvent).toBeDefined();
      expect(internalEvent.id).toEqual(1);
      expect(internalEvent.users).toEqual([1, 2, 3]);
    });

    /**
     * Create an Internal Event using the createInternalEventRequest stub
     * Check if the getInternalEvent function returns NULL if user ID not associated with model
     */
    it("should return NULL if user ID not associated with model", async () => {
      const createdInternalEvent = await typedModelController.createInternalEvent(createInternalEventRequest);
      const req = { user: { user_id: 4 } };
      const internalEvent = await typedModelController.getInternalEvent(req, String(createdInternalEvent.id));
      expect(internalEvent).toBeNull();
    });

    /**
     * Check if the getInternalEvent function returns NULL if model not found
     * If the model is not found, the function should return NULL
     */
    it("should return NULL if model not found", async () => {
      const internalEvent = await typedModelController.getInternalEvent(request, "1");
      expect(internalEvent).toBeNull();
    });
  });

  describe("getInternalHazard", () => {
    it("should be defined", () => {
      expect(typedModelController.getInternalHazard).toBeDefined();
    });

    /**
     * Create an Internal Hazard using the createInternalHazardRequest stub
     * Check if the getInternalHazard function returns the Internal Hazard Model for a given user ID and model ID
     * Check if the Internal Hazard model for the given user is returned correctly
     */
    it("Should return the Internal Hazard Model", async () => {
      const createdInternalHazard = await typedModelController.createInternalHazard(createInternalHazardRequest);
      const internalHazard = await typedModelController.getInternalHazard(request, String(createdInternalHazard.id));
      expect(internalHazard).toBeDefined();
      expect(internalHazard.id).toEqual(1);
      expect(internalHazard.users).toEqual([1, 2, 3]);
    });

    /**
     * Create an Internal Hazard using the createInternalHazardRequest stub
     * Check if the getInternalHazard function returns NULL if user ID not associated with model
     * If the user ID is not associated with the model, the function should return NULL
     */
    it("should return NULL if user ID not associated with model", async () => {
      const createdInternalHazard = await typedModelController.createInternalHazard(createInternalHazardRequest);
      const req = { user: { user_id: 4 } };
      const internalHazard = await typedModelController.getInternalHazard(req, String(createdInternalHazard.id));
      expect(internalHazard).toBeNull();
    });

    /**
     * Check if the getInternalHazard function returns NULL if model not found
     * If the model is not found, the function should return NULL
     */
    it("should return NULL if model not found", async () => {
      const internalHazard = await typedModelController.getInternalHazard(request, "1");
      expect(internalHazard).toBeNull();
    });
  });

  describe("getExternalHazard", () => {
    it("should be defined", () => {
      expect(typedModelController.getExternalHazard).toBeDefined();
    });

    /**
     * Create an External Hazard using the createExternalHazardRequest stub
     * Check if the getExternalHazard function returns the External Hazard Model for a given user ID and model ID
     * Check if the External Hazard model for the given user is returned correctly
     */
    it("Should return the External Hazard Model", async () => {
      const createdExternalHazard = await typedModelController.createExternalHazard(createExternalHazardRequest);
      const externalHazard = await typedModelController.getExternalHazard(request, String(createdExternalHazard.id));
      expect(externalHazard).toBeDefined();
      expect(externalHazard.id).toEqual(1);
      expect(externalHazard.users).toEqual([1, 2, 3]);
    });

    /**
     * Create an External Hazard using the createExternalHazardRequest stub
     * Check if the getExternalHazard function returns NULL if user ID not associated with model
     * If the user ID is not associated with the model, the function should return NULL
     */
    it("should return NULL if user ID not associated with model", async () => {
      const createdExternalHazard = await typedModelController.createExternalHazard(createExternalHazardRequest);
      const req = { user: { user_id: 4 } };
      const externalHazard = await typedModelController.getExternalHazard(req, String(createdExternalHazard.id));
      expect(externalHazard).toBeNull();
    });

    /**
     * Check if the getExternalHazard function returns NULL if model not found
     * If the model is not found, the function should return NULL
     */
    it("should return NULL if model not found", async () => {
      const externalHazard = await typedModelController.getExternalHazard(request, "1");
      expect(externalHazard).toBeNull();
    });
  });

  describe("getFullScope", () => {
    it("should be defined", () => {
      expect(typedModelController.getFullScope).toBeDefined();
    });

    /**
     * Create a Full Scope using the createFullScopeRequest stub
     * Check if the getFullScope function returns the Full Scope Model for a given user ID and model ID
     * Check if the Full Scope model for the given user is returned correctly
     */
    it("Should return the Full Scope Model", async () => {
      const createdFullScope = await typedModelController.createFullScope(createFullScopeRequest);
      const fullScope = await typedModelController.getFullScope(request, String(createdFullScope.id));
      expect(fullScope).toBeDefined();
      expect(fullScope.id).toEqual(1);
      expect(fullScope.users).toEqual([1, 2, 3]);
    });

    /**
     * Create a Full Scope using the createFullScopeRequest stub
     * Check if the getFullScope function returns NULL if user ID not associated with model
     * If the user ID is not associated with the model, the function should return NULL
     */
    it("should return NULL if user ID not associated with model", async () => {
      const createdFullScope = await typedModelController.createFullScope(createFullScopeRequest);
      const req = { user: { user_id: 4 } };
      const fullScope = await typedModelController.getFullScope(req, String(createdFullScope.id));
      expect(fullScope).toBeNull();
    });

    /**
     * Check if the getFullScope function returns NULL if model not found
     * If the model is not found, the function should return NULL
     */
    it("should return NULL if model not found", async () => {
      const fullScope = await typedModelController.getFullScope(request, "1");
      expect(fullScope).toBeNull();
    });
  });

  describe("deleteInternalEvent", () => {
    it("should be defined", () => {
      expect(typedModelController.deleteInternalEvent).toBeDefined();
    });

    /**
     * Create an Internal Event using the createInternalEventRequest stub
     * Check if the deleteInternalEvent function deletes the Internal Event Model
     * Check if the Internal Event model for the given user is deleted. If the model is deleted, the getInternalEvent function should return NULL
     */
    it("Should remove the user from the Internal Event Model", async () => {
      const createdInternalEvent = await typedModelController.createInternalEvent(createInternalEventRequest);
      const deletedInternalEvent = await typedModelController.deleteInternalEvent(
        request,
        String(createdInternalEvent.id),
      );
      expect(deletedInternalEvent.users).toEqual([2, 3]);
    });

    it("should delete the model", async () => {
      const createdInternalEvent = await typedModelController.createInternalEvent(createInternalEventRequest);
      await typedModelController.deleteInternalEvent(request, String(createdInternalEvent.id));
      const request2 = { user: { user_id: 2 } };
      await typedModelController.deleteInternalEvent(request2, String(createdInternalEvent.id));
      const request3 = { user: { user_id: 3 } };
      const internalEventModel = await typedModelController.deleteInternalEvent(
        request3,
        String(createdInternalEvent.id),
      );
      expect(internalEventModel.users).toEqual([3]);
    });
  });

  describe("deleteInternalHazard", () => {
    it("should be defined", () => {
      expect(typedModelController.deleteInternalHazard).toBeDefined();
    });

    /**
     *
     * Create an Internal Hazard using the createInternalHazardRequest stub
     * Check if the deleteInternalHazard function deletes the Internal Hazard Model
     * Check if the Internal Hazard model for the given user is deleted.
     * If the model is deleted, the getInternalHazard function should return NULL
     */
    it("Should remove the user from the Internal Hazard Model", async () => {
      const createdInternalHazard = await typedModelController.createInternalHazard(createInternalHazardRequest);
      const updatedInternalHazard = await typedModelController.deleteInternalHazard(
        request,
        String(createdInternalHazard.id),
      );
      expect(updatedInternalHazard.users).toEqual([2, 3]);
    });
    it("should delete the model", async () => {
      const createdInternalHazard = await typedModelController.createInternalHazard(createInternalHazardRequest);
      await typedModelController.deleteInternalHazard(request, String(createdInternalHazard.id));
      const request2 = { user: { user_id: 2 } };
      await typedModelController.deleteInternalHazard(request2, String(createdInternalHazard.id));
      const request3 = { user: { user_id: 3 } };
      const internalHazardModel = await typedModelController.deleteInternalHazard(
        request3,
        String(createdInternalHazard.id),
      );
      expect(internalHazardModel.users).toEqual([3]);
    });
  });

  describe("deleteExternalHazard", () => {
    it("should be defined", () => {
      expect(typedModelController.deleteExternalHazard).toBeDefined();
    });

    /**
     * Create an External Hazard using the createExternalHazardRequest stub
     * Check if the deleteExternalHazard function deletes the External Hazard Model
     * Check if the External Hazard model for the given user is deleted.
     * If the model is deleted, the getExternalHazard function should return NULL
     */
    it("Should remove the user from the External Hazard Model", async () => {
      const createdExternalHazard = await typedModelController.createExternalHazard(createExternalHazardRequest);
      const updatedExternalHazard = await typedModelController.deleteExternalHazard(
        request,
        String(createdExternalHazard.id),
      );
      expect(updatedExternalHazard.users).toEqual([2, 3]);
    });
    it("should delete the model", async () => {
      const createdExternalHazard = await typedModelController.createExternalHazard(createExternalHazardRequest);
      await typedModelController.deleteExternalHazard(request, String(createdExternalHazard.id));
      const request2 = { user: { user_id: 2 } };
      await typedModelController.deleteExternalHazard(request2, String(createdExternalHazard.id));
      const request3 = { user: { user_id: 3 } };
      const externalHazardModel = await typedModelController.deleteExternalHazard(
        request3,
        String(createdExternalHazard.id),
      );
      expect(externalHazardModel.users).toEqual([3]);
    });
  });

  describe("deleteFullScope", () => {
    it("should be defined", () => {
      expect(typedModelController.deleteFullScope).toBeDefined();
    });

    /**
     * Create a Full Scope using the createFullScopeRequest stub
     * Check if the deleteFullScope function deletes the Full Scope Model
     * Check if the Full Scope model for the given user is deleted.
     * If the model is deleted, the getFullScope function should return NULL
     */
    it("Should remove the user from the Full Scope Model", async () => {
      const createdFullScope = await typedModelController.createFullScope(createFullScopeRequest);
      const updatedModel = await typedModelController.deleteFullScope(request, String(createdFullScope.id));
      expect(updatedModel).toBeDefined();
      expect(updatedModel.users).toEqual([2, 3]);
    });

    it("should delete the model", async () => {
      const createdFullScope = await typedModelController.createFullScope(createFullScopeRequest);
      await typedModelController.deleteFullScope(request, String(createdFullScope.id));
      const request2 = { user: { user_id: 2 } };
      await typedModelController.deleteFullScope(request2, String(createdFullScope.id));
      const request3 = { user: { user_id: 3 } };
      const fullScopeModel = await typedModelController.deleteFullScope(request3, String(createdFullScope.id));
      expect(fullScopeModel.users).toEqual([3]);
    });
  });

  describe("addNestedToInternalEvent", () => {
    it("should be defined", () => {
      expect(typedModelController.addNestedToInternalEvent).toBeDefined();
    });

    /**
     * Create an Internal Event using the createInternalEventRequest stub
     * Add a nested model to the Internal Event Model
     * Check if the nested model is added to the Internal Event Model
     */
    it("Should add a nested model to the Internal Event Model", async () => {
      const createdInternalEvent = await typedModelController.createInternalEvent(createInternalEventRequest);
      const addNestedModelRequest = {
        modelId: createdInternalEvent.id,
        nestedId: 1,
        nestedType: "initiatingEvents",
      };
      await typedModelController.addNestedToInternalEvent(addNestedModelRequest);
      const latestInternalEvent = await typedModelController.getInternalEvent(request, String(createdInternalEvent.id));
      expect(latestInternalEvent.initiatingEvents).toEqual([1]);
      expect(latestInternalEvent.users).toEqual([1, 2, 3]);
    });

    /**
     * Create an Internal Event using the createInternalEventRequest stub
     * Add all nested models to the Internal Event Model
     * Check if all the nested models are added to the Internal Event Model
     */
    it("Should add all nested models to the Internal Event Model", async () => {
      const createdInternalEvent = await typedModelController.createInternalEvent(createInternalEventRequest);
      for (const nestedObject of nestedObjects) {
        const addNestedModelRequest = {
          modelId: createdInternalEvent.id,
          nestedId: nestedObject.nestedId,
          nestedType: nestedObject.nestedType,
        };
        await typedModelController.addNestedToInternalEvent(addNestedModelRequest);
      }
      const latestInternalEvent = await typedModelController.getInternalEvent(request, String(createdInternalEvent.id));
      expect(latestInternalEvent.initiatingEvents).toEqual([9]);
      expect(latestInternalEvent.eventSequenceDiagrams).toEqual([10]);
      expect(latestInternalEvent.functionalEvents).toEqual([11]);
      expect(latestInternalEvent.faultTrees).toEqual([12]);
      expect(latestInternalEvent.eventTrees).toEqual([13]);
      expect(latestInternalEvent.bayesianNetworks).toEqual([14]);
      expect(latestInternalEvent.markovChains).toEqual([15]);
      expect(latestInternalEvent.bayesianEstimations).toEqual([16]);
      expect(latestInternalEvent.weibullAnalysis).toEqual([17]);
      expect(latestInternalEvent.users).toEqual([1, 2, 3]);
    });
  });

  describe("addNestedToInternalHazard", () => {
    it("should be defined", () => {
      expect(typedModelController.addNestedToInternalHazard).toBeDefined();
    });

    /**
     * Create an Internal Hazard using the createInternalHazardRequest stub
     * Add a nested model to the Internal Hazard Model
     * Check if the nested model is added to the Internal Hazard Model
     */
    it("Should add a nested model to the Internal Hazard Model", async () => {
      const createdInternalHazard = await typedModelController.createInternalHazard(createInternalHazardRequest);
      const addNestedModelRequest = {
        modelId: createdInternalHazard.id,
        nestedId: 1,
        nestedType: "initiatingEvents",
      };
      await typedModelController.addNestedToInternalHazard(addNestedModelRequest);
      const latestInternalHazard = await typedModelController.getInternalHazard(
        request,
        String(createdInternalHazard.id),
      );
      expect(latestInternalHazard.initiatingEvents).toEqual([1]);
      expect(latestInternalHazard.users).toEqual([1, 2, 3]);
    });

    /**
     *
     * Create an Internal Hazard using the createInternalHazardRequest stub
     * Add all nested models to the Internal Hazard Model
     * Check if all the nested models are added to the Internal Hazard Model
     */
    it("Should add all nested models to the Internal Hazard Model", async () => {
      const createdInternalHazard = await typedModelController.createInternalHazard(createInternalHazardRequest);
      for (const nestedObject of nestedObjects) {
        const addNestedModelRequest = {
          modelId: createdInternalHazard.id,
          nestedId: nestedObject.nestedId,
          nestedType: nestedObject.nestedType,
        };
        await typedModelController.addNestedToInternalHazard(addNestedModelRequest);
      }
      const latestInternalHazard = await typedModelController.getInternalHazard(
        request,
        String(createdInternalHazard.id),
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
      expect(latestInternalHazard.users).toEqual([1, 2, 3]);
    });
  });

  describe("addNestedToExternalHazard", () => {
    it("should be defined", () => {
      expect(typedModelController.addNestedToExternalHazard).toBeDefined();
    });

    /**
     * Create an External Hazard using the createExternalHazardRequest stub
     * Add a nested model to the External Hazard Model
     * Check if the nested model is added to the External Hazard Model
     */
    it("Should add a nested model to the External Hazard Model", async () => {
      const createdExternalHazard = await typedModelController.createExternalHazard(createExternalHazardRequest);
      const addNestedModelRequest = {
        modelId: createdExternalHazard.id,
        nestedId: 1,
        nestedType: "initiatingEvents",
      };
      await typedModelController.addNestedToExternalHazard(addNestedModelRequest);
      const latestExternalHazard = await typedModelController.getExternalHazard(
        request,
        String(createdExternalHazard.id),
      );
      expect(latestExternalHazard.initiatingEvents).toEqual([1]);
      expect(latestExternalHazard.users).toEqual([1, 2, 3]);
    });

    /**
     * Create an External Hazard using the createExternalHazardRequest stub
     * Add all nested models to the External Hazard Model
     * Check if all the nested models are added to the External Hazard Model
     */
    it("Should add  all nested models to the External Hazard Model", async () => {
      const createdExternalHazard = await typedModelController.createExternalHazard(createExternalHazardRequest);
      for (const nestedObject of nestedObjects) {
        const addNestedModelRequest = {
          modelId: createdExternalHazard.id,
          nestedId: nestedObject.nestedId,
          nestedType: nestedObject.nestedType,
        };
        await typedModelController.addNestedToExternalHazard(addNestedModelRequest);
      }
      const latestExternalHazard = await typedModelController.getExternalHazard(
        request,
        String(createdExternalHazard.id),
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
      expect(latestExternalHazard.users).toEqual([1, 2, 3]);
    });
  });

  describe("addNestedToFullScope", () => {
    it("should be defined", () => {
      expect(typedModelController.addNestedToFullScope).toBeDefined();
    });

    /**
     * Create a Full Scope using the createFullScopeRequest stub
     * Add a nested model to the Full Scope Model
     * Check if the nested model is added to the Full Scope Model
     */
    it("Should add a nested model to the Full Scope Model", async () => {
      const createdFullScope = await typedModelController.createFullScope(createFullScopeRequest);
      const addNestedModelRequest = {
        modelId: createdFullScope.id,
        nestedId: 1,
        nestedType: "initiatingEvents",
      };
      await typedModelController.addNestedToFullScope(addNestedModelRequest);
      const latestFullScope = await typedModelController.getFullScope(request, String(createdFullScope.id));
      expect(latestFullScope.initiatingEvents).toEqual([1]);
      expect(latestFullScope.users).toEqual([1, 2, 3]);
    });

    /**
     * Create a Full Scope using the createFullScopeRequest stub
     * Add all nested models to the Full Scope Model
     * Check if all the nested models are added to the Full Scope Model
     */
    it("Should add  all nested models to the Full Scope Model", async () => {
      const createdFullScope = await typedModelController.createFullScope(createFullScopeRequest);
      for (const nestedObject of nestedObjects) {
        const addNestedModelRequest = {
          modelId: createdFullScope.id,
          nestedId: nestedObject.nestedId,
          nestedType: nestedObject.nestedType,
        };
        await typedModelController.addNestedToFullScope(addNestedModelRequest);
      }
      const latestFullScope = await typedModelController.getFullScope(request, String(createdFullScope.id));
      expect(latestFullScope.initiatingEvents).toEqual([9]);
      expect(latestFullScope.eventSequenceDiagrams).toEqual([10]);
      expect(latestFullScope.functionalEvents).toEqual([11]);
      expect(latestFullScope.faultTrees).toEqual([12]);
      expect(latestFullScope.eventTrees).toEqual([13]);
      expect(latestFullScope.bayesianNetworks).toEqual([14]);
      expect(latestFullScope.markovChains).toEqual([15]);
      expect(latestFullScope.bayesianEstimations).toEqual([16]);
      expect(latestFullScope.weibullAnalysis).toEqual([17]);
      expect(latestFullScope.users).toEqual([1, 2, 3]);
    });
  });

  describe("deleteNestedFromInternalEvent", () => {
    it("should be defined", () => {
      expect(typedModelController.deleteNestedFromInternalEvent).toBeDefined();
    });

    /**
     * Create an Internal Event using the createInternalEventRequest stub
     * Add a nested model to the Internal Event Model
     * Delete the nested model from the Internal Event Model
     * Check if the nested model is deleted from the Internal Event Model
     */
    it("Should delete a nested model from the Internal Event Model", async () => {
      const createdInternalEvent = await typedModelController.createInternalEvent(createInternalEventRequest);
      const addNestedModelRequest = {
        modelId: createdInternalEvent.id,
        nestedId: 1,
        nestedType: "initiatingEvents",
      };
      await typedModelController.addNestedToInternalEvent(addNestedModelRequest);

      const deleteNestedModelRequest = {
        nestedId: 1,
        nestedType: "initiatingEvents",
      };
      await typedModelController.deleteNestedFromInternalEvent(
        String(createdInternalEvent.id),
        deleteNestedModelRequest,
      );
      const latestInternalEvent = await typedModelController.getInternalEvent(request, String(createdInternalEvent.id));
      expect(latestInternalEvent.initiatingEvents).toEqual([]);
      expect(latestInternalEvent.users).toEqual([1, 2, 3]);
    });

    /**
     * Create an Internal Event using the createInternalEventRequest stub
     * Add a nested model to the Internal Event Model
     * Try to delete the non-existent nested model from the Internal Event Model
     * Check if the nested models are not deleted from the Internal Event Model if the nested model does not exist
     */
    it("should not delete a nested model from the Internal Event Model if the nested model does not exist", async () => {
      const createdInternalEvent = await typedModelController.createInternalEvent(createInternalEventRequest);

      const addNestedModelRequest = {
        modelId: createdInternalEvent.id,
        nestedId: 1,
        nestedType: "initiatingEvents",
      };

      await typedModelController.addNestedToInternalEvent(addNestedModelRequest);

      const deleteNestedModelRequest = {
        nestedId: 2,
        nestedType: "initiatingEvents",
      };
      await typedModelController.deleteNestedFromInternalEvent(
        String(createdInternalEvent.id),
        deleteNestedModelRequest,
      );
      const latestInternalEvent = await typedModelController.getInternalEvent(request, String(createdInternalEvent.id));
      expect(latestInternalEvent.initiatingEvents).toEqual([1]);
      expect(latestInternalEvent.users).toEqual([1, 2, 3]);
    });
  });

  describe("deleteNestedFromInternalHazard", () => {
    it("should be defined", () => {
      expect(typedModelController.deleteNestedFromInternalHazard).toBeDefined();
    });

    /**
     * Create an Internal Hazard using the createInternalHazardRequest stub
     * Add a nested model to the Internal Hazard Model
     * Delete the nested model from the Internal Hazard Model
     * Check if the nested model is deleted from the Internal Hazard Model
     */
    it("Should delete a nested model from the Internal Hazard Model", async () => {
      const createdInternalHazard = await typedModelController.createInternalHazard(createInternalHazardRequest);

      const addNestedModelRequest = {
        modelId: createdInternalHazard.id,
        nestedId: 1,
        nestedType: "initiatingEvents",
      };
      await typedModelController.addNestedToInternalHazard(addNestedModelRequest);

      createdInternalHazard.initiatingEvents = [1];
      const deleteNestedModelRequest = {
        nestedId: 1,
        nestedType: "initiatingEvents",
      };
      await typedModelController.deleteNestedFromInternalHazard(
        String(createdInternalHazard.id),
        deleteNestedModelRequest,
      );

      const latestInternalHazard = await typedModelController.getInternalHazard(
        request,
        String(createdInternalHazard.id),
      );
      expect(latestInternalHazard.initiatingEvents).toEqual([]);
      expect(latestInternalHazard.users).toEqual([1, 2, 3]);
    });

    /**
     * Create an Internal Hazard using the createInternalHazardRequest stub
     * Add a nested model to the Internal Hazard Model
     * Try to delete the non-existent nested model from the Internal Hazard Model
     * Check if the nested models are not deleted from the Internal Hazard Model if the nested model does not exist
     */
    it("should not delete a nested model from the Internal Hazard Model if the nested model does not exist", async () => {
      const createdInternalHazard = await typedModelController.createInternalHazard(createInternalHazardRequest);

      const addNestedModelRequest = {
        modelId: createdInternalHazard.id,
        nestedId: 1,
        nestedType: "initiatingEvents",
      };
      await typedModelController.addNestedToInternalHazard(addNestedModelRequest);

      const deleteNestedModelRequest = {
        nestedId: 2,
        nestedType: "initiatingEvents",
      };
      await typedModelController.deleteNestedFromInternalHazard(
        String(createdInternalHazard.id),
        deleteNestedModelRequest,
      );
      const latestInternalHazard = await typedModelController.getInternalHazard(
        request,
        String(createdInternalHazard.id),
      );
      expect(latestInternalHazard.initiatingEvents).toEqual([1]);
      expect(latestInternalHazard.users).toEqual([1, 2, 3]);
    });
  });

  describe("deleteNestedFromExternalHazard", () => {
    it("should be defined", () => {
      expect(typedModelController.deleteNestedFromExternalHazard).toBeDefined();
    });

    /**
     * Create an External Hazard using the createExternalHazardRequest stub
     * Add a nested model to the External Hazard Model
     * Delete the nested model from the External Hazard Model
     * Check if the nested model is deleted from the External Hazard Model
     */
    it("Should delete a nested model from the External Hazard Model", async () => {
      const createdExternalHazard = await typedModelController.createExternalHazard(createExternalHazardRequest);

      const addNestedModelRequest = {
        modelId: createdExternalHazard.id,
        nestedId: 1,
        nestedType: "initiatingEvents",
      };
      await typedModelController.addNestedToExternalHazard(addNestedModelRequest);

      createdExternalHazard.initiatingEvents = [1];
      const deleteNestedModelRequest = {
        nestedId: 1,
        nestedType: "initiatingEvents",
      };
      await typedModelController.deleteNestedFromExternalHazard(
        String(createdExternalHazard.id),
        deleteNestedModelRequest,
      );
      const latestExternalHazard = await typedModelController.getExternalHazard(
        request,
        String(createdExternalHazard.id),
      );
      expect(latestExternalHazard.initiatingEvents).toEqual([]);
      expect(latestExternalHazard.users).toEqual([1, 2, 3]);
    });

    /**
     * Create an External Hazard using the createExternalHazardRequest stub
     * Add a nested model to the External Hazard Model
     * Try to delete the non-existent nested model from the External Hazard Model
     * Check if the nested models are not deleted from the External Hazard Model if the nested model does not exist
     */
    it("should not delete a nested model from the External Hazard Model if the nested model does not exist", async () => {
      const createdExternalHazard = await typedModelController.createExternalHazard(createExternalHazardRequest);

      const addNestedModelRequest = {
        modelId: createdExternalHazard.id,
        nestedId: 1,
        nestedType: "initiatingEvents",
      };
      await typedModelController.addNestedToExternalHazard(addNestedModelRequest);

      const deleteNestedModelRequest = {
        nestedId: 2,
        nestedType: "initiatingEvents",
      };
      await typedModelController.deleteNestedFromExternalHazard(
        String(createdExternalHazard.id),
        deleteNestedModelRequest,
      );
      const latestExternalHazard = await typedModelController.getExternalHazard(
        request,
        String(createdExternalHazard.id),
      );
      expect(latestExternalHazard.initiatingEvents).toEqual([1]);
      expect(latestExternalHazard.users).toEqual([1, 2, 3]);
    });
  });

  describe("deleteNestedFromFullScope", () => {
    it("should be defined", () => {
      expect(typedModelController.deleteNestedFromFullScope).toBeDefined();
    });

    /**
     * Create a Full Scope using the createFullScopeRequest stub
     * Add a nested model to the Full Scope Model
     * Delete the nested model from the Full Scope Model
     * Check if the nested model is deleted from the Full Scope Model
     */
    it("Should delete a nested model from the Full Scope Model", async () => {
      const createdFullScope = await typedModelController.createFullScope(createFullScopeRequest);

      const addNestedModelRequest = {
        modelId: createdFullScope.id,
        nestedId: 1,
        nestedType: "initiatingEvents",
      };
      await typedModelController.addNestedToFullScope(addNestedModelRequest);

      createdFullScope.initiatingEvents = [1];
      const deleteNestedModelRequest = {
        nestedId: 1,
        nestedType: "initiatingEvents",
      };
      await typedModelController.deleteNestedFromFullScope(String(createdFullScope.id), deleteNestedModelRequest);
      const latestFullScope = await typedModelController.getFullScope(request, String(createdFullScope.id));
      expect(latestFullScope.initiatingEvents).toEqual([]);
      expect(latestFullScope.users).toEqual([1, 2, 3]);
    });

    /**
     * Create a Full Scope using the createFullScopeRequest stub
     * Add a nested model to the Full Scope Model
     * Try to delete the non-existent nested model from the Full Scope Model
     * Check if the nested models are not deleted from the Full Scope Model if the nested model does not exist
     */
    it("should not delete a nested model from the Full Scope Model if the nested model does not exist", async () => {
      const createdFullScope = await typedModelController.createFullScope(createFullScopeRequest);

      const addNestedModelRequest = {
        modelId: createdFullScope.id,
        nestedId: 1,
        nestedType: "initiatingEvents",
      };
      await typedModelController.addNestedToFullScope(addNestedModelRequest);

      const deleteNestedModelRequest = {
        nestedId: 2,
        nestedType: "initiatingEvents",
      };
      await typedModelController.deleteNestedFromFullScope(String(createdFullScope.id), deleteNestedModelRequest);
      const latestFullScope = await typedModelController.getFullScope(request, String(createdFullScope.id));
      expect(latestFullScope.initiatingEvents).toEqual([1]);
      expect(latestFullScope.users).toEqual([1, 2, 3]);
    });
  });
});
