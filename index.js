const fetch = require("node-fetch");
const UserAgent = require("user-agents");

const Cookies = new Map();
const BASE_HEADERS = {
  "user-agent": new UserAgent().toString(),
  Accept: "application/json, text/plain, */*",
  "Accept-Encoding": "gzip, deflate, br",
  "Accept-Language": "fr=FR, en-US",
  "Sec-Fetch-Dest": "empty",
  "Sec-Fetch-Mode": "cors",
  "Sec-Fetch-Site": "same-origin",
  "Cache-Control": "no-cache",
  Connection: "keep-alive",
  Origin: `https://www.vinted.fr`,
  DNT: "1",
  "Upgrade-Insecure-Requests": "1",
  TE: "trailers",
  "Sec-Ch-Ua-Mobile": "?1",
  Priority: "u=0, i",
};
async function fetchCookie(domain) {
  if (!domain) {
    domain = "fr";
  }

  const url = `https://www.vinted.${domain}`;
  const response = await fetch(url, {
    headers: {
      ...BASE_HEADERS,
    },
  });

  if (response?.headers.get("set-cookie")) {
    const cookies = response?.headers.get("set-cookie").split(", ");

    const vintedCookie = cookies.find((cookie) =>
      cookie.startsWith("access_token_web")
    );
    if (vintedCookie) {
      const cookie = vintedCookie.split(";")[0];
      console.log(`Fetched cookie: ${cookie}`);

      Cookies.set(domain, cookie);
      return { cookie: cookie };
    } else {
      throw new Error("Session cookie not found in the headers.");
    }
  }

  throw new Error("No cookies found in the headers.");
}

/**
 * Parse a vinted URL to get the querystring usable in the search endpoint
 */
const parseVintedURL = (url, disableOrder, allowSwap, customParams = {}) => {
  try {
    const decodedURL = decodeURI(url);
    const matchedParams = decodedURL.match(/^https:\/\/www\.vinted\.([a-z]+)/);
    if (!matchedParams)
      return {
        validURL: false,
      };

    const missingIDsParams = ["catalog", "status"];
    const params = decodedURL.match(
      /(?:([a-z_]+)(\[\])?=([a-zA-Z 0-9._À-ú+%]*)&?)/g
    );
    if (typeof matchedParams[Symbol.iterator] !== "function")
      return {
        validURL: false,
      };
    const mappedParams = new Map();
    for (let param of params) {
      let [_, paramName, isArray, paramValue] = param.match(
        /(?:([a-z_]+)(\[\])?=([a-zA-Z 0-9._À-ú+%]*)&?)/
      );
      if (paramValue?.includes(" ")) paramValue = paramValue.replace(/ /g, "+");
      if (isArray) {
        if (missingIDsParams.includes(paramName)) paramName = `${paramName}_id`;
        if (mappedParams.has(`${paramName}s`)) {
          mappedParams.set(`${paramName}s`, [
            ...mappedParams.get(`${paramName}s`),
            paramValue,
          ]);
        } else {
          mappedParams.set(`${paramName}s`, [paramValue]);
        }
      } else {
        mappedParams.set(paramName, paramValue);
      }
    }
    for (let key of Object.keys(customParams)) {
      mappedParams.set(key, customParams[key]);
    }
    const finalParams = [];
    for (let [key, value] of mappedParams.entries()) {
      finalParams.push(
        typeof value === "string"
          ? `${key}=${value}`
          : `${key}=${value.join(",")}`
      );
    }

    return {
      validURL: true,
      domain: matchedParams[1],
      querystring: finalParams.join("&"),
    };
  } catch (e) {
    return {
      validURL: false,
    };
  }
};

/**
 * Searches something on Vinted
 */

// Fetch brands on vinted
const fetchBrands = async (keyword, domain) => {
  if (!domain) domain = "fr";

  return await fetchVinted(
    `https://vinted.${domain}/api/v2/brands?keyword=${keyword}`,
    domain
  )
    .then((data) => {
      return data;
    })
    .catch((err) => {
      throw err;
    });
};

const fetchVinted = async (url, domain) => {
  if (!domain) domain = "fr";
  const c =
    Cookies.get(domain) ??
    process.env[`VINTED_API_${domain.toUpperCase()}_COOKIE`];
  if (c) console.log(`[*] Using cached cookie for ${domain}`);
  if (!c) {
    console.log(`[*] Fetching cookie for ${domain}`);
    await fetchCookie(domain).catch(() => {});
  }

  return new Promise((resolve, reject) => {
    const controller = new AbortController();
    fetch(url, {
      signal: controller.signal,
      headers: {
        ...BASE_HEADERS,
        Cookie: c,
      },
    })
      .then((res) => {
        res.text().then((text) => {
          controller.abort();
          try {
            resolve(JSON.parse(text));
          } catch (e) {
            reject(text);
          }
        });
      })
      .catch((err) => {
        controller.abort();
        reject("Can not fetch Vinted API " + err);
      });
  });
};

const search = (
  url,
  disableOrder = false,
  allowSwap = false,
  customParams = {}
) => {
  return new Promise(async (resolve, reject) => {
    const { validURL, domain, querystring } = parseVintedURL(
      url,
      disableOrder ?? false,
      allowSwap ?? false,
      customParams
    );

    if (!validURL) {
      console.log(`[!] ${url} is not valid in search!`);
      return resolve([]);
    }

    fetchVinted(
      `https://www.vinted.be/api/v2/catalog/items?${querystring}`,
      domain
    )
      .then((data) => {
        resolve(data);
      })
      .catch(async (e) => {
        try {
          if (JSON.parse(e).message === `Token d'authentification invalide`) {
            await fetchCookie();
          }
        } catch {}
        reject("Can not fetch search API " + e);
      });
  });
};

function clearCookies() {
  Cookies.clear();
}

module.exports = {
  fetchCookie,
  parseVintedURL,
  clearCookies,
  fetchBrands,
  search,
};
