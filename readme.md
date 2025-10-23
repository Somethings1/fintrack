Your AI finance tracker
---

# Description

What every user expect from an AI finance tracker? Yes, create transactions
records and see the summary. There will be a mobile version using React Native
and a web version (hopefully we can convert those components to web). In every
version, user can create transaction records by chatting with the bot, the data
will then be translated into a transaction record using an AI model, then
stored in the database. The app will then show the records and the summary. Of
course, user can fill the transaction records manually as well.

# Tech stack

- [React](https://reactjs.org/) with [Antd](https://ant.design/) for the frontend
- [Golang](https://golang.org/) with [Gin](https://github.com/gin-gonic/gin) for the backend
- [MongoDB](https://www.mongodb.com/) for the database
- [Supabase](https://supabase.com/) for authentication


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

Now specify the location of the database with a replica set

```zsh
mongod --dbpath /usr/local/var/mongodb --logpath /usr/local/var/log/mongodb.log --fork --replSet rs0
```

### Golang

Download the [latest version of Golang](https://golang.org/dl/) and install it.
Add Golang to your PATH by

```zsh
export PATH=$PATH:/usr/local/go/bin
```

Now from the backend path, run

```zsh
go mod tidy
```

### React

Install react, then in frontend path,

```zsh
npm i --legacy-peer-deps
```


### Authentication setup
This project uses supabase authentication. Here are detailed steps:

1. Create new project on Supabase, enable authentication with email and google
    - Authentication > Configuration > URL configuration
    - Site URL: http://localhost:5173
    - Redirect URLs: http://localhost:5173/update-password
    - Project settings > Data API
    - Set .env file:
        - VITE_SUPABASE_URL: Project URL
        - VITE_SUPABASE_ANON_KEY: Project API keys
        - On backend, SUPABASE_JWT_SECRET: Jwt secret
        - SUPABASE_URL: project url
        - SUPABASE_ANON_KEY: above
    - Execute the query in `query.sql`
2. Create new project on Google Cloud
    - API and Services
    - Credentials
    - Create credentials
    - Oauth clientID
    - Authorized JS origins: http://localhost:5173 (frontend URL)
    - Authorized callback URI: copy from supabase (in the google oauth section)
    - Copy back cliendID and client secret to supabase

## Fast running in tmux
Use `./start.sh` to quickly run the project in a tmux session after installing
everything in the prequisites above.

