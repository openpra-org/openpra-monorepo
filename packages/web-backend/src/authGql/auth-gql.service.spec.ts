import { Test, TestingModule } from "@nestjs/testing";
import { AuthGqlService } from "./auth-gql.service";

describe("AuthGqlService", () => {
  let service: AuthGqlService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [AuthGqlService],
    }).compile();

    service = module.get<AuthGqlService>(AuthGqlService);
  });

  it("should be defined", () => {
    expect(service).toBeDefined();
  });
});
