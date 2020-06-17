'use strict'

const express = require('express');

const sessions = require('client-sessions');

const bodyParser = require('body-parser');

const xssFilters = require('xss-filters');

const csp = require('helmet-csp');

const mysql = require('mysql');

// Instantiate an express app.
const app = express();

/*
Content Security Policy set to only receive files, scripts
any (potential) images to only come from the server.
*/
app.use(csp({
    directives: {
        defaultSrc: ["'self", 'localhost:3000'],
        scriptSrc: ["'self", 'localhost:3000'],
        imgSrc: ['data:']
    }
}));


// Needed to parse the request body.
app.use(bodyParser.urlencoded({ extended: true }));

// Needed for session management
app.use(sessions({
    cookieName: 'session',
    secret: 'random_string_goes_here',
    duration: 3* 60 * 1000,
    activeDuration: 5 * 60 * 1000
}));

// Needed to enable view engine
app.set('view engine', 'ejs');

// Connect to the database.
const mysqlConn = mysql.createConnection({
    host: 'localhost',
    user: 'bankuser',
    password: 'bankpass',
    multipleStatements: true
});

function authenticateUser(clientSession){
    if(Object.keys(clientSession).length !== 0){
        return true;
    }else{
        return false;
    }
}

/*
This will check if
*/
app.get('/', (req, res) => {
    console.log('Login page sent to user.')
    res.render('login');
});

app.listen(3000, () => {
    console.log('Listening on port 3000!');
});