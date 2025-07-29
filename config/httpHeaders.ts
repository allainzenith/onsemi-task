const techDocHeaders = {
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

const forumHeaders = {
  accept:
    "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
  "accept-encoding": "gzip, deflate, br, zstd",
  "accept-language": "en-US,en;q=0.9",
  "cache-control": "max-age=0",
  cookie:
    "CookieConsentPolicy=0:1; LSKey-c$CookieConsentPolicy=0:1; _ga=GA1.1.1890825068.1753772034; pctrk=8c047634-d44c-4959-b7e0-e4f3dab310dc; _ga_REKBWSN5ZP=GS2.1.s1753772033$o1$g1$t1753772189$j27$l0$h0",
  "if-modified-since": "Wed, 6 Dec 2023 14:36:24 GMT",
  priority: "u=0, i",
  "sec-ch-ua": `" Not A;Brand";v="99", "Chromium";v="138", "Google Chrome";v="138"`,
  "sec-ch-ua-mobile": "?0",
  "sec-ch-ua-platform": `"Mac OS X"`,
  "sec-fetch-dest": "document",
  "sec-fetch-mode": "navigate",
  "sec-fetch-site": "none",
  "sec-fetch-user": "?1",
  "upgrade-insecure-requests": "1",
  "user-agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36",
};

module.exports = {
  techDocHeaders,
  forumHeaders,
};
