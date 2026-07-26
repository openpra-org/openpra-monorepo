import { RiMefAdapter } from "../ri-mef-adapter";

describe("RiMefAdapter project examples", () => {
  const registry = { register: jest.fn() };
  const riWorkbooksService = { loadExample: jest.fn().mockResolvedValue(undefined) };
  const adapter = new RiMefAdapter(
    {} as never,
    registry as never,
    riWorkbooksService as never,
  );

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("advertises the HTGR and SFR RI examples to the project generator", () => {
    expect(adapter.exampleVariants()).toEqual([
      {
        exampleId: "htgr",
        label: "Generic HTGR",
        workbookName: "RI Workbook 1",
      },
      {
        exampleId: "sfr",
        label: "Generic SFR",
        workbookName: "RI Workbook 2",
      },
    ]);
  });

  it("loads the selected RI example through the RI workbook service", async () => {
    await adapter.loadExample("ri-workbook-id", { username: "ada" }, "sfr");

    expect(riWorkbooksService.loadExample).toHaveBeenCalledWith(
      "ri-workbook-id",
      { username: "ada" },
      "sfr",
    );
  });
});
