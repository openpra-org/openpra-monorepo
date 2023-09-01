import { HttpStatus } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { TypedModelController } from './typedModel.controller';
import { TypedModelService } from './typedModel.service';
import { request } from './stubs/request.stub';
import { createInternalEventRequest } from './stubs/createInternalEventRequest.stub';
import { createInternalHazardRequest } from './stubs/createInternalHazardRequest.stub';
import { createExternalHazardRequest } from './stubs/createExternalHazardRequest.stub';
import { createFullScopeRequest } from './stubs/createFullScopeRequest.stub';
import { updateInternalEventRequest } from './stubs/updateInternalEventRequest.stub';
import { updateInternalHazardRequest } from './stubs/updateInternalHazardRequest.stub';
import { updateExternalHazardRequest } from './stubs/updateExternalHazardRequest.stub';
import { updateFullScopeRequest } from './stubs/updateFullScopeRequest.stub';
import { createInternalEventResponse } from './stubs/createInternalEventResponse.stub';
import { createInternalHazardResponse } from './stubs/createInternalHazardResponse.stub';
import { createExternalHazardResponse } from './stubs/createExternalHazardResponse.stub';
import { createFullScopeResponse } from './stubs/createFullScopeResponse.stub';
import { updateInternalEventResponse } from './stubs/updateInternalEventResponse.stub';
import { updateInternalHazardResponse } from './stubs/updateInternalHazardResponse.stub';
import { updateExternalHazardResponse } from './stubs/updateExternalHazardResponse.stub';
import { updateFullScopeResponse } from './stubs/updateFullScopeResponse.stub';
import { getInternalEvents } from './stubs/getInternalEvents.stub';
import { getInternalHazards } from './stubs/getInternalHazards.stub';
import { getExternalHazards } from './stubs/getExternalHazards.stub';
import { getFullScopes } from './stubs/getFullScopes.stub';
import { getInternalEvent } from './stubs/getInternalEvent.stub';
import { getInternalHazard } from './stubs/getInternalHazard.stub';
import { getExternalHazard } from './stubs/getExternalHazard.stub';
import { getFullScope } from './stubs/getFullScope.stub';

describe('TypedModel Controller', () => {
    let Controller: TypedModelController;
    let Service: TypedModelService;

    beforeEach(async () => {
        const module = await Test.createTestingModule({
            controllers: [TypedModelController],
            providers: [
                {
                    provide: TypedModelService,
                    useValue: { 
                        createInternalEventModel: jest.fn().mockResolvedValue(createInternalEventResponse),
                        createInternalHazardModel: jest.fn().mockResolvedValue(createInternalHazardResponse),
                        createExternalHazardModel: jest.fn().mockResolvedValue(createExternalHazardResponse),
                        createFullScopeModel: jest.fn().mockResolvedValue(createFullScopeResponse),
                        patchInternalEvent: jest.fn().mockResolvedValue(updateInternalEventResponse),
                        patchInternalHazard: jest.fn().mockResolvedValue(updateInternalHazardResponse),
                        patchExternalHazard: jest.fn().mockResolvedValue(updateExternalHazardResponse),
                        patchFullScope: jest.fn().mockResolvedValue(updateFullScopeResponse),
                        getInternalEvents: jest.fn().mockResolvedValue(getInternalEvents),
                        getInternalHazards: jest.fn().mockResolvedValue(getInternalHazards),
                        getExternalHazards: jest.fn().mockResolvedValue(getExternalHazards),
                        getFullScopes: jest.fn().mockResolvedValue(getFullScopes),
                        getInternalEvent: jest.fn().mockResolvedValue(getInternalEvent),
                        getInternalHazard: jest.fn().mockResolvedValue(getInternalHazard),
                        getExternalHazard: jest.fn().mockResolvedValue(getExternalHazard),
                        getFullScope: jest.fn().mockResolvedValue(getFullScope),
                        deleteInternalEvent: jest.fn().mockResolvedValue(HttpStatus.NO_CONTENT),
                        deleteInternalHazard: jest.fn().mockResolvedValue(HttpStatus.NO_CONTENT),
                        deleteExternalHazard: jest.fn().mockResolvedValue(HttpStatus.NO_CONTENT),
                        deleteFullScope: jest.fn().mockResolvedValue(HttpStatus.NO_CONTENT),
                        addNestedToInternalEvent: jest.fn().mockResolvedValue({}),
                        addNestedToInternalHazard: jest.fn().mockResolvedValue({}),
                        addNestedToExternalHazard: jest.fn().mockResolvedValue({}),
                        addNestedToFullScope: jest.fn().mockResolvedValue({}),
                        deleteNestedFromInternalEvent: jest.fn().mockResolvedValue({}),
                        deleteNestedFromInternalHazard: jest.fn().mockResolvedValue({}),
                        deleteNestedFromExternalHazard: jest.fn().mockResolvedValue({}),
                        deleteNestedFromFullScope: jest.fn().mockResolvedValue({})
                    }
                }
            ]
        }).compile();

        Controller = module.get<TypedModelController>(TypedModelController);
        Service = module.get<TypedModelService>(TypedModelService);
    });

    it('TypedModelController should be defined', () => {
        expect(Controller).toBeDefined();
    });

    describe('createInternalEvent()', () => {
        it('Should return the newly created Internal Event Model', () => {
            expect(Controller.createInternalEvent(createInternalEventRequest)).resolves.toEqual(createInternalEventResponse);
        });
    });

    describe('createInternalHazard()', () => {
        it('Should return the newly created Internal Hazard Model', () => {
            expect(Controller.createInternalHazard(createInternalHazardRequest)).resolves.toEqual(createInternalHazardResponse);
        })
    })

    describe('createExternalHazard()', () => {
        it('Should return the newly created External Hazard Model', () => {
            expect(Controller.createExternalHazard(createExternalHazardRequest)).resolves.toEqual(createExternalHazardResponse);
        })
    })

    describe('createFullScope()', () => {
        it('Should return the newly created Full Scope Model', () => {
            expect(Controller.createFullScope(createFullScopeRequest)).resolves.toEqual(createFullScopeResponse);
        })
    })

    describe('patchInternalEvent()', () => {
        it('Should return the updated Internal Event Model', () => {
            expect(Controller.patchInternalEvent(request, "1", updateInternalEventRequest)).resolves.toEqual(updateInternalEventResponse);
        })
    })

    describe('patchInternalHazard()', () => {
        it('Should return the updated Internal Hazard Model', () => {
            expect(Controller.patchInternalHazard(request, "2", updateInternalHazardRequest)).resolves.toEqual(updateInternalHazardResponse);
        })
    })

    describe('patchExternalHazard()', () => {
        it('Should return the updated External Hazard Model', () => {
            expect(Controller.patchExternalHazard(request, "3", updateExternalHazardRequest)).resolves.toEqual(updateExternalHazardResponse);
        })
    })

    describe('patchFullScope()', () => {
        it('Should return the updated Full Scope Model', () => {
            expect(Controller.patchFullScope(request, "4", updateFullScopeRequest)).resolves.toEqual(updateFullScopeResponse);
        })
    })

    describe('getInternalEvents()', () => {
        it('Should return the list of Internal Event Models', () => {
            expect(Controller.getInternalEvents(request)).resolves.toEqual(getInternalEvents);
        })
    })

    describe('getInternalHazards', () => {
        it('Should return the list of Internal Hazard Models', () => {
            expect(Controller.getInternalHazards(request)).resolves.toEqual(getInternalHazards);
        })
    })

    describe('getExternalHazards()', () => {
        it('Should return the list of External Hazard Models', () => {
            expect(Controller.getExternalHazards(request)).resolves.toEqual(getExternalHazards);
        })
    })

    describe('getFullScopes()', () => {
        it('Should return the list of Full Scope Models', () => {
            expect(Controller.getFullScopes(request)).resolves.toEqual(getFullScopes);
        })
    })

    describe('getInternalEvent()', () => {
        it('Should return an Internal Event Model', () => {
            expect(Controller.getInternalEvent(request, "5")).resolves.toEqual(getInternalEvent);
        })
    })

    describe('getInternalHazard()', () => {
        it('Should return an Internal Hazard Model', () => {
            expect(Controller.getInternalHazard(request, "6")).resolves.toEqual(getInternalHazard);
        })
    })

    describe('getExternalHazard()', () => {
        it('Should return an External Hazard Model', () => {
            expect(Controller.getExternalHazard(request, "7")).resolves.toEqual(getExternalHazard);
        })
    })

    describe('getFullScope()', () => {
        it('Should return a Full Scope Model', () => {
            expect(Controller.getFullScope(request, "8")).resolves.toEqual(getFullScope);
        })
    })

    describe('deleteInternalEvent()', () => {
        it('Should delete the Internal Event Model and return 204 status', () => {
            expect(Controller.deleteInternalEvent("5")).resolves.toEqual(HttpStatus.NO_CONTENT);
        })
    })

    describe('deleteInternalHazard()', () => {
        it('Should delete the Internal Hazard Model and return 204 status', () => {
            expect(Controller.deleteInternalHazard("6")).resolves.toEqual(HttpStatus.NO_CONTENT);
        })
    })

    describe('deleteExternalHazard()', () => {
        it('Should delete the External Hazard Model and return 204 status', () => {
            expect(Controller.deleteExternalHazard("7")).resolves.toEqual(HttpStatus.NO_CONTENT);
        })
    })

    describe('deleteFullScope()', () => {
        it('Should delete the Full Scope Model and return 204 status', () => {
            expect(Controller.deleteFullScope("8")).resolves.toEqual(HttpStatus.NO_CONTENT);
        })
    })
});