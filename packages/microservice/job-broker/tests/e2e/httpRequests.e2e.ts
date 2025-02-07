import fs from "node:fs";
import * as superagent from "superagent";

// Read the data from XML file and convert it to base64 string
const xmlContent = fs.readFileSync("./fixtures/models/generic-openpsa-models/models/Aralia/baobab3.xml", {
  encoding: "utf8",
});
const model = Buffer.from(xmlContent, "utf-8").toString("base64");

describe("It should send HTTP requests to 3000 port", () => {
  for (let i = 0; i < 1000; i++) {
    it("Should send requests", () => {
      void (async (): Promise<void> => {
        try {
          await superagent.post("http://localhost:3000/q/quantify/scram").send({
            model_name: "uqds_1000",
            configuration: {
              mocus: true,
              mcub: true,
              probability: true,
              uncertainty: true,
              "num-trials": 1000,
            },
            models: [model],
          });
        } catch (err) {
          console.error(err);
        }
      })();
    });
  }
});
