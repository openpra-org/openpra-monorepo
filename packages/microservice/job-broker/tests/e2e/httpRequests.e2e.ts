import fs from "node:fs";
import * as superagent from "superagent";

// Read the data from XML file and convert it to base64 string
const xmlContent = fs.readFileSync("./fixtures/models/generic-openpsa-models/models/Aralia/baobab3.xml", {
  encoding: "utf8",
});
const model = Buffer.from(xmlContent, "utf-8").toString("base64");

describe("It should send HTTP requests to specified endpoints", () => {
  for (let i = 0; i < 500; i++) {
    it("Should send requests", () => {
      void (async (): Promise<void> => {
        try {
          await superagent.post("https://review-psa2025.app.openpra.org/q/quantify/scram").send({
            model_name: "test-500",
            configuration: {
              mocus: true,
              mcub: true,
              probability: true,
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
