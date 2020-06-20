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
        let errMessage = '';

        console.log('Valid session: redirecting user to home page.');
        
        res.render('home', {errorMessage: errMessage, firstName: req.session.activeUser.firstName, lastName: req.session.activeUser.lastName});
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
            let errMessage = '';

            console.log('Successful login by user:', fName, lName);

            req.session.activeUser = {firstName: fName, lastName:lName, username: username, password: password};
            
            res.render('home', {errorMessage: errMessage, firstName: fName, lastName: lName});
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
To Deposit: Checks for any accounts and sends accounts
to deposit page.
*/
app.get('/toDeposit', (req, res) => {
    let username = req.session.activeUser.username;

    let q = 'USE Bank; SELECT acc_name FROM UserAccounts WHERE `acc_username`=?';
    
    mysqlConn.query(q, [username], (err, qResult) => {
        if(err) throw err;
        
        if(qResult[1].length > 0){
            let accounts = [];
            qResult[1].forEach((account) => {
                accounts.push({'account': account['acc_name']});
            });

            res.render('deposit', {accounts: accounts});
            
        }else{
            let errMessage = 'You have no accounts to make a deposit! Please create an account!';

            console.log('User attempted to deposit with no available accounts.');

            res.render('home', {firstName: req.session.activeUser.firstName, lastName: req.session.activeUser.lastName, errorMessage: errMessage});
        }
    });
});

/*
Deposit POST Method
*/
app.post('/deposit', (req, res) => {
    let username = req.session.activeUser.username;
    let accountName = req.body.account;
    let amount = Number(req.body.amount);

    let q = 'USE Bank; SELECT acc_amount FROM UserAccounts WHERE `acc_username`=? AND `acc_name`=?';
    let qValues = [username, accountName];

    mysqlConn.query(q, qValues, (err, qResult) => {
        if(err) throw err;

        let currentAmount = Number(qResult[1][0]['acc_amount']);
        let newAmount = (currentAmount + amount).toFixed(2);

        let q2 = 'USE Bank; UPDATE UserAccounts SET `acc_amount`=? WHERE `acc_username`=? AND `acc_name`=?';
        let qValues2 = [newAmount, username, accountName];

        mysqlConn.query(q2, qValues2, (err2) => {
            if(err2) throw err2;

            res.render('accountupdated', {transactionType: 'Deposit', accountName: accountName, accountAmount: newAmount});
        });
    });
});

/*
To Withdraw: Checks for any accounts and sends accounts
to deposit page.
*/
app.get('/toWithdraw', (req, res) => {
    let username = req.session.activeUser.username;

    let q = 'USE Bank; SELECT acc_name FROM UserAccounts WHERE `acc_username`=?';
    
    mysqlConn.query(q, [username], (err, qResult) => {
        if(err) throw err;
        
        if(qResult[1].length > 0){
            let accounts = [];
            let errMessage = '';
            qResult[1].forEach((account) => {
                accounts.push({'account': account['acc_name']});
            });

            res.render('withdraw', {errorMessage: errMessage, accounts: accounts});
            
        }else{
            let errMessage = 'You have no accounts to make a withdrawal! Please create an account!';

            console.log('User attempted to withdraw with no available accounts.');

            res.render('home', {firstName: req.session.activeUser.firstName, lastName: req.session.activeUser.lastName, errorMessage: errMessage});
        }
    });
});

/*
Withdraw POST Method
*/
app.post('/withdraw', (req, res) => {
    let username = req.session.activeUser.username;
    let accountName = req.body.account;
    let amount = Number(req.body.amount);

    let q = 'USE Bank; SELECT acc_amount FROM UserAccounts WHERE `acc_username`=? AND `acc_name`=?';
    let qValues = [username, accountName];

    mysqlConn.query(q, qValues, (err, qResult) => {
        if(err) throw err;

        let currentAmount = Number(qResult[1][0]['acc_amount']);

        if(currentAmount < amount){
            let q2 = 'USE Bank; SELECT acc_name FROM UserAccounts WHERE `acc_username`=?';

            mysqlConn.query(q2, [username], (err2, qResult2) => {
                if(err2) throw err2;

                let errMessage = 'Invalid amount requested! Please enter a valid amount.';
                let accounts = [];

                qResult2[1].forEach((account) => {
                    accounts.push({'account': account['acc_name']});
                });

                console.log('User attempted to withdraw more than available.');

                res.render('withdraw', {errorMessage: errMessage, accounts: accounts});       
            });
        }else{
            let newAmount = (currentAmount - amount).toFixed(2);

            let q2 = 'USE Bank; UPDATE UserAccounts SET `acc_amount`=? WHERE `acc_username`=? AND `acc_name`=?';
            let qValues2 = [newAmount, username, accountName];

            mysqlConn.query(q2, qValues2, (err2) => {
                if(err2) throw err2;

                res.render('accountupdated', {transactionType: 'Withdrawal', accountName: accountName, accountAmount: newAmount});
            });
        }
    });
});

/*
toTransfer: checks to see if the user has enough accounts to make transfers between accounts
*/
app.get('/toTransfer', (req, res) => {
    let username = req.session.activeUser.username;

    let q = 'USE Bank; SELECT acc_name FROM UserAccounts WHERE `acc_username`=?';

    mysqlConn.query(q, [username], (err, qResult) => {
        if(err) throw err;

        if(qResult[1].length > 1){
            let accounts = [];
            let errMessage = '';

            qResult[1].forEach((account) => {
                accounts.push({'account': account['acc_name']});
            });

            res.render('transfer', {errorMessage: errMessage, fromAccounts: accounts, toAccounts: accounts});
        }else{
            let errMessage = 'You do not have enough accounts to make a transfer! Please create some!';

            console.log('User attempted to make a transfer without enough accounts.');

            res.render('home', {firstName: req.session.activeUser.firstName, lastName: req.session.activeUser.lastName, errorMessage: errMessage});
        }
    });
});

/*
Transfer POST Method
*/
app.post('/transfer', (req, res) => {
    let username = req.session.activeUser.username;
    let fromAccount = req.body.fromAccount;
    let amount = Number(req.body.amount);
    let toAccount = req.body.toAccount;

    let q = 'USE Bank; SELECT acc_name FROM UserAccounts WHERE `acc_username`=?';

    mysqlConn.query(q, [username], (err, qResult) => {
        if(err) throw err;

        let accounts = [];

        qResult[1].forEach((account) => {
            accounts.push({'account': account['acc_name']});
        });

        if(fromAccount === toAccount){
            let errMessage = 'You can not transfer from the same account transferring to! Please make sure the accounts are different.';

            console.log('User attempted to transfer to account transferring from.');

            res.render('transfer', {errorMessage: errMessage, fromAccounts: accounts, toAccounts: accounts});
        }else{
            let q2 = 'USE Bank; SELECT acc_amount FROM UserAccounts WHERE `acc_username`=? AND `acc_name`=?';
            let q2Values = [username, fromAccount];

            mysqlConn.query(q2, q2Values, (err2, q2Result) => {
                if(err2) throw err2;

                let currentFromAmount = Number(q2Result[1][0]['acc_amount']);

                if(currentFromAmount < amount){
                    let errMessage = 'Invalid amount requested to transfer! Please enter a valid amount.';

                    console.log('User attempted to transfer invalid amount from account.');

                    res.render('transfer', {errorMessage: errMessage, fromAccounts: accounts, toAccounts: accounts});
                }else{
                    let newFromAmount = Number(currentFromAmount - amount).toFixed(2);
                    let q3 = 'USE Bank; UPDATE UserAccounts SET `acc_amount`=? WHERE `acc_username`=? AND `acc_name`=?';
                    let q3Values = [newFromAmount, username, fromAccount];

                    mysqlConn.query(q3, q3Values, (err3) => {
                        if(err3) throw err3;

                        let q4 = 'USE Bank; SELECT acc_amount FROM UserAccounts WHERE `acc_username`=? AND `acc_name`=?';
                        let q4Values = [username, toAccount];

                        mysqlConn.query(q4, q4Values, (err4, q4Result) => {
                            if(err4) throw err4;

                            let currentToAmount = Number(q4Result[1][0]['acc_amount']);
                            let newToAmount = Number(currentToAmount + amount).toFixed(2);

                            let q5 = 'USE Bank; UPDATE UserAccounts SET `acc_amount`=? WHERE `acc_username`=? AND `acc_name`=?';
                            let q5Values = [newToAmount, username, toAccount];

                            mysqlConn.query(q5, q5Values, (err5) => {
                                if(err5) throw err5;

                                res.render('accountupdated', {transactionType: 'Transfer', accountName: toAccount, accountAmount: newToAmount});
                            });
                        });
                    });
                }
            });
        }
    });
});

app.get('/toViewAccounts', (req, res) => {
    let username = req.session.activeUser.username;

    let q = 'USE Bank; SELECT acc_name FROM UserAccounts WHERE `acc_username`=?;';

    mysqlConn.query(q, [username], (err, qResult) => {
        if(err) throw err;

        if(qResult[1].length > 0){
            let accounts = [];

            qResult[1].forEach((account) => {
                accounts.push({'account': account['acc_name']});
            });

            let q2 = 'USE Bank; SELECT acc_amount, acc_type FROM UserAccounts WHERE `acc_username`=? AND `acc_name`=?;';
            let q2Values = [username, qResult[1][0]['acc_name']];

            mysqlConn.query(q2, q2Values, (err2, q2Result) => {
                if(err2) throw err2;

                let amount = Number(q2Result[1][0]['acc_amount']).toFixed(2);
                let type = q2Result[1][0]['acc_type'];

                res.render('viewaccounts', {accounts: accounts, type: type, amount: amount});
            });
        }else{
            let errMessage = 'You do not have any accounts to view! Please create some!';

            console.log('User attempted to view accounts without having any.');

            res.render('home', {errorMessage: errMessage, firstName: req.session.activeUser.firstName, lastName: req.session.activeUser.lastName});
        }
    });
});

/*
viewAccounts POST Method
*/
app.post('/viewAccounts', (req, res) => {
    let username = req.session.activeUser.username;
    let account = req.body.account;

    let q = 'USE Bank; SELECT acc_name FROM UserAccounts WHERE `acc_username`=?;';
    mysqlConn.query(q, [username], (err, qResult) => {
        if(err) throw err;

        let accounts = [];
        qResult[1].forEach((account) => {
            accounts.push({'account': account['acc_name']});
        });

        let q2 = 'USE Bank; SELECT acc_amount, acc_type FROM UserAccounts WHERE `acc_username`=? AND `acc_name`=?;';
        let q2Values = [username, account];

        mysqlConn.query(q2, q2Values, (err2, q2Result) => {
            if(err2) throw err2;

            let amount = Number(q2Result[1][0]['acc_amount']).toFixed(2);
            let type = q2Result[1][0]['acc_type'];

            res.render('viewaccounts', {accounts: accounts, amount: amount, type: type});
        });
    });
    
});


/*
toCreateAccount: send create account page.
*/
app.get('/toCreateAccount', (req, res) => {
    let errMessage = '';

    res.render('createaccount', {errorMessage: errMessage});
});

/*
createAccount POST Method
*/
app.post('/createAccount', (req, res) => {
    let username = req.session.activeUser.username;
    let accountName = req.body.accountName;

    let q = 'USE Bank; SELECT 1 FROM UserAccounts WHERE `acc_username`=? AND `acc_name`=?;';
    let qValues = [username, accountName];

    mysqlConn.query(q, qValues, (err, qResult) => {
        if(err) throw err;
        
        if(qResult[1].length === 1){
            let errMessage = 'You already have an account with that name! Please select a different name.';

            res.render('createaccount', {errorMessage: errMessage});
        }else{
            let accountType = req.body.accountType;
            let accountAmount = Number(req.body.accountAmount).toFixed(2);

            let q2 = 'USE Bank; INSERT INTO UserAccounts VALUES(?,?,?,?);';
            let q2Values = [accountName, accountType, accountAmount, username];

            mysqlConn.query(q2, q2Values, (err2) => {
                if(err2) throw err2;

                res.render('accountupdated', {transactionType: 'Account Creation', accountName: accountName, accountAmount: accountAmount});
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

/*
404: Page Not Found
*/
app.use((req, res) => {
    // NOTE: logging executes every time server is contacted, fix issue
    // console.log('User attempted to reach an inexistent page.');
    
    res.status(404).render('pagenotfound');
});

app.listen(3000, () => {
    console.log('Listening on port 3000!');
});