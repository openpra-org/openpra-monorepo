#!/bin/bash

me=$(whoami)

## git ssh
sudo mkdir -p ~/.ssh

# Check if the file exists
if [ ! -e "~/.ssh/known_hosts" ]; then

    # The file does not exist, so clone the repository
    echo "~/.ssh/known_hosts does not exist, touching.."
    sudo touch ~/.ssh/known_hosts
else
    # The file exists
    echo "~/.ssh/known_hosts exists.."
fi


echo "claiming ownership of ~/.ssh directory."
sudo chown -R $me:$me ~/.ssh

# Add the host key if it's not already known
if ! grep -q git.space.openpra.org ~/.ssh/known_hosts; then
    echo "adding git.space.openpra.org to known_hosts."
    ssh-keyscan -p 2222 git.space.openpra.org >> ~/.ssh/known_hosts
    echo "waiting to sync changes."
    sleep 3
else
    echo "git.space.openpra.org already in known_hosts..skipping"
fi

# Check if the correct number of arguments was provided
if [ "$#" -ne 2 ]; then
    echo "usage: $0 <REPO_URL> <DIRECTORY> "
    exit 1
fi

# Set the directory name and repository URL from the arguments
REPO_URL="$1"
DIRECTORY="$2"

# Check if the directory exists
if [ ! -d "$DIRECTORY/.git" ]; then

    # delete stub folder, if it exists
    rm -rf "$DIRECTORY"

    # The directory does not exist, so clone the repository
    echo "repo directory $DIRECTORY does not exist. cloning repository..."

    PARENT_DIR=$(dirname "$DIRECTORY")
    mkdir -p "$PARENT_DIR"

    # Clone the repository and check for errors
    if ! git clone "$REPO_URL" "$DIRECTORY"; then
        echo "failed to clone the repository."
        exit 1
    fi
else
    # The directory exists
    echo "directory $DIRECTORY already exists. skipping clone."
fi
