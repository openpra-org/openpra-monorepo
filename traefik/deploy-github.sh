#!/bin/bash
set -a
source env_vars
set +a

mkdir -p secrets volumes/cloudflare volumes/public-certificates volumes/file-provider-config

# Check if htpasswd is installed
if ! command -v htpasswd &> /dev/null; then
    echo "htpasswd could not be found, please install it using apt install apache2-utils"
    exit 1
fi

# Only create secrets if they don't exist, to avoid overwriting existing ones
if [ ! -f secrets/basic_auth_users.txt ]; then
    echo "Creating basic_auth_users.txt..."
    htpasswd -b -c -B -C 6 secrets/basic_auth_users.txt ${USERNAME} ${PASSWORD}
else
    echo "basic_auth_users.txt already exists, skipping creation"
fi

if [ ! -f secrets/cf_token.txt ]; then
    echo "Creating cf_token.txt..."
    echo $CF_ZONE_EDIT_DNS_API_TOKEN > secrets/cf_token.txt
else
    echo "cf_token.txt already exists, skipping creation"
fi

docker compose -f traefik-github.yml config

# Create the GitHub-specific network (separate from traefik-public)
docker network create --scope=swarm --attachable -d overlay traefik-github-public || true

# Deploy the GitHub proxy stack with a different name
docker stack deploy -c traefik-github.yml --with-registry-auth proxy-github
