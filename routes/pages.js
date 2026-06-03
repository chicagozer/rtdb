// © 2014-2026 by Rheosoft. All rights reserved.
// Licensed under the RTDB Software License version 1.0
"use strict";
const fs = require('fs');
const path = require('path');
const { marked } = require('marked');

function register(app, ctx) {
    var database = ctx.database,
        readmePath = path.join(ctx.dirname, 'README.md');

    /*jslint unparam:true */
    app.get('/about', function (req, res) {
        var readmeHtml = marked.parse(fs.readFileSync(readmePath, 'utf8'));
        res.render('about', {
            readmeHtml: readmeHtml
        });
    });

    app.get('/help/:id', function (req, res) {
        res.render('help/' + req.params.id);
    });

    app.get('/index', function (req, res) {
        res.render('index', {
            json: database._identity
        });
    });

    app.get('/demo/:dpage', function (req, res) {
        res.render(req.params.dpage, {
            json: database._identity
        });
    });

    app.get("/", function (req, res) {
        res.render('home', {
            json: database._identity
        });
    });

    app.get("/web", function (req, res) {
        res.render('main', {
            json: database._identity
        });
    });
    /*jslint unparam:false */
}

module.exports = {
    register
};
