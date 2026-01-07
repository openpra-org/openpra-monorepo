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

htpasswd -b -c -B -C 6 secrets/basic_auth_users.txt ${USERNAME} ${PASSWORD}

echo $CF_ZONE_EDIT_DNS_API_TOKEN > secrets/cf_token.txt

docker compose -f traefik.yml config

docker network create --scope=swarm --attachable -d overlay traefik-public || true

docker stack deploy -c traefik.yml --with-registry-auth proxy
