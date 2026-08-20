# OpenPRA offline install

This bundle contains everything needed to run the OpenPRA web app on a machine with no internet access. It covers the web frontend, the backend API, MongoDB, and MinIO. The quantification microservice and the solver engines are not part of this bundle.

Two archives travel together:

| Archive                         | Purpose                                                        |
| ------------------------------- | -------------------------------------------------------------- |
| `openpra-offline-bundle.tar.gz` | The app. Images, compose file, documents, source. This README. |
| `docker-engine-offline.tar.gz`  | Docker installer. Only needed if the machine has no Docker.    |

The target machine needs Linux on x86_64. Nothing is downloaded at any point.

## Step 1. Install Docker, skip if already present

Check first:

```bash
docker info && docker compose version
```

If both commands succeed, go to step 2. If Docker is missing, install it from the companion archive:

```bash
tar -xzf docker-engine-offline.tar.gz
cd docker-engine-offline
sudo bash install-docker.sh
```

Then log out and back in so your docker group membership applies, and run the check again. Details are in `INSTALL-DOCKER.md` inside that archive.

If any docker command later fails with `permission denied while trying to connect to the Docker API at unix:///var/run/docker.sock`, your shell does not have the docker group yet. Fix it with:

```bash
newgrp docker
```

If `newgrp` reports the group is missing or access is still denied, add the membership explicitly and log out and back in:

```bash
sudo groupadd -f docker
sudo usermod -aG docker $USER
```

Verify with `id`, the groups list should include `docker`. As a last resort every command also works prefixed with `sudo`, at the cost of root-owned state.

## Step 2. Install and start the app

```bash
tar -xzf openpra-offline-bundle.tar.gz
cd openpra-offline
docker load -i openpra-images.tar
docker compose up -d
```

The first start takes a minute while MongoDB and MinIO initialize. Check status with `docker compose ps`. All services should be `running`.

## Step 3. Verify

| Service       | URL                                            |
| ------------- | ---------------------------------------------- |
| OpenPRA app   | http://localhost:8080                          |
| Backend API   | http://localhost:8080/api (proxied by the app) |
| MinIO console | http://localhost:9001 (minioadmin/minioadmin)  |

Open the app, register an account with username and password, and log in.

## Access from other machines on the network

The defaults assume you browse on the server itself. To serve other machines, restart with the server address set:

```bash
OPENPRA_HOST=192.168.1.50 docker compose up -d
```

Replace the address with the server's IP or hostname. This sets the CORS origin and the file download links. Users then browse to http://192.168.1.50:8080.

## Secrets

`JWT_SECRET` signs login sessions. `TFA_ENC_KEY` encrypts stored two-factor secrets. Both have insecure defaults in the compose file. For anything beyond a throwaway demo, set real values:

```bash
JWT_SECRET=<long random string> TFA_ENC_KEY=<long random string> docker compose up -d
```

Changing `JWT_SECRET` later logs everyone out. Changing `TFA_ENC_KEY` later breaks existing 2FA enrollments.

## Known offline limitations

Password reset emails cannot send without internet, so accounts are recovered by an admin instead. Google and GitHub login are unavailable, use username and password. Two-factor codes are checked against the server clock, so keep the server time accurate.

## Source code

The full repository is in `openpra-repo.bundle`. To restore it:

```bash
git clone openpra-repo.bundle -b main openpra-monorepo
```

## Reboots

Everything above is one-time. The Docker daemon is installed as a system service and starts on every boot, and all containers are configured with `restart: unless-stopped`, so Docker brings the whole stack back automatically after a reboot. Images and data persist. There is nothing to re-run.

If the app is not reachable after a boot, check `docker compose ps` from the `openpra-offline` folder. An empty list means the stack was explicitly stopped at some point, start it again with `docker compose up -d`.

## Teardown

`docker compose down` stops the stack and keeps the data volumes. Docker will not restart the stack after this until you run `docker compose up -d` again. `docker compose down -v` also deletes all data.
