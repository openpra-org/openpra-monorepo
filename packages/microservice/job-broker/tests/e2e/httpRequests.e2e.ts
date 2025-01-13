import fs from "node:fs";
import * as superagent from "superagent";

// Read the data from XML file and convert it to base64 string
const xmlContent = fs.readFileSync("./fixtures/models/generic-openpsa-models/models/Aralia/ftr10.xml", {
  encoding: "utf8",
});
const model = Buffer.from(xmlContent, "utf-8").toString("base64");

describe("It should send HTTP requests to specified endpoints", () => {
  it("Should send requests", () => {
    (async () => {
      try {
        const { body } = await superagent
          .post("https://review-cherry-pick-tests-openpra-169.app.openpra.org/q/quantify/scram")
          .send({
            bdd: true,
            "limit-order": 5,
            probability: true,
            models: [model],
          });
        console.log(body);
      } catch (err) {
        console.error(err);
      }
    })();
  });
});
