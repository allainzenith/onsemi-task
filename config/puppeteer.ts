const puppeteer = require("puppeteer-extra");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");

puppeteer.use(StealthPlugin());
let thisPage;
let thisBrowser;
async function launchPuppeteerInstance() {
  const args = ["--disable-web-security", "--start-fullscreen", "--no-sandbox"];

  const launchParams = {
    ignoreHTTPSErrors: true,
    headless: "new",
    args: args,
  };

  try {
    thisBrowser = await puppeteer.launch(launchParams);

    thisPage = await thisBrowser.newPage();

    await thisPage.setBypassCSP(true);
    await thisPage.setDefaultTimeout(60000);

    await thisPage.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36"
    );

    await thisPage.setExtraHTTPHeaders({
      "Accept-Language": "en-US,en;q=0.9",
    });

    // Ensures total coverage of all visible items on the page
    await thisPage.setViewport({
      width: 1920,
      height: 1080,
    });

    return { thisBrowser, thisPage };
  } catch (error) {
    console.error(
      "Something went wrong while launching the puppeteer instance. ",
      error
    );

    destroyBrowser();
    return null;
  }
}

async function returnPageAndBrowserInstance() {
  if (!thisPage || !thisBrowser) {
    await launchPuppeteerInstance();
  }

  return { thisBrowser, thisPage };
}

async function destroyBrowser() {
  if (thisBrowser) {
    await thisBrowser.close();
  }
}

module.exports = {
  launchPuppeteerInstance,
  returnPageAndBrowserInstance,
  destroyBrowser,
};
