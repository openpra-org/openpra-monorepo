import fs from "node:fs";
import * as superagent from "superagent";

// Read the data from XML file and convert it to base64 string
const xmlContent = fs.readFileSync("./fixtures/models/generic-openpsa-models/models/Aralia/baobab3.xml", {
  encoding: "utf8",
});
const model = Buffer.from(xmlContent, "utf-8").toString("base64");

describe("It should send HTTP requests to specified endpoints", () => {
  for (let i = 0; i < 10000; i++) {
    it("Should send requests", () => {
      (async () => {
        try {
          await superagent.post("https://review-cherry-pick-tests-openpra-169.app.openpra.org/q/quantify/scram").send({
            mocus: true,
            mcub: true,
            probability: true,
            uncertainty: true,
            "num-trials": 10000,
            models: [model],
          });
        } catch (err) {
          console.error(err);
        }
      })();
    });
  }
});
