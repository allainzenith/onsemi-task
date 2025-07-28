// =================================================
// Scraping service for extracting data from Onsemi
// =================================================
const https = require("https");
const axios = require("axios");
const {
  destroyBrowser,
  returnPageAndBrowserInstance,
} = require("../config/puppeteer.ts");

const {
  returnFolder,
  loadCsvFileAsJson,
  deleteFile,
  writeFileStream,
  writeFile,
} = require("./file-handling.js");

const TECHNICAL_DOCUMENTATION_URL =
  "https://www.onsemi.com/design/technical-documentation";

const FORUM_URLS = [
  "https://community.onsemi.com/s/datacategory",
  "https://community.onsemi.com/s/topic/0TO4V000000QUzVWAW/discrete-power-modules",
];

let page;
let browser;

async function extractOnsemiData(retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      await initializeBrowserAndPage();

      // await extractTechnicalDocumentation();
      // await extractForumInfo();
      // destroyBrowser();
      return;
    } catch (err) {
      console.warn(`Attempt ${i + 1} failed: ${err.message}`);
    }
  }
  throw new Error(`Failed to load url after many attempts`);
}

async function extractTechnicalDocumentation() {
  try {
    await page.goto(TECHNICAL_DOCUMENTATION_URL, {
      waitUntil: "load",
    });

    // Check all dropdown buttons
    await delay(1000);
    await clickElementsInArray([
      ".filter-by-taxonomy > ul > li > .form-check > button[aria-label='Toggle Dropdown'] i.bi-chevron-down",
    ]);

    const taxonomyFilters = await page.$$(
      ".filter-by-taxonomy > ul > li > .form-check + ul > li > div"
    );

    for (const filter of taxonomyFilters) {
      try {
        await delay(1000);
        const filterCheckbox = await filter.$(
          ":scope > input.form-check-input"
        );
        const electronicPart = await filter.$eval(
          ":scope > label",
          (label) => label.textContent
        );
        await filterCheckbox.click();
        console.log("Clicked electronic part filter..", electronicPart);
        // Check applicable doc types
        await clickElementsInArray(
          [
            ".filter-by-type input[value='Application Notes']:not(input[disabled])",
            ".filter-by-type input[value='Data Sheet']:not(input[disabled])",
            ".filter-by-type input[value='White Papers']:not(input[disabled])",
          ],
          true
        );
        console.log("Clicked document type filter..");
        // Export search results from filter
        await exportResults(page, electronicPart, "Onsemi");
        // Clear first and end filter
        await clickElementsInArray(['button[aria-label="Clear Filter"]'], true);
        console.log("Clicked reset buttons..");
        // break;
      } catch (error) {
        console.log("Error:", error);
      }
    }

    // destroyBrowser();
  } catch (error) {
    console.error("Error extracting documentation: ", error);
  }
}

async function extractForumInfo() {
  try {
    await extractDataCategory(FORUM_URLS[0]);
    await extractTopics(FORUM_URLS[1]);
  } catch (error) {
    console.error("Error extracting forum info: ", error.message);
  }
}

async function extractDataCategory(url) {
  const categories = [
    "Discrete & Power Modules",
    "Power Management",
    "Signal Conditioning & Control",
    "Sensors",
    "Motor Control",
    "Custom & ASSP",
    "Interfaces",
    "Wireless Connectivity",
    "Timing, Logic & Memory",
    "Packaging",
    "Tools and Software",
    "Nomenclature / Part Marking",
    "Thermal Management",
  ];
  try {
    await page.goto(url, {
      waitUntil: "load",
    });

    for (const category of categories) {
      const newPage = await browser.newPage();
      await newPage.goto(url, {
        waitUntil: "load",
      });

      // const selector = `h6 + div[c-datacategorylistview_datacategorylistview] > div[data-category='${category}']`;
      const selector = `div.dataBox`;
      const categoryButton = await newPage.$eval(
        selector,
        (selector) => selector.outerHTML
      );

      console.log(categoryButton);

      // await categoryButton.click();
      console.log("clicked section");
      await delay(3000);
      await newPage.close();
    }
  } catch (error) {
    console.error("Error extracting data category info: ", error.message);
  }
}

async function extractTopics(url) {
  try {
  } catch (error) {
    console.error("Error extracting topics: ", error.message);
  }
}

async function exportResults(page, electronicPart, companyName) {
  try {
    // Download CSV file
    await downloadFile(page, "output/csv", "button.document-search-export-btn");
    // Read CSV to JSON format
    const dlPath =
      (await returnFolder(`output/csv`)) + "/document-search-export.csv";
    const jsonContent = loadCsvFileAsJson(dlPath)?.map((content) => {
      return {
        filename: content?.["Name"]?.replace("/", ""),
        description: content?.["Document Title"],
        url: content?.["Link"],
      };
    });
    const path = await returnFolder(
      `output/datasheets/${electronicPart?.replace("/", "")}/${companyName}`
    );
    // Save JSON content to a file
    writeFile(
      path + `/${electronicPart?.replace("/", "")}_${companyName}.json`,
      JSON.stringify(jsonContent, null, 2)
    );

    for (const content of jsonContent) {
      await downloadFileUsingLink(path, content);
      // break;
    }

    deleteFile(dlPath);
  } catch (error) {
    console.error("Error: ", error);
  }
}

let retries = 0;

// ==================
// ACTIONS
// ==================
async function downloadFile(page, path, buttonSelector) {
  const client = await createCDPSession(page, true, path);

  // Export logic
  const button = await page.$(buttonSelector);

  await button.click();

  await delay(5000);

  await destroyCDPSession(client);
}

async function downloadFileUsingLink(filePath, content) {
  try {
    const options = {
      Accept:
        "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
      "Accept-Encoding": "gzip, deflate, br, zstd, identity",
      "Accept-Language": "en-US,en;q=0.9",
      "Cache-Control": "max-age=0",
      Connection: "keep-alive",
      Cookie: "Apache=834f1f74.63b01b5664a61",
      Host: "www.onsemi.com",
      "Sec-Fetch-Dest": "document",
      "Sec-Fetch-Mode": "navigate",
      "Sec-Fetch-Site": "none",
      "Sec-Fetch-User": "?1",
      "Upgrade-Insecure-Requests": "1",
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36",
      Referer: "https://www.onsemi.com/",
    };

    const response = await axios.get(content?.url, {
      responseType: "stream",
      headers: options,
    });

    writeFileStream(
      filePath + `/${content?.filename?.replace("/", "")}.pdf`,
      response.data
    );
  } catch (err) {
    console.error("❌ Download error:", err.message);

    if (retries < 3) {
      retries++;
      console.log("Retrying again..");
      await downloadFileUsingLink(filePath, content);
    } else {
      console.log("Failed after three attempts.");
      retries = 0;
    }
  }
}

async function createCDPSession(page, isDownload, path) {
  try {
    const client = await page.target().createCDPSession();

    if (isDownload) {
      const downloadPath = await returnFolder(path);

      await client.send("Page.setDownloadBehavior", {
        behavior: "allow",
        downloadPath: downloadPath,
      });
    }

    return client;
  } catch (error) {
    console.error(error.message);
  }
}

async function destroyCDPSession(client) {
  if (client) await client.detach();
}

async function initializeBrowserAndPage() {
  const { thisBrowser, thisPage } = await returnPageAndBrowserInstance();
  browser = thisBrowser;
  page = thisPage;
}

async function clickElementsInArray(selectorNameArr, isFilter) {
  isFilter = isFilter || false;
  let elementArray = [];

  for (const sName of selectorNameArr) {
    const elArr = await page.$$(sName);
    elementArray = elementArray.concat(elArr);
  }

  for (const el of elementArray) {
    try {
      await delay(1000);
      await el.click();
      await checkIfButtonDisabled(
        "button.document-search-quick-ref-btn",
        page,
        30000
      );
    } catch (error) {
      await page.reload();
    }
  }
  return elementArray;
}

async function checkIfButtonDisabled(selector, page, timeout) {
  await page.waitForFunction(
    (selector) => {
      const el = document.querySelector(selector);
      return el && !el.disabled;
    },
    { timeout: timeout },
    selector
  );
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

module.exports = {
  extractTechnicalDocumentation,
  extractForumInfo,
  extractOnsemiData,
};
