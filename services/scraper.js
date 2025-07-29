// =================================================
// Scraping service for extracting data from Onsemi
// =================================================
const https = require("https");
const axios = require("axios");
const { techDocHeaders, forumHeaders } = require("../config/httpHeaders.ts");

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

      await extractTechnicalDocumentation();
      await extractForumInfo();
      destroyBrowser();
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
      } catch (error) {
        console.log("Error:", error);
      }
    }
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
    const path = await returnFolder("output/forums");
    for (const category of categories) {
      await page.goto(url, {
        waitUntil: "load",
      });
      await clickDataCategory(category);

      const articleSelector = "c-data-category-list-view > article > h6 > a";

      await page.waitForSelector(articleSelector, { timeout: 8000 });

      const articleLinks = await page.$$eval(articleSelector, (elements) =>
        elements.map((el) => el.getAttribute("data-title"))
      );

      await extractForumData(articleLinks);

      await delay(3000);
      await page.close();

      page = await browser.newPage();
    }
  } catch (error) {
    console.error("Error extracting data category info: ", error.message);
  }
}

async function clickDataCategory(category) {
  const selector = `h6 + div div[data-category="${category}"] h5`;

  await page.waitForSelector(selector, { timeout: 8000 });

  const elements = await page.$$(selector);

  await elements[0].click();

  console.log("Clicked data category..");
}

async function extractForumData(articleLinks) {
  for (const link of articleLinks) {
    await Promise.all([
      await page.goto("https://community.onsemi.com/s/article/" + link),
      await page.waitForSelector(
        'article.content div[data-target-selection-name*="ArticleNumber"]',
        { timeout: 10000 }
      ),
    ]);

    await saveForumData(link);

    await delay(5000);
  }
}

async function extractTopics(url) {
  try {
    await page.goto(url, { waitUntil: "load" });
    const viewMoreButtonSelector = 'button[aria-label="View More Posts"]';
    let isButtonFound = await isViewMoreButtonFound(viewMoreButtonSelector);
    let buttonEl;
    let isAttached;
    while (isButtonFound) {
      buttonEl = await page.$(viewMoreButtonSelector);

      if (buttonEl) {
        isAttached = await buttonEl.evaluate((el) => document.contains(el));
      }

      if (!buttonEl || !isAttached) break;
      await buttonEl?.click();
      await delay(1000);
      console.log("Clicking view more button..");
    }

    console.log("Finished clicking button.");

    const allTopics = await page.$$eval(
      ".compactFeedListItem div article div[data-aura-rendered-by] > a",
      (links) => links.map((link) => link?.href)
    );

    for (const link of allTopics) {
      await page.goto(link, { waitUntil: "load" });
      await saveTopicData();
    }
  } catch (error) {
    console.error("Error extracting topics: ", error.message);
  }
}

async function isViewMoreButtonFound(selectorName) {
  try {
    await page.waitForSelector(selectorName, { timeout: 10000 });
    return true;
  } catch (error) {
    return false;
  }
}

let topicNumber = 1;

async function saveTopicData() {
  try {
    const url = await page.url();
    const match = url.match(/\/s\/question\/([^/]+)/);
    const postName = match ? match[1] : `Topic_${topicNumber}`;

    if (!match) {
      topicNumber++;
    }

    const filePath = await returnFolder(`output/forums/${postName}`);
    const jsonData = {};

    // Start scraping values
    const questionSelector =
      ".cuf-body.cuf-questionTitle.forceChatterFeedBodyQuestionWithoutAnswer";

    await page.waitForSelector(questionSelector);

    const questionText = await extractDataForASelector(
      questionSelector,
      "textContent",
      false
    );

    const dateSelector = ".forceChatterFeedItemHeader > div > a.cuf-timestamp";

    let date = await extractDataForASelector(
      dateSelector,
      "textContent",
      false
    );

    if (date) {
      date = date.split("at")?.[0]?.trim();
    }

    // =====

    let answers = [];

    const answerSelector =
      ".cuf-feedback.slds-feed__item-comments.threaded-discussion.has-comments.feed__item-comments--threadedCommunity ul li.cuf-commentLi";

    const answerHandles = await page.$$(answerSelector);

    let answerImgs = 1;

    for (const answerHandle of answerHandles) {
      const username = await answerHandle
        .$eval(".cuf-commentNameLink span.uiOutputText", (el) =>
          el.textContent.trim()
        )
        .catch(() => "");

      const answerText = await answerHandle
        .$eval(".slds-comment__content", (el) => el.textContent.trim())
        .catch(() => "");

      const imgSrcs = await answerHandle.$$eval("img", (imgs) =>
        imgs.map((img) => img?.src?.replace(/^https?\./, "https://"))
      );

      const answerHTML = await answerHandle
        .$eval("article", (el) => el?.innerHTML)
        .catch(() => "");

      for (const imgSrc of imgSrcs) {
        if (imgSrc) {
          await downloadFileUsingLink(
            filePath,
            {
              url: imgSrc,
              filename: `${postName}_reply_${answerImgs}`,
            },
            "png",
            forumHeaders
          );
          answerImgs++;
        }
      }

      answers.push({
        username,
        content: [
          {
            type: "text",
            content: answerText,
          },
          {
            type: "html",
            content: answerHTML,
          },
          ...imgSrcs
            .filter(Boolean)
            .map((src) => ({ type: "image", content: src })),
        ],
      });
    }

    // Extract replies

    const replyParentSelector = ".forceChatterThreadedComment";

    const repliesHandles = await page.$$(replyParentSelector);
    const replies = [];

    let replyImgs = 1;

    for (const article of repliesHandles) {
      const textContent = await article
        .$eval(
          ".cuf-feedBodyText.forceChatterMessageSegments.forceChatterFeedBodyText .feedBodyInner.Desktop",
          (el) => el.textContent.trim()
        )
        .catch(() => "");

      const username = await article
        .$eval(
          "span.cuf-entityLinkId.forceChatterEntityLink.entityLinkHover a",
          (el) => el.getAttribute("title").trim()
        )
        .catch(() => "");

      const imgSrcs = await article.$$eval("img", (imgs) =>
        imgs.map((img) => img?.src?.replace(/^https?\./, "https://"))
      );

      for (const imgSrc of imgSrcs) {
        if (imgSrc) {
          await downloadFileUsingLink(
            filePath,
            {
              url: imgSrc,
              filename: `${postName}_reply_${replyImgs}`,
            },
            "png",
            forumHeaders
          );
          replyImgs++;
        }
      }

      replies.push({
        username,
        content: [
          {
            type: "text",
            content: textContent,
          },
          ...imgSrcs
            .filter(Boolean)
            .map((src) => ({ type: "image", content: src })),
        ],
      });
    }

    const tags = await page.$$eval("ul.topic-commaSeparatedList li a", (tags) =>
      tags.map((tag) => {
        return {
          name: tag?.textContent?.trim(),
          link: tag?.href?.trim(),
        };
      })
    );

    jsonData["Link"] = await page.url();
    jsonData["Question"] = questionText;
    jsonData["Title"] = questionText;
    jsonData["Date"] = date;

    jsonData["Best Answer"] = jsonData["Best Answer"] || {};
    jsonData["Best Answer"]["content"] = answers?.[0];

    jsonData["All Answers"] = jsonData["All Answers"] || {};
    jsonData["All Answers"]["content"] =
      answers.slice(1, answers.length)?.length > 0
        ? answers.slice(1, answers.length)?.length
        : answers;

    jsonData["Replies"] = replies;

    jsonData["Tags"] = tags;

    writeFile(
      filePath + `/${postName}.json`,
      JSON.stringify(jsonData, null, 2)
    );
  } catch (error) {
    console.error("Error saving topic data: ", error?.message);
  }
}

async function saveForumData(link) {
  try {
    const postNameSelector =
      'article.content div[data-target-selection-name*="ArticleNumber"] span.test-id__field-value';

    const postNameFolder = await extractDataForASelector(
      postNameSelector,
      "textContent",
      false
    );

    const filePath = await returnFolder(`output/forums/${postNameFolder}`);
    const jsonData = {};

    const date = await extractDataForASelector(
      ".selfServiceArticleHeaderDetail span.uiOutputDate",
      "textContent",
      false
    );

    const titleSelector =
      'article.content div[data-target-selection-name*="Title"]';

    const titleText = await extractDataForASelector(
      titleSelector + " span.test-id__field-value",
      "textContent",
      false
    );

    let answers = [];
    let answer;

    const answerSelector =
      'article.content div[data-target-selection-name*="Answer"]';

    const answerText = await extractDataForASelector(
      answerSelector + " span.test-id__field-value",
      "textContent",
      false
    );

    answer = pushToAnswers(answerText, "text");
    answer && answers.push(answer);

    const answerimgSrcs = await page.$$eval(answerSelector + " img", (imgs) =>
      imgs.map((img) => img?.src?.replace(/^https?\./, "https://"))
    );

    let numImgs = 1;

    for (const imgSrc of answerimgSrcs) {
      if (imgSrc) {
        await downloadFileUsingLink(
          filePath,
          {
            url: imgSrc,
            filename: `${postNameFolder}_answer_${numImgs}`,
          },
          "png",
          forumHeaders
        );
        numImgs++;
      }
    }

    answer = pushToAnswers(answerimgSrcs, "image");
    answer && answers.push(answer);

    const answerHTML = await extractDataForASelector(
      answerSelector,
      "innerHTML",
      false
    );

    answer = pushToAnswers(answerHTML, "html");
    answer && answers.push(answer);

    //========

    const detailsSelector =
      'article.content div[data-target-selection-name*="Details"]';

    const detailsText = await extractDataForASelector(
      detailsSelector + " span.test-id__field-value",
      "textContent",
      false
    );

    answer = pushToAnswers(detailsText, "text");
    answer && answers.push(answer);

    const detailimgSrcs = await page.$$eval(detailsSelector + " img", (imgs) =>
      imgs.map((img) => img?.src?.replace(/^https?\./, "https://"))
    );

    let detailnumImgs = 1;

    for (const imgSrc of detailimgSrcs) {
      if (imgSrc) {
        await downloadFileUsingLink(
          filePath,
          {
            url: imgSrc,
            filename: `${postNameFolder}_detail_${detailnumImgs}`,
          },
          "png",
          forumHeaders
        );
        detailnumImgs++;

        answer = pushToAnswers(imgSrc, "image");
        answer && answers.push(answer);
      }
    }

    const detailsHTML = await extractDataForASelector(
      detailsSelector,
      "innerHTML",
      false
    );

    answer = pushToAnswers(detailsHTML, "html");
    answer && answers.push(answer);

    // =================

    const userNameWhoPosted = await extractDataForASelector(
      "span.cuf-entityLinkId.forceChatterEntityLink.entityLinkHover > div",
      "title",
      true
    );

    const replyParentSelector = ".forceChatterThreadedComment article";

    const repliesHandles = await page.$$(replyParentSelector);
    const replies = [];

    let replyImgs = 1;

    for (const article of repliesHandles) {
      const textContent = await article
        .$eval(
          ".cuf-feedBodyText.forceChatterMessageSegments.forceChatterFeedBodyText .feedBodyInner.Desktop",
          (el) => el.textContent.trim()
        )
        .catch(() => "");

      const username = await article
        .$eval(
          "span.cuf-entityLinkId.forceChatterEntityLink.entityLinkHover a",
          (el) => el.getAttribute("title").trim()
        )
        .catch(() => "");

      const imgSrcs = await article.$$eval("img", (imgs) =>
        imgs.map((img) => img?.src?.replace(/^https?\./, "https://"))
      );

      for (const imgSrc of imgSrcs) {
        if (imgSrc) {
          await downloadFileUsingLink(
            filePath,
            {
              url: imgSrc,
              filename: `${postNameFolder}_reply_${replyImgs}`,
            },
            "png",
            forumHeaders
          );
          replyImgs++;
        }
      }

      replies.push({
        username,
        content: [
          {
            type: "text",
            content: textContent,
          },
          ...imgSrcs
            .filter(Boolean)
            .map((src) => ({ type: "image", content: src })),
        ],
      });
    }

    const tags = await page.$$eval(
      ".selfServiceArticleTopicList.selfServiceArticleLayout a",
      (tags) =>
        tags.map((tag) => {
          return {
            name: tag?.textContent?.trim(),
            link: tag?.getAttribute("href")?.trim(),
          };
        })
    );

    jsonData["Link"] = await page.url();
    jsonData["Question"] = link;
    jsonData["Title"] = titleText;
    jsonData["Date"] = date;
    jsonData["Best Answer"] = jsonData["Best Answer"] || {};
    jsonData["Best Answer"]["username"] = userNameWhoPosted;
    jsonData["Best Answer"]["content"] = answers;
    jsonData["Replies"] = replies;
    jsonData["Tags"] = tags;

    writeFile(
      filePath + `/${postNameFolder}.json`,
      JSON.stringify(jsonData, null, 2)
    );
  } catch (error) {
    console.error("Error saving forum data: ", error.message);
  }
}

function pushToAnswers(answer, answerType) {
  if (answer && typeof answer === "string") {
    return {
      type: answerType,
      content: answer,
    };
  }

  return null;
}

async function extractDataForASelector(
  selectorName,
  attribute,
  useGetAttributeFunc
) {
  const el = await page.$(selectorName);
  if (el) {
    return await page.$eval(
      selectorName,
      (el, { attribute, useGetAttributeFunc }) =>
        useGetAttributeFunc ? el.getAttribute(attribute) : el?.[attribute],
      { attribute, useGetAttributeFunc }
    );
  }

  return null;
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
      await downloadFileUsingLink(path, content, "pdf", techDocHeaders);
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

async function downloadFileUsingLink(
  filePath,
  content,
  fileType,
  passedHeaders
) {
  try {
    const httpsAgent = new https.Agent({
      rejectUnauthorized: false,
    });

    const response = await axios.get(content?.url, {
      responseType: "stream",
      headers: passedHeaders,
      httpsAgent,
    });

    writeFileStream(
      filePath + `/${content?.filename?.replace("/", "")}.${fileType}`,
      response.data
    );
  } catch (err) {
    console.error("❌ Download error:", err.message);

    if (retries < 3) {
      retries++;
      console.log("Retrying again..");
      await downloadFileUsingLink(filePath, content, fileType, passedHeaders);
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
