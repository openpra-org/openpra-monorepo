#!/bin/bash
set -e

# Start MongoDB
echo "Starting MongoDB..."
mongod --fork --logpath /var/log/mongod.log --dbpath /data/db

# Start RabbitMQ
echo "Starting RabbitMQ..."
service rabbitmq-server start

# Enable RabbitMQ plugins
rabbitmq-plugins enable rabbitmq_management rabbitmq_prometheus

# Wait for services to be ready
sleep 5

# Print logs for debugging
tail -n 20 /var/log/mongod.log || true
rabbitmqctl status

# Start a shell by default, or pass through CMD
exec "$@"