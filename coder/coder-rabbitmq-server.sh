#!/bin/bash

sudo bash -c 'rabbitmq-server > /tmp/rabbitmq-server.log 2>&1 &'
echo -n "starting rabbitmq-server: log at /tmp/rabbitmq-server.log.."
sleep 6
echo "done"

# start rabbitmq-server, write streams to log file, and let it run in the background
sudo bash -c 'rabbitmqctl add_user coder coder'
sudo bash -c 'rabbitmqctl set_permissions -p / coder ".*" ".*" ".*"'
sudo bash -c 'rabbitmqctl set_user_tags coder administrator'
sudo bash -c 'rabbitmq-plugins enable rabbitmq_management'
