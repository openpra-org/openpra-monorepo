import { Test, TestingModule } from "@nestjs/testing";
import { MasterLogicDiagramsService } from "./master-logic-diagrams.service";

describe("MasterLogicDiagramService", () => {
  let service: MasterLogicDiagramsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [MasterLogicDiagramsService],
    }).compile();

    service = module.get<MasterLogicDiagramsService>(MasterLogicDiagramsService);
  });

  it("should be defined", () => {
    expect(service).toBeDefined();
  });
});
