import { Test, TestingModule } from "@nestjs/testing";
import { AuthGqlResolver } from "./auth-gql.resolver";

describe("AuthGqlResolver", () => {
  let resolver: AuthGqlResolver;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [AuthGqlResolver],
    }).compile();

    resolver = module.get<AuthGqlResolver>(AuthGqlResolver);
  });

  it("should be defined", () => {
    expect(resolver).toBeDefined();
  });
});
