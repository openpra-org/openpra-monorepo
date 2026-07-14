#!/usr/bin/env bash
set -euo pipefail

if [ "$(id -u)" -ne 0 ]; then
  echo "Run as root: sudo bash install-docker.sh"
  exit 1
fi

DIR="$(cd "$(dirname "$0")" && pwd)"

echo "==> Installing Docker binaries to /usr/local/bin"
tar -xzf "$DIR"/docker-*.tgz -C /tmp
cp /tmp/docker/* /usr/local/bin/
rm -rf /tmp/docker

echo "==> Installing the compose plugin"
mkdir -p /usr/local/lib/docker/cli-plugins
cp "$DIR/docker-compose-linux-x86_64" /usr/local/lib/docker/cli-plugins/docker-compose
chmod +x /usr/local/lib/docker/cli-plugins/docker-compose

echo "==> Creating the docker group"
groupadd -f docker
if [ -n "${SUDO_USER:-}" ]; then
  usermod -aG docker "$SUDO_USER"
  echo "Added $SUDO_USER to the docker group. Log out and back in to apply."
fi

if command -v systemctl >/dev/null 2>&1; then
  echo "==> Installing the systemd service"
  cat > /etc/systemd/system/docker.service <<'EOF'
[Unit]
Description=Docker Application Container Engine
After=network-online.target
Wants=network-online.target

[Service]
ExecStart=/usr/local/bin/dockerd
Restart=always
RestartSec=5
Delegate=yes
KillMode=process
LimitNOFILE=1048576
LimitNPROC=infinity
LimitCORE=infinity
TasksMax=infinity

[Install]
WantedBy=multi-user.target
EOF
  systemctl daemon-reload
  systemctl enable --now docker
  echo "==> Docker service started"
else
  echo "==> No systemd found. Start the daemon manually with: sudo dockerd &"
fi

docker --version
docker compose version
