Your AI finance tracker
---

# Disclaimer
This is my first app in the full-stack dev journey. I've got several projects
in progress, and all of them have gone to the ultimate trash can of the
universe of programming. So, in order to make this a difference, I'm going to
conmmit everything to github, so I can keep track of my progress. This readme.md
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

[Update]: The stack turns out to be so much nicer than I thought, despite the
pain from mongodb. I got gin the framework on the backend, it makes routing and
middleware so easier.

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

Now from the backend path, run

```zsh
go mod tidy
go run main.go
```

### React

Install react, then in frontend path,

```zsh
npm start
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

