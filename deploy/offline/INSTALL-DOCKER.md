# Docker offline install

Use this only if the offline machine does not already have Docker. It installs the official static Docker binaries and the compose plugin. They work on any x86_64 Linux with a reasonably recent kernel, regardless of distribution, and need no package manager.

## Install

Copy the tarball to the machine, then:

```bash
tar -xzf docker-engine-offline.tar.gz
cd docker-engine-offline
sudo bash install-docker.sh
```

The script installs the binaries to `/usr/local/bin`, the compose plugin to `/usr/local/lib/docker/cli-plugins`, creates the docker group, adds you to it, and registers and starts a systemd service.

Log out and back in so the group membership applies, then verify:

```bash
docker info
docker compose version
```

If the machine has no systemd, start the daemon manually instead: `sudo dockerd &`.

Once Docker works, continue with the OpenPRA app bundle. See `INSTALL.md` inside `openpra-offline-bundle.tar.gz`.
