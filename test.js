import { fetchCookie, search } from "./index.js";

await fetchCookie().then((res) => {
  console.log(res);
  search("https://www.vinted.fr/vetements?search_text=converse").then((res) => {
    console.log(res);
  });
});
