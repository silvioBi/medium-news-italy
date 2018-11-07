const express = require('express')
const request = require('request')
const cheerio = require('cheerio')
const uuidv1 = require('uuid/v1')
const { Pool } = require('pg')

// Enviroment variables
const PORT = process.env.PORT || 80
const DEBUG = process.env.DEBUG || false

// Express
let app = express()

// DB Postgres
// The db contains only one table, which can be created with the following query:
// create table articles (uid text, updateDate text, titleText text, mainText text, redirectionUrl text )
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: true
})

// Queries
// Insert new articles query
const insertNewArticleQuery = article => ({
    text: 'INSERT INTO articles(uid, updateDate, titleText, mainText, redirectionUrl) VALUES($1, $2, $3, $4, $5)',
    values: [article.uid, article.updateDate, article.titleText, article.mainText, article.redirectionUrl],
})
// Delete old articles query
const deleteAllArticlesQuery = 'DELETE FROM articles'
// Get all articles query
const getAllArticlesQuery = 'SELECT * FROM articles'

/**
 * @description Launches the correspondent query, the query may be one of insertNewArticleQuery | deleteAllArticlesQuery | getAllArticlesQuery
 * @param {object} queryObject The query to be launched
 * @param {object} [insertingArticle] Whether we are inserting an article
 * @param {function} callback A callback which handles the list of articles in the format supported Alexa 
 */
const queryArticlesDb = async (queryObject, insertingArticle, callback) => {
    try {
        const client = await pool.connect()
        // If insertingArticle it means we are adding an article, in the other cases we are just 
        // getting or deleting everything
        const result = await client.query(queryObject)
        // Parse the articles in a more convenient format only if we were not adding an article
        let articles = insertingArticle ? null : !result ? [] : result.rows
        client.release()
        if (callback) callback(articles)
    } catch (err) {
        console.error('🚨 Error! ', err)
    }
}

/** 
 * @description Crawl Medium Italia to get the last articles
 * @param {function} callback A callback which handles the return value
 * @returns {list} A list of articles in the format supported Alexa 
 * */
let getArticles = callback => {
    let articles = [] // This should be stored in a db and retrieved once in a while in production
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
                if (!article.mainText) article.mainText = 'Utilizza il link per leggere l\'articolo completo'

                // Similar approach is taken for the article link, it is almost always the first child, sometimes
                // it is in the containing div
                article.redirectionUrl = data.children().first().attr('href')
                if (!article.redirectionUrl) article.redirectionUrl = data.parent().attr('href')

                // Finally let's add the article to our news array
                articles.push(article)
            })
            console.error('📥 Updated articles! %s new articles', articles.length)
            callback(articles)
        }
    })
}
/** 
 * @description Crawl Medium to get the new articles and update the db removing the old ones and adding 
 * the new ones
 * */
const updateArticles = () => {
    queryArticlesDb(deleteAllArticlesQuery) // First delete all old articles
    let insertNewArticlesCallback = articles =>
        articles.map(article =>
            // For each article we get the correspondent query to insert it and 
            // we say to queryArticlesDb that we are insering an article
            queryArticlesDb(insertNewArticleQuery(article), true))
    getArticles(insertNewArticlesCallback)
}

// Periodically update the articles forever
let refreshRate = 1000 * 60 * 60 // One hour
updateArticles() // Launch manually the first time
setInterval(updateArticles, refreshRate)

// The endpoint
app.get('/', function (req, res) {
    // Header necessary to let Alexa know the format we are providing the feeds
    res.setHeader('Content-Type', 'application/json')
    let getArticlesCallback = articles => {
        res.send(JSON.stringify(articles))
        console.log('📤 Articles sent successfully')
    }
    // Get all the articles and pass the above callback to send them as response
    // once the query is terminated
    queryArticlesDb(getAllArticlesQuery, null, getArticlesCallback)
})

app.listen(PORT)
console.log('🚀 Server started on port', PORT)
exports = module.exports = app