var express = require("express");
var bodyParser = require("body-parser");
var logger = require("morgan");
var mongoose = require("mongoose");

// Our scraping tools
// Axios is a promised-based http library, similar to jQuery's Ajax method
// It works on the client and on the server
var axios = require("axios");
var cheerio = require("cheerio");

// Require all models
var db = require("./models");

var PORT = 3000;

// Initialize Express
var app = express();

// Configure middleware

// Use morgan logger for logging requests
app.use(logger("dev"));
// Use body-parser for handling form submissions
app.use(bodyParser.urlencoded({ extended: true }));
// Use express.static to serve the public folder as a static directory
app.use(express.static("public"));

// If deployed, use the deployed database. Otherwise use the local mongoHeadlines database
var MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost/mongoHeadlines";

// Set mongoose to leverage built in JavaScript ES6 Promises
// Connect to the Mongo DB
mongoose.Promise = Promise;
mongoose.connect(MONGODB_URI);

// Routes
const home = "https://www.reddit.com";
// _2tbHP6ZydRpjI44J3syuqC = a tag class w/ user text
// s5kz2p-0 = h2 tag class w/ title
// _1rZYMD_4xY3gRcSS3p8ODO = span tag w/ likes
// SQnoC3ObvgnGjWt90zD9Z = a tag w/ url in href
// _1poyrkZ7g36PawDueRza-J = div body

// A GET route for scraping the echoJS website
app.get("/scrape", function (req, res) {
    // First, we grab the body of the html with request
    axios.get("https://www.reddit.com/r/webdev/").then(function (response) {
        // Then, we load that into cheerio and save it to $ for a shorthand selector
        const $ = cheerio.load(response.data);

        var results = [];
        // Now, we grab every div of the appropriate class,
        $("div._1poyrkZ7g36PawDueRza-J").each(function (i, el) {
            // Save an empty result object
            const result = {
                headline: null,
                likes: null,
                user: null,
                url: home
            };

            // Add the headline, summary and href of every link, and save them as properties of the result object
            results.push(result);
        });

        $("a._2tbHP6ZydRpjI44J3syuqC").each((i, el) => {
            if (i >= results.length) { return; }
            let arr = el.attribs.href.split("/");
            results[i].user = arr[arr.length - 1];
        })

        $("h2.s5kz2p-0").each(function (i, el) {
            if (i >= results.length) { return; }
            results[i].headline = $(el).text();
        });

        $("div._1rZYMD_4xY3gRcSS3p8ODO").each(function (i, el) {
            let index = i / 2;
            if (index % 1 !== 0) {
                index -= .5;
            }

            if (index >= results.length) { return; }
            
            results[index].likes = $(el).text();
        });

        $("a.SQnoC3ObvgnGjWt90zD9Z").each(function (i, el) {
            if (i >= results.length) { return; }
            results[i].url += $(el).attr('href');
        });

        console.log(results.length);
        results.forEach((result) => {
            if (result.headline && result.url !== home && result.user && result.likes) {
                db.Article.create(result).then((data) => {
                    // console.log(data);
                }).catch((err) => {
                    return console.log(err);
                })
            }
        });
        // console.log(filtered.length);

        // If we were able to successfully scrape and save an Article, send a message to the client
        res.send("Scrape Complete");
    });
});

// Post a comment to an article
app.post("/articles/:id", (req, res) => {
    // const {title, body} = req.params.body;

    db.Article.findByIdAndUpdate({_id: req.params.id}, { $push: { comments: req.params.body }})
    .then((data) => {res.json(data)});
});

// Get one article object by ID
app.get("/articles/:id", (req, res) => {
    db.Article.findById({_id: req.params.id}).populate("comments").then((data) => {
        res.json(data);
    });
});

// Route for getting all Articles from the db
app.get("/articles", function (req, res) {
    // Grab every document in the Articles collection
    db.Article.find()
        .then(function (dbArticle) {
            // If we were able to successfully find Articles, send them back to the client
            // console.log(dbArticle);
            res.json(dbArticle);
        })
        .catch(function (err) {
            // If an error occurred, send it to the client
            res.json(err);
        });
});

// Structured as a 'get' request in order to trigger via browser
// instead of needing Postman
app.get("/delete", (req, res) => {
    db.Article.deleteMany().then((data) => {
        console.log(data);
        res.json(data);
    }).catch((err) => {
        console.log(err);
        res.json(err);
    });
});

app.get("/", (req, res) => {
    res.render("index");
});

// Start the server
app.listen(PORT, function () {
    console.log("App running on port " + PORT + "!");
});