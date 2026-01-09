# GitHub Proxy Service - Traefik v3.6 Setup

This repository contains the configuration for a dedicated Traefik v3.6 reverse proxy for GitHub Actions deployments, separate from the main OpenPRA infrastructure.

## Overview

- **Traefik Version**: v3.6 (Swarm provider)
- **Ports**: 8081 (HTTP), 8443 (HTTPS)
- **Networks**: `traefik-github-public` (external), `traefik-github-private` (internal)
- **SSL**: Let's Encrypt with Cloudflare DNS challenge
- **Access**: Via Cloudflare Tunnel (no direct port exposure)

## Prerequisites

- Docker Swarm cluster initialized
- Cloudflare account with API access
- Domain managed by Cloudflare (`openpra.org`)

## Step 1: Create Cloudflare Tunnel

1. Go to [Cloudflare Zero Trust Dashboard](https://one.dash.cloudflare.com/)
2. Navigate to **Networks** > **Tunnels**
3. Click **Create a tunnel**
4. Choose **Cloudflared** as connector type
5. Name it: `github-deployments`
6. Click **Save tunnel**
7. **Copy the tunnel token** (format: `eyJhIjoiXXXXX...`)

### Configure Public Hostnames

After creating the tunnel:

1. Click **Add a public hostname**
2. Configure wildcard route:
   - **Subdomain**: `*`
   - **Domain**: `openpra.org`
   - **Path**: (leave empty)
   - **Type**: `HTTP`
   - **URL**: `traefik-github:80`
   - Click **Save hostname**

3. (Optional) Add specific route for dashboard:
   - **Subdomain**: `github-proxy`
   - **Domain**: `openpra.org`
   - **Path**: (leave empty)
   - **Type**: `HTTP`
   - **URL**: `traefik-github:80`
   - Click **Save hostname**

## Step 2: Create Cloudflare API Token

1. Go to [Cloudflare API Tokens](https://dash.cloudflare.com/profile/api-tokens)
2. Click **Create Token**
3. Use **Edit zone DNS** template
4. Configure:
   - **Permissions**: Zone → DNS → Edit
   - **Zone Resources**: Include → Specific zone → `openpra.org`
5. Click **Continue to summary** then **Create Token**
6. **Copy the API token** (format: `s2nToliZpst20v0_...`)

## Step 3: Prepare Server Directory Structure

```bash
# Create base directory
mkdir -p ~/traefik-gh

# Navigate to directory
cd ~/traefik-gh

# Create subdirectories
mkdir -p secrets volumes/public-certificates volumes/cloudflare volumes/file-provider-config
```

## Step 4: Create Environment Variables File

Create `~/traefik-gh/env_vars`:

```bash
# Admin credentials for Traefik dashboard
USERNAME=your.email@openpra.org
PASSWORD=your-secure-password

# Cloudflare Tunnel Token for GitHub deployments
CF_TUNNEL_GITHUB_TOKEN=eyJhIjoiXXXXXXXX...

# Cloudflare API Token with DNS edit permissions
CF_ZONE_EDIT_DNS_API_TOKEN=s2nToliZpst20v0_...

# Cloudflare Zone ID for openpra.org
ZONE_ID=1b37e6d60c0fd443618c49421362dbd8
```

**Note**: Replace all placeholder values with your actual credentials.

## Step 5: Create Secrets Files

```bash
# Navigate to secrets directory
cd ~/traefik-gh/secrets

# Create basic auth file (replace USERNAME and PASSWORD with your values)
htpasswd -nb USERNAME PASSWORD > basic_auth_users.txt

# Set proper permissions
chmod 600 basic_auth_users.txt
```

## Step 6: Create Docker Network

```bash
# Create external network for Traefik
docker network create --driver=overlay --attachable traefik-github-public
```

## Step 7: Copy Configuration Files

Copy these files to `~/traefik-gh/`:
- `traefik-github.yml` - Main Docker Compose stack
- `env_vars` - Environment variables (already created in Step 4)
- `deploy-github.sh` - Deployment script (optional)

## Step 8: Create Deployment Script

Create `~/traefik-gh/deploy-github.sh`:

```bash
#!/bin/bash

# Load environment variables
set -a
source ./env_vars
set +a

# Create secrets if they don't exist
if [ ! -f ./secrets/basic_auth_users.txt ]; then
    echo "Creating basic auth users file..."
    htpasswd -nb "$USERNAME" "$PASSWORD" > ./secrets/basic_auth_users.txt
    chmod 600 ./secrets/basic_auth_users.txt
else
    echo "basic_auth_users.txt already exists, skipping creation"
fi

# Create network if it doesn't exist
if ! docker network ls | grep -q traefik-github-public; then
    echo "Creating traefik-github-public network..."
    docker network create --driver=overlay --attachable traefik-github-public
else
    echo "Error response from daemon: network with name traefik-github-public already exists"
fi

# Deploy stack
docker stack deploy --compose-file traefik-github.yml proxy-github
```

Make it executable:

```bash
chmod +x ~/traefik-gh/deploy-github.sh
```

## Step 9: Deploy the Stack

```bash
cd ~/traefik-gh
./deploy-github.sh
```

Expected output:
```
basic_auth_users.txt already exists, skipping creation
Error response from daemon: network with name traefik-github-public already exists
Creating service proxy-github_error-pages-github
Creating service proxy-github_tunnel-github
Creating service proxy-github_cloudflare-companion-github
Creating service proxy-github_traefik-github
Creating service proxy-github_traefik-forward-auth-github
```

## Step 10: Verify Deployment

```bash
# Check all services are running
docker service ls --filter "name=proxy-github"

# Expected output:
# NAME                                       MODE         REPLICAS   IMAGE
# proxy-github_cloudflare-companion-github   replicated   0/0        ghcr.io/tiredofit/...
# proxy-github_error-pages-github            replicated   2/2        tarampampam/error-pages
# proxy-github_traefik-forward-auth-github   replicated   1/1        thomseddon/traefik-forward-auth
# proxy-github_traefik-github                global       1/1        traefik:v3.6
# proxy-github_tunnel-github                 replicated   1/1        cloudflare/cloudflared

# Check tunnel connection
docker logs $(docker ps --filter "name=proxy-github_tunnel-github" -q) 2>&1 | grep "Registered tunnel"

# Should see multiple lines like:
# Registered tunnel connection connIndex=0 connection=... ip=... location=...
```

## Step 11: Access the Dashboard

Open your browser and navigate to:
- Dashboard: `https://github-proxy.openpra.org/dashboard/`
- API: `https://github-proxy.openpra.org/api/rawdata`

The dashboard is publicly accessible (no authentication required).

## Deploying Applications

To deploy an application through this proxy:

1. **Add to the `traefik-github-public` network** in your Docker Compose file:
   ```yaml
   networks:
     - traefik-github-public
   
   networks:
     traefik-github-public:
       external: true
   ```

2. **Add Traefik labels** to your service:
   ```yaml
   deploy:
     labels:
       - "traefik.enable=true"
       - "traefik.docker.network=traefik-github-public"
       - "traefik.constraint-label=traefik-github-public"
       # HTTP Router
       - "traefik.http.routers.myapp-http.rule=Host(`myapp.openpra.org`)"
       - "traefik.http.routers.myapp-http.entrypoints=http"
       - "traefik.http.routers.myapp-http.service=myapp"
       # HTTPS Router (optional, tunnel already handles TLS)
       - "traefik.http.routers.myapp-https.rule=Host(`myapp.openpra.org`)"
       - "traefik.http.routers.myapp-https.entrypoints=https"
       - "traefik.http.routers.myapp-https.tls=true"
       - "traefik.http.routers.myapp-https.service=myapp"
       # Service
       - "traefik.http.services.myapp.loadbalancer.server.port=80"
   ```

3. **Deploy your application**:
   ```bash
   docker stack deploy --compose-file your-app.yml your-app-name
   ```

## Maintenance

### View Logs

```bash
# Traefik logs
docker logs $(docker ps --filter "name=proxy-github_traefik-github" -q)

# Tunnel logs
docker logs $(docker ps --filter "name=proxy-github_tunnel-github" -q)

# All services
docker service logs proxy-github_traefik-github
```

### Update Stack

```bash
cd ~/traefik-gh
./deploy-github.sh
```

### Remove Stack

```bash
docker stack rm proxy-github
```

### Check Certificate Status

```bash
# View acme.json (requires sudo)
sudo cat ~/traefik-gh/volumes/public-certificates/acme.json | jq '.cloudflare.Certificates'
```

## Troubleshooting

### Service Not Accessible

1. Check service is running: `docker service ps proxy-github_servicename`
2. Check Traefik logs for errors
3. Verify labels are correct on your application
4. Ensure service is on `traefik-github-public` network

### Redirect Loop

- Ensure Cloudflare tunnel routes to `http://traefik-github:80` (not https)
- Verify `forwardedHeaders.insecure=true` is set in Traefik config

### Certificate Issues

- Check Cloudflare API token has DNS edit permissions
- Verify ZONE_ID is correct
- Check Traefik logs for ACME errors: `docker logs ... | grep -i acme`

### Tunnel Not Connecting

- Verify `CF_TUNNEL_GITHUB_TOKEN` is correct
- Check tunnel logs: `docker logs $(docker ps --filter "name=tunnel-github" -q)`
- Ensure tunnel is active in Cloudflare dashboard

## Architecture

```
Internet
    ↓
Cloudflare (TLS termination)
    ↓
Cloudflare Tunnel (github-deployments)
    ↓
traefik-github:80 (HTTP only, trusts X-Forwarded-* headers)
    ↓
Docker Services on traefik-github-public network
```

## Security Notes

- Dashboard is publicly accessible (authentication removed for simplicity)
- To add authentication, restore `traefik-forward-auth-github` middleware
- All secrets should be kept secure and never committed to version control
- Cloudflare tunnel handles TLS, internal traffic is HTTP
- Let's Encrypt certificates are still generated via DNS challenge for direct access scenarios

## Files Reference

```
~/traefik-gh/
├── env_vars                          # Environment variables
├── deploy-github.sh                  # Deployment script
├── traefik-github.yml               # Docker Compose stack
├── secrets/
│   └── basic_auth_users.txt         # HTTP Basic Auth credentials
└── volumes/
    ├── public-certificates/
    │   └── acme.json                # Let's Encrypt certificates
    ├── cloudflare/                  # Cloudflare provider data
    └── file-provider-config/        # Additional Traefik config (optional)
```

## Support

For issues or questions, refer to:
- [Traefik v3 Documentation](https://doc.traefik.io/traefik/)
- [Cloudflare Tunnel Documentation](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/)
- OpenPRA Infrastructure Team
