#!/bin/zsh

clear

cd server
go mod tidy
go run main.go &

tmux split-window -h

tmux send-keys "mongod --dbpath /usr/local/var/mongodb --logpath /usr/local/var/log/mongodb.log " C-m
tmux send-keys "mongosh" C-m

tmux split-window -v

tmux send-keys "cd web && npm start" C-m
