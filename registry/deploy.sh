#!/bin/bash
#set -Eeuo pipefail
IFS=$'\n\t'

REGISTRY_ADMIN_USERNAME="${1:-}"
REGISTRY_ADMIN_PASSWORD="${2:-}"

if [ -z "$REGISTRY_ADMIN_USERNAME" ] || [ -z "$REGISTRY_ADMIN_PASSWORD" ]; then
  echo "Error: missing credentials. Provide both username and password as arguments."
  exit 1
fi

if ! command -v htpasswd &> /dev/null; then
  echo "Error: htpasswd not found. Install with: apt install apache2-utils"
  exit 1
fi

set -a
BASEPATH="$(pwd)"
VOL_BASE="$BASEPATH/volumes"
VOL_APP="$VOL_BASE/images"
CONFPATH="$BASEPATH/configs"
REGISTRY_CONFIG_PATH="$CONFPATH/etc/distribution/config.yml"
REGISTRY_HTTP_SECRET="$(tr -dc 'A-Za-z0-9!@#$%^&*()_+=' </dev/urandom | head -c16)"
APP="registry"
APP_PORT=5000
IMG_APP="registry:latest"
URL_APP="registry.openpra.org"
set +a

mkdir -p "$VOL_APP"

docker pull "$IMG_APP"

bcrypted_secret="$(htpasswd -b -n -B -C 6 "$REGISTRY_ADMIN_USERNAME" "$REGISTRY_ADMIN_PASSWORD")"
docker stack rm "$APP" || true
docker secret rm registry_basic_auth || true
echo "$bcrypted_secret" | docker secret create registry_basic_auth -

docker compose -f stack.yml config
docker stack deploy -c stack.yml --with-registry-auth "$APP"
