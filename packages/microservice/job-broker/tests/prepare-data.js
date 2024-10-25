// prepare-data.js
const fs = require("fs");
const path = require("path");

console.log(__dirname);
const rootDir = path.resolve(__dirname, "./input/aralia/xml");
const outputFile = path.resolve(__dirname, "quantifyRequests.json");

const quantifyRequests = [];

const xmlFiles = fs.readdirSync(rootDir);
xmlFiles.forEach((file) => {
  const contents = fs.readFileSync(path.join(rootDir, file), "utf-8");
  const contentsBase64 = Buffer.from(contents, "utf-8").toString("base64");
  const config = {
    mocus: true,
    mcub: true,
    probability: true,
    "no-indent": true,
    models: [contentsBase64],
  };
  quantifyRequests.push(config);
});

fs.writeFileSync(outputFile, JSON.stringify(quantifyRequests, null, 2), "utf-8");
console.log(`Quantify requests prepared and saved to ${outputFile}`);
