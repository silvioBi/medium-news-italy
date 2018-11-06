const express = require('express')
const request = require('request')
const cheerio = require('cheerio')
const PORT = process.env.PORT || 80

let app = express()

let getNews = callback => {
    let news = []
    let url = 'https://medium.com/italia'
    request(url, function (error, response, html) {
        if (!error) {
            let $ = cheerio.load(html)
            let article = { title: null, link: null }
            $('h3').filter(function () {
                // Let's store the data we filter into a variable so we can easily see what's going on.
                let data = $(this)
                // In examining the DOM we notice that the title rests within the first child element of the h3 tag. 
                // Utilizing jQuery we can easily navigate and get the text by writing the following code:
                article.title = data.children().first().text()
                // Similar approach is taken for the article link
                article.link = data.children().first().attr('href')
                if (!article.link) article.link = data.parent().attr('href')
                news.push(article)
            })
            callback(news)
        }
    })
}

app.get('/', function (req, res) {
    res.setHeader('Content-Type', 'application/json')
    let sendCallback = payload => res.send(JSON.stringify(payload))
    getNews(sendCallback)
    console.log('📤 Articles sent successfully')
})

app.listen(PORT)
console.log('🚀 Server started on port', PORT)
exports = module.exports = app