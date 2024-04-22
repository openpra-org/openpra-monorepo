import { BasicEvent } from "./BasicEvent";

describe("BasicEvent", () => {
  let basicEvent: BasicEvent;
  const testName = "Event1";
  const testProb = 0.5;
  const testNumBasic = 3;

  beforeEach(() => {
    basicEvent = new BasicEvent(testName, testProb, testNumBasic);
  });

  it("should create an instance with correct properties", () => {
    expect(basicEvent.name).toBe(testName);
    expect(basicEvent.prob).toBe(testProb);
    expect(basicEvent.numBasic).toBe(testNumBasic);
  });

  it("should produce correct XML output", () => {
    const expectedXML = `<define-basic-event name="${testName}">
              <float value="${testProb}"/>
            </define-basic-event>`;
    expect(basicEvent.toXML()).toBe(expectedXML);
  });

  it("should produce correct Aralia output", () => {
    const expectedAralia = `p(${testName}) = ${testProb}`;
    expect(basicEvent.toAralia()).toBe(expectedAralia);
  });

  it("should produce correct SAPHIRE JSON output", () => {
    const expectedJSON = JSON.stringify(
      {
        id: testName.replace("B", ""),
        corrgate: "0",
        name: testName,
        evworkspacepair: { ph: 1, mt: 1 },
        value: testProb,
        initf: "",
        processf: "",
        calctype: "1",
      },
      null,
      2,
    );
    expect(basicEvent.toSAPHIREJson()).toBe(expectedJSON);
  });

  it("should produce correct OpenPRA JSON output", () => {
    const expectedOpenPRAJSON = JSON.stringify(
      {
        [testName]: {
          role: "public",
          label: {
            name: `Basic Event: ${testName}`,
            description: "",
          },
          expression: {
            value: testProb,
            _proxy: "Float",
          },
          source_type: "hcl",
        },
      },
      null,
      2,
    );
    expect(basicEvent.toOpenPRAJson()).toBe(expectedOpenPRAJSON);
  });
});
