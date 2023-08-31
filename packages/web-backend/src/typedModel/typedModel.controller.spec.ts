import { Test } from '@nestjs/testing';
import { TypedModelController } from './typedModel.controller';
import { TypedModelService } from './typedModel.service';
import { createInternalEventRequest } from './stubs/createInternalEventRequest.stub';
import { createInternalHazardRequest } from './stubs/createInternalHazardRequest.stub';
import { createInternalEventResponse } from './stubs/createInternalEventResponse.stub';
import { createInternalHazardResponse } from './stubs/createInternalHazardResponse.stub';
import { createExternalHazardResponse } from './stubs/createExternalHazardResponse.stub';
import { createFullScopeResponse } from './stubs/createFullScopeResponse.stub';

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
                        patchInternalEvent: jest.fn().mockResolvedValue({}),
                        patchInternalHazard: jest.fn().mockResolvedValue({}),
                        patchExternalHazard: jest.fn().mockResolvedValue({}),
                        patchFullScope: jest.fn().mockResolvedValue({}),
                        getInternalEvents: jest.fn().mockResolvedValue({}),
                        getInternalHazards: jest.fn().mockResolvedValue({}),
                        getExternalHazards: jest.fn().mockResolvedValue({}),
                        getFullScopes: jest.fn().mockResolvedValue({}),
                        getInternalEvent: jest.fn().mockResolvedValue({}),
                        getInternalHazard: jest.fn().mockResolvedValue({}),
                        getExternalHazard: jest.fn().mockResolvedValue({}),
                        getFullScope: jest.fn().mockResolvedValue({}),
                        deleteInternalEvent: jest.fn().mockResolvedValue({}),
                        deleteInternalHazard: jest.fn().mockResolvedValue({}),
                        deleteExternalHazard: jest.fn().mockResolvedValue({}),
                        deleteFullScope: jest.fn().mockResolvedValue({}),
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
        it('Should return the newly created Internal Event', () => {
            expect(Controller.createInternalEvent(createInternalEventRequest)).resolves.toEqual(createInternalEventResponse);
        });
    });

    describe('createInternalHazard()', () => {
        it('Should return the newly created Internal Hazard', () => {
            expect(Controller.createInternalHazard(createInternalHazardRequest)).resolves.toEqual(createInternalHazardResponse);
        })
    })
});