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
          const { body } = await superagent
            .post("https://review-cherry-pick-tests-openpra-169.app.openpra.org/q/quantify/scram")
            .send({
              mcub: true,
              mocus: true,
              "limit-order": 1000,
              probability: true,
              models: [model],
            });
          console.log(body);
        } catch (err) {
          console.error(err);
        }
      })();
    });
  }
});
