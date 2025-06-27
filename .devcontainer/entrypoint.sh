#!/bin/bash

source /root/.bashrc

# If a command is provided, run it; otherwise, keep the container alive
if [ $# -gt 0 ]; then
  exec "$@"
else
  # Keep the container running
  tail -f /dev/null
fi