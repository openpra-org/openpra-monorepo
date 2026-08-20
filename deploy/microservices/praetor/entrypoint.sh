#!/bin/bash

# Check if any arguments are provided
if [ $# -eq 0 ]; then
    echo 'nothing to do....bye!'
    exit 0
fi

source /root/.bashrc

# Execute the command
exec "$@"
