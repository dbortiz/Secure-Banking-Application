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
    duration: 3 * 60 * 1000,
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
        console.log('Invalid session: redirecting user to login page.')
        return false;
    }
}

/*
Login Home Page
*/
app.get('/', (req, res) => {
    if(authenticateUser(req.session)){
        console.log('Valid session: redirecting user to home page.');
        res.render('home', {firstName: req.session.activeUser.firstName, lastName: req.session.activeUser.lastName});
    }else{
        let errMessage = '';

        console.log('Login page sent to user.')

        res.render('login', {errorMessage: errMessage});
    }
});


/*
Login POST Method
*/
app.post('/login', (req, res) => {
    // NOTE: Add filters on req.body variables
    let username = req.body.username;
    let password = req.body.password;

    let q = 'USE Bank; SELECT fName, lName FROM BankUsers WHERE `username`=? AND `password`=?';
    let qValues = [username, password];

    mysqlConn.query(q, qValues, (err, qResult) => {
        if(err) throw err;
        if(qResult[1].length === 1){
            let fName = qResult[1][0]['fName'];
            let lName = qResult[1][0]['lName'];
            
            console.log('Successful login by user:', fName, lName);

            req.session.activeUser = {firstName: fName, lastName:lName, username: username, password: password};
            
            res.render('home', {firstName: fName, lastName: lName});
        }else{
            let errMessage = 'Your credentials are invalid!';
            
            console.log('Failed login attempt:', username, password);

            res.render('login', {errorMessage: errMessage});
        }
    });
});

/*
Sign Up Page
*/
app.get('/signup', (req, res) => {
    console.log('Sign up page sent to user.');
    let errMessage = '';
    res.render('signup', {errorMessage: errMessage});
});

/*
Sign Up POST Method
*/
app.post('/signup', (req, res) => {
    // NOTE: Add filter
    let username = req.body.username;

    let q = 'USE Bank; Select 1 FROM BankUsers WHERE `username`=?;'
    mysqlConn.query(q, [username], (err, qResult) => {
        if(err) throw err;

        console.log(qResult[1].length);
        if(qResult[1].length === 1){
            let errMessage = 'Username is already in use. Please select another!';

            res.render('signup', {errorMessage: errMessage});
        }else{
            let capFirstLetter = (str) => str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
            // NOTE: Add filters
            let password = req.body.password;
            let firstName = capFirstLetter(req.body.firstName);
            let lastName = capFirstLetter(req.body.lastName);
            let address = req.body.address.toUpperCase();
            let city = req.body.city.toUpperCase();
            let state = req.body.state.toUpperCase();
            let zip = req.body.zip;

            let q2 = 'USE Bank; INSERT INTO BankUsers VALUES(?,?,?,?,?,?,?,?)';
            let qValues = [username, password, firstName, lastName, address, city, state, zip];

            mysqlConn.query(q2, qValues, (err, qResult) => {
                console.log('User created!');

                res.render('usercreated', {username: username, firstName: firstName, lastName: lastName, address: address, city: city, state: state, zip: zip});
            });
        }
    });

});

/*
Logout user and kill valid session.
*/
app.get('/logout', (req, res) => {
    let errMessage = '';

    if(authenticateUser(req.session)){
        let username = req.session.activeUser.username;
        
        req.session.reset();

        console.log(username, 'has logged out.');

        res.render('login', {errorMessage: errMessage});
    }else{
        console.log('Failed attempt to reach /logout route, redirecting user to login page.');

        res.render('login', {errorMessage: errMessage});
    }
});

app.listen(3000, () => {
    console.log('Listening on port 3000!');
});