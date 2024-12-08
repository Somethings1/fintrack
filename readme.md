Your AI finance tracker
---

# Disclaimer
This is my first app in the full-stack dev journey. I've got several projects
in progress, and all of them have gone to the ultimate trash can of the
universe of programming. So, in order to make this a difference, I'm going to
conmmit evrything to github, so I can keep track of my progress. This readme.md
was created the same time I got this idea, so i can actually measure the time
it took to finish this project.

This readme file will be updated several times.

# Tech stack

The tech stack of this app is (hopefully):

- [React](https://reactjs.org/) for the frontend
- [Golang](https://golang.org/) for the backend
- [MongoDB](https://www.mongodb.com/) for the database

No, I don't know what I'm doing. I don't even know anything above. I don't even
know anything about web development. Everything I did was some stupid JavaFX
thingies and called it a day. However, this should end. Hopefully, in a month
or two, I can finish this project.

# Description

What every user expect from an AI finance tracker? Yes, create transactions
records and see the summary. There will be a mobile version using React Native
and a web version (hopefully we can convert those components to web). In every
version, user can create transaction records by voice, the data will then be
translated into a transaction record using an AI model, then stored in the
database. The app will then show the records and the summary. Of course, user
can fill the transaction records manually as well.

So, with that being said, let's hop into it, tomorrow. And, hopefully, there
will be an exact same app, with completely different tech stack, in another
month or two, so I can see how fast I learn new techs.

# Installation

## Prequisites

### MongoDB

Download the [latest version of MongoDB](https://www.mongodb.com/try/download/community)
and the [MongoSHell](https://docs.mongodb.com/manual/reference/mongo-shell/)
then install them.

Add MongoDB to your PATH by creating a path file

```zsh
sudo mkdir /usr/local/mongodb
```
Copy the downloaded folder into the path above, for example

```zsh
sudo cp -r mongodb-linux-x86_64-ubuntu2004-4.4.21 /usr/local/mongodb
```

Remember to also add the Mongoshell to mongodb/bin.

After that, add the path to the path file

```zsh
export PATH=$PATH:/usr/local/mongodb/bin
```

Now specify the location of the database

```zsh
mongod --dbpath /usr/local/var/mongodb --logpath /usr/local/var/log/mongodb.log --fork
```

Then run

```zsh
mongo
```

### Golang

Download the [latest version of Golang](https://golang.org/dl/) and install it.
Add Golang to your PATH by

```zsh
export PATH=$PATH:/usr/local/go/bin
```

Remember to run

```zsh
go mod tidy
```

if it's the first time

### React

Just do it, it's easy.

# Changelog

- 2024/11/30: readme.md
- 2024/12/01: Installed MongoDB, React and Golang. Make them work together.
- 2024/12/02: Basic signup feature. Tested for validity on server side.
- 2024/12/03: Basic login feature.
- 2024/12/07: Been sick for 3 days straight. Finally added proper login feature.
Got the access token and fresh token to work, so authentication is basically done.
Maybe I have to add some login-related features in the future, but it handles the basics
well enough.
Oh and also: it's so fun spending an entire day just to know that I have to use
a proxy in package.json to make the cookie thingies work in safari. Good job, apple.
- 2024/12/08: Taking the TOEIC test, so not much work is done.

Tomorrow's work: write all CRUD operations on the backend. There are:

- Add transaction
- Edit transaction
- Get transaction by year
- Delete transaction
- Add account
- Edit account
- adjust account balance
- delete account
- get all accounts of a user
- Add a category
- edit a category
- delete a category
- get all categories of a user

- assert information (3 functions)

So that would be a total of 16 functions. Plus the test, there should be 29
functions. I would call it a day.
