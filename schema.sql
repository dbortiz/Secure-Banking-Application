USE Bank;
CREATE TABLE BankUsers(username VARCHAR(20) PRIMARY KEY, password VARCHAR(30),
fName VARCHAR(20), lName VARCHAR(20), address VARCHAR(30), city VARCHAR(30),
state VARCHAR(2), zip NUMERIC(5));
CREATE TABLE UserAccounts(acc_name VARCHAR(15) PRIMARY KEY, acc_type VARCHAR(10),
acc_amount NUMERIC(15, 2), acc_username VARCHAR(20) REFERENCES BankUsers(username));