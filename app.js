const port = process.env.PORT || 3006;

const { extractOnsemiData } = require("./services/scraper.js");
if (!port) {
  console.error("ERROR: Specify port number!");
  process.exit(12);
}

const express = require("express");

/**
 * A straightforward Node.js app that scrapes files from specific websites
 * to collect Onsemi data
 */

const app = express();

async function main() {
  await extractOnsemiData();
}

app.listen(port, () => {
  `Application running on port: ${port}`;
  main();
});
