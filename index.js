const express = require('express')
const request = require('request')
const cheerio = require('cheerio')
const uuidv1 = require('uuid/v1');
const PORT = process.env.PORT || 80

let app = express()

let getNews = callback => {
    let news = [] // This should be stored in a db and retrieved once in a while in production
    let url = 'https://medium.com/italia'
    request(url, (err, res, html) => {
        if (!err) {
            let $ = cheerio.load(html)
            $('h3').each((i, el) => {
                let article = {
                    uid: '', // The unique id of the feed
                    updateDate: '', // In the format yyyy-MM-dd'T'HH:mm:ss'.0Z' 2016-04-10T00:00:00.0Z
                    titleText: '', // The title of the article
                    mainText: '',  // The text that Alexa reads to the user
                    redirectionUrl: '', // Provides the URL target for the Read More link in the Alexa app.
                }
                let data = $(el)
                // Let's generate the UUID
                // TODO: This should be changed by checking for already existing articles in the db but since
                //       we are deploying the app on heroku there is no persistency yet (some articles might be duplicated)
                article.uid = uuidv1()

                // Generate the timestamp for the updateDate
                // TODO: Same as before, data should be retrieved once in a while and stored in 
                //       the db not retrieved on demand
                article.updateDate = new Date().toISOString()

                // In examining the DOM we notice that the title rests within the first child element of the h3 tag. 
                // Utilizing jQuery we can easily navigate and get the text by writing the following code:
                article.titleText = data.children().first().text()

                // We just get the description for this, more in depth details can be found navigating to the linl
                article.mainText = data.next().children().first().text()

                // Similar approach is taken for the article link, it is almost always the first child, sometimes
                // it is in the containing div
                article.redirectionUrl = data.children().first().attr('href')
                if (!article.redirectionUrl) article.redirectionUrl = data.parent().attr('href')
                
                // Finally let's add the article to our news array
                news.push(article)
            })
            callback(news)
        }
    })
}

app.get('/', function (req, res) {
    // Header necessary to let Alexa know the format we are providing the feeds
    res.setHeader('Content-Type', 'application/json')
    let sendCallback = payload => res.send(JSON.stringify(payload))
    getNews(sendCallback)
    console.log('📤 Articles sent successfully')
})

app.listen(PORT)
console.log('🚀 Server started on port', PORT)
exports = module.exports = app