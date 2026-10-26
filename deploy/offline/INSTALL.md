# OpenPRA offline install

This bundle runs the whole OpenPRA app on a machine with no internet access. It holds the web frontend, the backend API, PRAETOR with its quantification worker, MongoDB, RabbitMQ and MinIO as saved Docker images. Nothing is downloaded at any point.

A release has these files:

| File                                   | Purpose                                                              |
| -------------------------------------- | -------------------------------------------------------------------- |
| `openpra-offline-bundle.tar.gz.part-*` | The app in parts. Images, compose file, documents, source, this file |
| `openpra-offline-bundle.sha256`        | Checksums of the parts                                               |
| `docker-engine-offline.tar.gz`         | Docker installer. Only needed if the machine has no Docker           |
| `docker-engine-offline.sha256`         | Checksum of the Docker installer                                     |

The target machine needs Linux on x86_64, at least 8 GB of memory and about 30 GB of free disk.

## Step 1. Check and unpack the bundle

Put the parts and the checksum file in one folder. Then check and unpack them:

```bash
sha256sum -c openpra-offline-bundle.sha256
cat openpra-offline-bundle.tar.gz.part-* | tar -xz
```

Every part should report `OK`. A failed part was damaged on the way. Copy it again.

## Step 2. Install Docker, skip if already present

Check first:

```bash
docker info && docker compose version
```

If both commands succeed, go to step 3. If Docker is missing, install it from the companion archive:

```bash
sha256sum -c docker-engine-offline.sha256
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

## Step 3. Load the images

```bash
cd openpra-offline
docker load -i openpra-images.tar
```

Loading takes a few minutes. Afterwards you can delete `openpra-images.tar` and the parts to free disk space. Keep the rest of the `openpra-offline` folder, because the backend reads the example documents from it.

## Step 4. Set the secrets

`JWT_SECRET` signs login sessions. `TFA_ENC_KEY` encrypts stored two-factor secrets. Generate both once and keep them in `deploy/.env`, the settings file of this machine:

```bash
cd deploy
echo "JWT_SECRET=$(openssl rand -hex 48)" >> .env
echo "TFA_ENC_KEY=$(openssl rand -hex 48)" >> .env
```

Changing `JWT_SECRET` later logs everyone out. Changing `TFA_ENC_KEY` later breaks existing two-factor enrollments. If you upgrade from an earlier bundle, read the upgrade section first.

## Step 5. Start the app

From `openpra-offline/deploy`:

```bash
docker compose up -d
docker compose ps
```

The first start takes a minute while MongoDB, RabbitMQ and MinIO initialize. Every service should be `Up`, and MongoDB, RabbitMQ and MinIO should be `healthy`.

## Step 6. Verify

| Service          | URL                                                   |
| ---------------- | ----------------------------------------------------- |
| OpenPRA app      | http://localhost:8080                                 |
| PRAETOR manager  | http://localhost:3000/q/docs                          |
| MinIO console    | http://localhost:9001, login `minioadmin`/`minioadmin` |
| RabbitMQ console | http://localhost:15672, login `guest`/`guest`          |

Open the app, register an account with a username and password, and sign in.

## Serve other machines on the network

By default the app answers only on the server itself. To serve other machines, add two lines to `deploy/.env` with this server's IP address or host name:

```bash
OPENPRA_BIND=0.0.0.0
OPENPRA_HOST=192.168.1.50
```

Then run `docker compose up -d` again from `openpra-offline/deploy`. Users browse to http://192.168.1.50:8080. Their browsers also need port 9000, because MinIO serves avatars and covers directly.

## Settings

`deploy/.env` holds the settings of this machine. Compose reads it on every command. Its first two lines keep the app offline. `COMPOSE_PROJECT_NAME=openpra-offline` names the stack. `TFA_TIME_URL=` makes two-factor checks use the server clock instead of an online time service.

Section 6.2 of `README.md` in the source lists every other setting. For example, `PRAETOR_WORKERS=2` runs two quantification jobs at once. Each worker needs its own memory for the models it solves. After a change, run `docker compose up -d` again.

## Upgrade from an earlier bundle

The stack keeps the name `openpra-offline`, so a new bundle reuses the data of the old one. First stop the old stack. Run this in the folder that holds its compose file:

```bash
docker compose down
```

This keeps the data. Then unpack the new bundle in a new folder and load its images (steps 1 and 3). Copy the old `deploy/.env` over the new one, if the old bundle has one.

The first bundle (`offline-v1`) has no `deploy/.env`. It read the secrets from the shell. Keep its two-factor key, so existing two-factor enrollments keep working. If you never set one, it was `offline-tfa-key-change-me`. Generate a new `JWT_SECRET`, which only logs everyone out once:

```bash
cd openpra-offline/deploy
echo "TFA_ENC_KEY=offline-tfa-key-change-me" >> .env
echo "JWT_SECRET=$(openssl rand -hex 48)" >> .env
```

The first bundle also served other machines without any setting. If other machines used it, add `OPENPRA_BIND` and `OPENPRA_HOST` as in the network section. Then start the app (step 5).

## Known offline limitations

Password reset emails cannot send, so an admin recovers accounts instead. Google and GitHub sign-in are unavailable, so accounts use a username and password. Two-factor codes are checked against the server clock, so keep the server time accurate. The Docs link in the app and the links to published sources open internet pages, so they work only on machines with internet access.

## Source code

The source of this release is in `openpra-repo.bundle`. To restore it:

```bash
GIT_LFS_SKIP_SMUDGE=1 git clone openpra-repo.bundle openpra-monorepo
```

The bundle carries no Git LFS content, so the PDF files in the clone are LFS pointers. The real example documents are in `apps/backends/web-backend/example-documents` of this bundle.

## Reboots

Everything above is one-time. The Docker daemon is installed as a system service and starts on every boot. Every container has `restart: unless-stopped`, so Docker brings the whole stack back after a reboot. Images and data persist. There is nothing to re-run.

If the app is not reachable after a boot, run `docker compose ps` from `openpra-offline/deploy`. An empty list means the stack was stopped on purpose at some point. Start it again with `docker compose up -d`.

## Teardown

`docker compose down` stops the stack and keeps the data volumes. Docker does not restart the stack after this until you run `docker compose up -d` again. `docker compose down -v` also deletes all data.
