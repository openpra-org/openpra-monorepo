#!/bin/bash
set -e

# Start MongoDB
echo "Starting MongoDB..."
mongod --fork --logpath /var/log/mongod.log --dbpath /data/db

# Start RabbitMQ
echo "Starting RabbitMQ..."
service rabbitmq-server start

# Optionally enable plugins (management, prometheus, etc.)
rabbitmq-plugins enable --offline rabbitmq_management rabbitmq_prometheus

# Wait for services to be ready
sleep 5

# Print logs for debugging
tail -n 20 /var/log/mongod.log || true
rabbitmqctl status

# Start the default shell or your dev process
exec "$@"