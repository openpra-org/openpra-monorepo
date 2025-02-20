import fs from "node:fs";

// Read the data from XML file and convert it to base64 string
const xmlContent = fs.readFileSync("./fixtures/models/generic-openpsa-models/models/Aralia/baobab3.xml", {
  encoding: "utf8",
});
const model = Buffer.from(xmlContent, "utf-8").toString("base64");

describe("It should send HTTP requests to specified endpoints", () => {
  it("Should send requests", async () => {
    for (let i = 0; i < 10; i++) {
      await fetch("https://v2-app.openpra.org/q/quantify/scram", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          mocus: true,
          mcub: true,
          probability: true,
          models: [model],
        }),
      }).then((response) => {
        console.log(`Request ${String(i)} is completed!`);
      });
    }
  }, 90000);
});
