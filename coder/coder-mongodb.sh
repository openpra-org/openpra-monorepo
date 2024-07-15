#!/bin/bash

# take ownership of mongo directory only if they aren't owned by the current user
uid=$(id -u)
gid=$(id -g)

owner_uid=$(stat -c '%u' /data/db 2>/dev/null || echo "0")
owner_gid=$(stat -c '%g' /data/db 2>/dev/null || echo "0")

sudo mkdir -p /data/db

if [ "$owner_uid" != "$uid" ] || [ "$owner_gid" != "$gid" ]; then
    echo -n "changing ownership of /data/db to user: $uid, group: $gid.."
    sudo chown -R "$uid":"$gid" /data/db
    echo "done"
else
    echo "ownership of /data/db is already set to user: $uid, group: $gid..done"
fi

echo -n "starting mongod: log at /tmp/mongo.log.."

# start mongo, write streams to log file, and let it run in the background
mongod > /tmp/mongo.log 2>&1 &

echo "done"
