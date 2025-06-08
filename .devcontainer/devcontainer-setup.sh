#!/bin/bash
set -e

# Start MongoDB (in background)
sudo mkdir -p /data/db
sudo chown -R vscode:vscode /data/db
mongod --fork --logpath /tmp/mongo.log --dbpath /data/db

# Start RabbitMQ (in background)
sudo service rabbitmq-server start

# (Optional) Any other setup, e.g., git submodules
git submodule update --init --recursive

# Print status
echo "MongoDB and RabbitMQ started."