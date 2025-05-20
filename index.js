const express = require('express');
const session = require('express-session');
const cors = require('cors');
const path = require('path');
const app = express();
const fetch = require('node-fetch');
const Feed = require('feed').Feed;
const mysql = require('mysql2');
const uuid = require('uuid');
const cookieParser = require('cookie-parser');
const fs = require('fs').promises;
const rateLimit = require('express-rate-limit');
require('dotenv').config();
const db = mysql.createPool({
    host: 'da.dangoweb.com',
    user: 'dangoweb_southernbell',
    password: process.env.DB_PASSWORD,
    database: 'dangoweb_southernbell'
});
const port = 3000;

app.engine('.ejs', require('ejs').renderFile);
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'frontend/pages'));
app.use(express.static(__dirname + '/frontend/public'));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(cors());
app.use(session({
    name: 'sessionid',
    secret: 'DWSis#1',
    resave: true,
    saveUninitialized: false,
    cookie: { maxAge: 86400000 }
}));
app.set('trust proxy', true);
app.use(cookieParser());
app.use(rateLimit({
    windowMs: 60 * 1000,
    max: 15,
    skip: (req, res) => {
        return req.ip !== undefined;
    },
    message: "Too many requests from this IP, please try again in a minute."
}));
app.use((req, res, next) => {
    if (req.method === 'GET') {
        const pageviewData = {
            v: 1,
            t: 'pageview',
            tid: process.env.GA_TRACKING_ID,
            cid: req.ip,
            uip: req.ip,
            dp: req.originalUrl,
            ua: req.headers['user-agent'],
        };
        fetch('https://www.google-analytics.com/collect', {
            method: 'POST',
            body: new URLSearchParams(pageviewData),
        })
            .then(() => {
                db.query('INSERT INTO pageviews (url, count) VALUES (?, 1) ON DUPLICATE KEY UPDATE count = IF(TIMESTAMPDIFF(HOUR, timestamp, NOW()) <= 1, count, count + 1), timestamp = IF(TIMESTAMPDIFF(HOUR, timestamp, NOW()) <= 1, timestamp, NOW());', [req.originalUrl], (err, results) => {
                    if (err) {
                        console.error('error tracking pageview:', err);
                    };
                });
            })
            .catch((err) => {
                console.error('error tracking pageview:', err);
            });
    }
    next();
});
app.use((req, res, next) => {
    db.query('SELECT count FROM pageviews WHERE url = ?', [req.originalUrl], (err, results) => {
        skipPageViewsErrors = true;
        if (err && !skipPageViewsErrors) {
            console.error(err);
            res.status(500).render('error', { error: 'error retrieving page views; database connection failed' });
            return;
        };
        if (results) {
            if (results.length === 1) {
                req.pageViews = results[0].count;
            } else {
                req.pageViews = 0;
            };
        } else {
            req.pageViews = 0;
        };
        next();
    });
});
app.use(async (req, res, next) => {
    if (!(await cmsdata()).ok) {
        res.status(500).render('error', { error: 'error connecting to CMS; CMS connection failed' });
        return;
    };
    next();
});

function cmsdata() {
    return fetch('https://cms.dangoweb.com/:southern-bell/api/gql', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'Authorization': process.env.CMS_API_KEY,
        },
        body: JSON.stringify({
            query: `{
                siteDetails: content(model: "siteDetails")
                menu: content(model: "menu")
                articles: content(model: "articles")
                layouts: content(model: "layouts")
                newspapers: content(model: "newspapers")
                about: content(model: "about")
                polls: content(model: "polls")
                artworks: content(model: "artworks")
                authors: content(model: "authors")
            }`
        }),
    })
};

async function startApp() {
    try {
        var cms = JSON.parse(JSON.stringify((await cmsdata().then(res => res.json())).data).replaceAll('.spaces', 'clients'));
    } catch { };

    // Defaults & Environment Variables

    var weather = {};
    try {
        weather = await fs.readFile('weather.json', 'utf8');
    } catch { };
    if (weather.toString() === '{}') getWeather();

    var districtNews = {};
    try {
        districtNews = await fs.readFile('district.json', 'utf8');
    } catch { };
    if (districtNews.toString() === '{}') getDistrictNews();

    var defaults = {
        environment: process.env.NODE_ENV || 'testing',
        domain: process.env.NODE_ENV === 'production' ? cms.siteDetails[0]['domain-production'] : process.env.NODE_ENV === 'development' ? cms.siteDetails[0]['domain-development'] : '../../../../..',
        asset_prefix: process.env.CMS_ASSET_PREFIX,
        asset_url: process.env.CMS_ASSET_URL,
        weather,
        districtNews,
        slugify: function (str) { return String(str).normalize('NFKD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase().replace(/[^a-z0-9 -]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-') },
    };

    // Functions

    async function allRoutes(req, res) {
        cms = (await cmsdata().then(res => res.json())).data;
        if (!req.session.cookiesDenied) {
            req.session.cookiesDenied = false;
        } else if (req.session.cookiesDenied === true) {
            res.clearCookie("sessionid");
            req.session.destroy();
            res.send("You have denied cookies. If you would like to re-enable cookies, click <a href='/enablecookies'>here</a> or force reload the page.");
            return false;
        } else {
            return;
        };
    };

    Date.prototype.isToday = function () {
        const today = new Date()
        return this.getDate() === today.getDate() &&
            this.getMonth() === today.getMonth() &&
            this.getFullYear() === today.getFullYear()
    };

    async function getWeather() {
        await fetch(`https://api.openweathermap.org/data/2.5/weather?lat=40.654039379957354&lon=-73.71347345977551&appid=${process.env.OPENWEATHERMAP_API_KEY}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
            }
        })
            .then(w => w.json())
            .then(async w => {
                await fs.writeFile('weather.json', JSON.stringify(w), (err) => {
                    if (err) return console.error(err);
                });
                await new Promise(resolve => setTimeout(resolve, 2000));
                defaults.weather = JSON.stringify(w);
            });
    };

    async function getDistrictNews() {
        await fetch(`https://vschsd.org/wp-json/wp/v2/posts?search=south`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
            }
        })
            .then(w => w.json())
            .then(async w => {
                await fs.writeFile('district.json', JSON.stringify(w), (err) => {
                    if (err) return console.error(err);
                });
                await new Promise(resolve => setTimeout(resolve, 2000));
                defaults.districtNews = JSON.stringify(w);
            });
    };

    async function getFeed() {
        const feed = new Feed({
            title: cms.siteDetails[0].title,
            description: `News feed for ${cms.siteDetails[0].title}`,
            id: cms.siteDetails[0]['domain-production'],
            link: cms.siteDetails[0]['domain-production'],
            language: "en",
            image: `${defaults.asset_prefix}${cms.siteDetails[0].logo.path}`,
            favicon: `${defaults.asset_prefix}${cms.siteDetails[0].favicon.path}`,
            copyright: `All rights reserved ${new Date().getFullYear()}, ${cms.siteDetails[0].title}`,
            generator: "Dango Web Solutions",
            feedLinks: {
                rss: `${cms.siteDetails[0]['domain-production']}/rss`,
                json: `${cms.siteDetails[0]['domain-production']}/json`,
                atom: `${cms.siteDetails[0]['domain-production']}/atom`
            },
            author: {
                name: cms.siteDetails[0].title,
                email: `admin@${cms.siteDetails[0]['domain-production'].split('://')[1]}`,
                link: cms.siteDetails[0]['domain-production']
            }
        });
        cms.newspapers.forEach(post => {
            var newspaperContributors = [{
                name: "Faisal N",
                email: "contact@faisaln.com",
                link: "https://faisaln.com/"
            }];
            post.articles.forEach(article => {
                article = cms.articles.find(article1 => article1._id === article._id);
                if (!article) return;
                if ((article.author != "") && (article.author != null) && !newspaperContributors.find(contributor => contributor.name === article.author.trim())) newspaperContributors.push({
                    name: article.author.trim(),
                    email: `admin@${cms.siteDetails[0]['domain-production'].split('://')[1]}`,
                    link: `${cms.siteDetails[0]['domain-production']}/authors/${article.author.trim().replaceAll(" ", "-").toLowerCase()}`
                });
            });
            feed.addItem({
                title: post.title,
                id: `${cms.siteDetails[0]['domain-production']}/newspapers/${defaults.slugify(post.slug)}`,
                link: `${cms.siteDetails[0]['domain-production']}/newspapers/${defaults.slugify(post.slug)}`,
                description: `${post.articles.length} Article${(post.articles.length === 1) ? '' : 's'}`,
                content: post.content,
                author: [
                    {
                        name: cms.siteDetails[0].title,
                        email: `admin@${cms.siteDetails[0]['domain-production'].split('://')[1]}`,
                        link: cms.siteDetails[0]['domain-production']
                    }
                ],
                contributor: newspaperContributors,
                date: new Date(post.date),
                image: `${defaults.asset_prefix}${post.image.path}`
            });
        });
        cms.articles.filter(article => !article.unlisted).forEach(post => {
            feed.addItem({
                title: post.title,
                id: `${cms.siteDetails[0]['domain-production']}/articles/${new Date(post.date).getFullYear()}/${defaults.slugify(post.slug)}`,
                link: `${cms.siteDetails[0]['domain-production']}/articles/${new Date(post.date).getFullYear()}/${defaults.slugify(post.slug)}`,
                description: post.description,
                content: post.content,
                author: [((post.author != "") && (post.author != null)) ? {
                    name: post.author.trim(),
                    email: `admin@${cms.siteDetails[0]['domain-production'].split('://')[1]}`,
                    link: `${cms.siteDetails[0]['domain-production']}/authors/${post.author.trim().replaceAll(" ", "-").toLowerCase()}`
                } : {
                    name: cms.siteDetails[0].title,
                    email: `admin@${cms.siteDetails[0]['domain-production'].split('://')[1]}`,
                    link: cms.siteDetails[0]['domain-production']
                }],
                contributor: [
                    {
                        name: "Faisal N",
                        email: "contact@faisaln.com",
                        link: "https://faisaln.com/"
                    }
                ],
                date: new Date(post.date),
                image: (post.images[0]) ? `${defaults.asset_prefix}${post.images[0].path}` : ""
            });
        });
        return feed;
    };

    // Routes

    app.get('/', async (req, res) => {
        await allRoutes(req, res);
        res.render('index', { vars: defaults, title: '', cms, pageviews: req.pageViews });
    });

    app.get('/about', async (req, res) => {
        await allRoutes(req, res);
        res.render('about', { vars: defaults, title: cms.about[0].title, cms, pageviews: req.pageViews });
    });

    app.get('/newspapers', async (req, res) => {
        await allRoutes(req, res);
        res.render('newspapers', { vars: defaults, title: 'Newspapers', cms, pageviews: req.pageViews });
    });

    app.get('/newspapers/:newspaper', async (req, res) => {
        await allRoutes(req, res);
        var newspaper = cms.newspapers.find(newspaper => defaults.slugify(newspaper.slug) === req.params.newspaper);
        if (newspaper) {
            res.render('newspaper', { vars: defaults, title: newspaper.title, cms, pageviews: req.pageViews, newspaper });
        } else {
            res.render('404', { vars: defaults, title: '404', cms, pageviews: req.pageViews });
        };
    });

    app.get('/articles/:year/:article', async (req, res) => {
        await allRoutes(req, res);
        var article = cms.articles.find(article => { return defaults.slugify(article.slug) === req.params.article && (new Date(article.date)).getFullYear() === Number(req.params.year) });
        if (article) {
            res.render('article', { vars: defaults, title: article.title, cms, pageviews: req.pageViews, article });
        } else {
            res.render('404', { vars: defaults, title: '404', cms, pageviews: req.pageViews });
        };
    });

    app.get('/articles', async (req, res) => {
        await allRoutes(req, res);
        res.render('articles', { vars: defaults, title: 'Articles', cms, pageviews: req.pageViews });
    });

    app.get('/tags', async (req, res) => {
        await allRoutes(req, res);
        res.render('tags', { vars: defaults, title: 'Tags', cms, pageviews: req.pageViews });
    });

    app.get('/tags/:tag', async (req, res) => {
        await allRoutes(req, res);
        res.render('tag', { vars: defaults, title: `#${req.params.tag.trim().toLowerCase().replaceAll(" ", "-").replaceAll("#", "")}`, cms, pageviews: req.pageViews, tag: req.params.tag.trim().toLowerCase().replaceAll(" ", "-").replaceAll("#", "") });
    });

    app.get('/polls', async (req, res) => {
        await allRoutes(req, res);
        db.query(`SELECT * FROM poll_responses`,
            function (err, responses, fields) {
                res.render('polls', { vars: defaults, title: 'Polls', cms, pageviews: req.pageViews, responses });
            });
    });

    app.get('/polls/:poll', async (req, res) => {
        await allRoutes(req, res);
        let voteId = req.cookies.voteId;
        if (!voteId) {
            voteId = uuid.v4();
            res.cookie('voteId', voteId);
        };
        var poll = cms.polls.find(poll => defaults.slugify(poll.slug) === req.params.poll);
        if (poll) {
            db.query(`SELECT * FROM poll_responses WHERE poll_id = '${poll._id}'`,
                function (err, responses, fields) {
                    res.render('poll', { vars: defaults, title: poll.question, cms, pageviews: req.pageViews, poll, responses, error: req.query.error });
                }
            );
        } else {
            res.render('404', { vars: defaults, title: '404', cms, pageviews: req.pageViews });
        };
    });

    app.post('/polls/:poll', async (req, res) => {
        await allRoutes(req, res);
        var poll = cms.polls.find(poll => defaults.slugify(poll.slug) === req.params.poll);
        if (poll && req.body.id && (req.body.name.length > 0) && (req.body.answer)) {
            db.query(`SELECT * FROM poll_responses WHERE session_id = ? AND poll_id = ?`, [req.cookies.voteId, poll._id],
                function (err, responses, fields) {
                    if (err) {
                        console.log(err);
                    };
                    if (responses.length === 0) {
                        for (let i = 0; i < poll.answers.length; i++) {
                            if (poll.answers[i] === req.body.answer) {
                                try {
                                    query = db.format("INSERT INTO poll_responses (name, ip, session_id, poll_id, response_id) VALUES (?, ?, ?, ?, ?)", [req.body.name, req.ip, req.cookies.voteId, req.body.id, i]);
                                    db.query(query, function (err, results, fields) {
                                        if (err) {
                                            console.log(err);
                                            res.redirect(`/polls/${req.params.poll}?error=There was an error submitting your vote!`);
                                        } else {
                                            res.redirect(`/polls/${req.params.poll}`);
                                        };
                                    });
                                } catch (error) {
                                    console.log(`DoS Attack Attempted: IP is ${req.ip}, URL is ${req.originalUrl}, Query is ${JSON.stringify(req.query)}, Body is ${JSON.stringify(req.body)}`, error);
                                    res.redirect(`/polls/${req.params.poll}`);
                                };
                            };
                        };
                    } else {
                        res.redirect(`/polls/${req.params.poll}?error=You have already voted!`);
                    };
                }
            );
        } else {
            res.redirect('/');
        };
    });

    app.get('/artworks', async (req, res) => {
        await allRoutes(req, res);
        res.render('artworks', { vars: defaults, title: 'Artworks', cms, pageviews: req.pageViews });
    });

    app.get('/artworks/:artwork', async (req, res) => {
        await allRoutes(req, res);
        var artwork = cms.artworks.find(artwork => defaults.slugify(artwork.slug) === req.params.artwork);
        if (artwork) {
            res.render('artwork', { vars: defaults, title: artwork.title, cms, pageviews: req.pageViews, artwork });
        } else {
            res.render('404', { vars: defaults, title: '404', cms, pageviews: req.pageViews });
        };
    });

    app.get('/authors/:author', async (req, res) => {
        await allRoutes(req, res);
        var author = cms.authors.find(author => (author.name.trim().toLowerCase() === req.params.author.trim().replaceAll('-', ' ').toLowerCase()) && (!author.unlisted));
        var articles = cms.articles.filter(article => article.author && ((article.author.trim().toLowerCase() === req.params.author.trim().replaceAll('-', ' ').toLowerCase()) || article.author.trim().toLowerCase().split(/ and |, | & /).includes(req.params.author.trim().replaceAll('-', ' ').toLowerCase())) && !article.unlisted);
        var artworks = cms.artworks.filter(artwork => artwork.author && ((artwork.author.trim().toLowerCase() === req.params.author.trim().replaceAll('-', ' ').toLowerCase()) || article.author.trim().toLowerCase().split(/ and |, | & /).includes(req.params.author.trim().replaceAll('-', ' ').toLowerCase()) )&& !artwork.unlisted);
        if ((articles.length > 0) || (artworks.length > 0)) return res.render('author', { vars: defaults, title: (articles[0] || artworks[0]).author.trim(), cms, pageviews: req.pageViews, author, articles, artworks });
        return res.render('404', { vars: defaults, title: '404', cms, pageviews: req.pageViews });
    });

    app.get('/search', async (req, res) => {
        await allRoutes(req, res);
        if (req.query.query) {
            db.query(`SELECT * FROM poll_responses`,
                function (err, responses, fields) {
                    res.render('search', { vars: defaults, title: 'Search Results', cms, pageviews: req.pageViews, query: req.query.query.toLowerCase(), responses });
                });
        } else {
            res.redirect('/');
        };
    });

    app.get('/admin', async (req, res) => {
        res.redirect('https://cms.dangoweb.com/:southern-bell');
    });

    app.get('/rss', async (req, res) => {
        res.set('Content-Type', 'text/xml');
        res.send((await getFeed()).rss2());
    });

    app.get('/feed.xml', async (req, res) => {
        res.set('Content-Type', 'text/xml');
        res.send((await getFeed()).rss2());
    });

    app.get('/rss-feed.xml', async (req, res) => {
        res.set('Content-Type', 'text/xml');
        res.send((await getFeed()).rss2());
    });

    app.get('/json', async (req, res) => {
        res.set('Content-Type', 'application/json');
        res.send((await getFeed()).json1());
    });

    app.get('/feed.json', async (req, res) => {
        res.set('Content-Type', 'application/json');
        res.send((await getFeed()).json1());
    });

    app.get('/json-feed.json', async (req, res) => {
        res.set('Content-Type', 'application/json');
        res.send((await getFeed()).json1());
    });

    app.get('/atom', async (req, res) => {
        res.set('Content-Type', 'application/atom+xml');
        res.send((await getFeed()).atom1());
    });

    app.get('/atom-feed.xml', async (req, res) => {
        res.set('Content-Type', 'application/atom+xml');
        res.send((await getFeed()).atom1());
    });

    app.get('/denycookies', async (req, res) => {
        req.session.cookiesDenied = true;
        res.redirect(cms.siteDetails[0].denycookiesredirect);
    });

    app.get('/enablecookies', async (req, res) => {
        req.session.cookiesDenied = false;
        res.redirect('/');
    });

    app.get('/robots.txt', function (req, res) {
        res.type('text/plain');
        res.send((defaults.environment === 'production') ? "User-agent: *\nAllow: /" : "User-agent: *\nDisallow: /");
    });

    app.get('/cron', async function (req, res) {
        if (!req.query.weather || (req.query.weather != process.env.OPENWEATHERMAP_API_KEY)) return res.send('INVALID');
        await getWeather();
        await getDistrictNews();
        return res.send('OK');
    });

    app.use(async (req, res, next) => {
        await allRoutes(req, res);
        return res.render('404', { vars: defaults, title: '404', cms, pageviews: req.pageViews });
    });

    app.use(async (err, req, res, next) => {
        console.log(err);
        return res.render('error', { error: 'internal server error; check logs' });
    });

    app.listen(port, () => {
        try {
            console.log(`${cms.siteDetails[0].title} listening on port ${port}`);
        } catch {
            console.log(`Southern Bell listening on port ${port}`);
        };
    });
};

startApp();