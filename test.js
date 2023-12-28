const { fetchCookie, search } = require("./index");


fetchCookie().then(res => {
    search('https://www.vinted.fr/vetements?search_text=converse').then(res => {
        console.log(res)
    })
})