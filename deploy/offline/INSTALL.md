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

If the machine already runs OpenPRA from an earlier bundle, skip steps 1 to 6 and follow [Upgrade from an earlier bundle](#upgrade-from-an-earlier-bundle). It keeps all data.

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

Changing `JWT_SECRET` later logs everyone out. Changing `TFA_ENC_KEY` later breaks existing two-factor enrollments. If you upgrade from an earlier bundle, follow the upgrade section instead.

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

Use this section instead of steps 1 to 6 when the machine already runs OpenPRA from an earlier bundle. It keeps every account, project, workbook and file. They live in two Docker volumes, `openpra-offline_mongo_data` and `openpra-offline_minio_data`. The new bundle opens the same volumes, because its stack has the same name, `openpra-offline`. The steps still back up the data and the old images first, so you can always go back.

### Upgrade step 1. Check the machine

The new version needs at least 8 GB of memory. The disk needs about 30 GB free, plus room for a backup of the data and the old images. Check all three:

```bash
free -g
df -h /var/lib/docker $HOME
docker system df -v | grep openpra-offline_
```

The last command lists the data volumes and their sizes. You should see `openpra-offline_mongo_data` and `openpra-offline_minio_data`.

Note the settings of the old install. The first bundle (`offline-v1`) read `TFA_ENC_KEY`, `JWT_SECRET` and `OPENPRA_HOST` from the shell, for example `TFA_ENC_KEY=... docker compose up -d`. If you never set `TFA_ENC_KEY`, it is `offline-tfa-key-change-me`. Later bundles keep every setting in `deploy/.env`.

### Upgrade step 2. Stop the old stack

Go to the folder with the old compose file. For the first bundle that is its `openpra-offline` folder. For later bundles it is `openpra-offline/deploy`. Then stop the stack:

```bash
docker compose down
```

This keeps the data. Never add `-v`, which deletes it.

### Upgrade step 3. Back up the data and the old images

Stay in the same folder and run:

```bash
mkdir -p $HOME/openpra-backup
docker save -o $HOME/openpra-backup/images.tar $(docker compose config --images)
docker run --rm -v openpra-offline_mongo_data:/data:ro -v $HOME/openpra-backup:/backup openpra-apps-web-backend:local tar --numeric-owner -czf /backup/mongo_data.tar.gz -C /data .
docker run --rm -v openpra-offline_minio_data:/data:ro -v $HOME/openpra-backup:/backup openpra-apps-web-backend:local tar --numeric-owner -czf /backup/minio_data.tar.gz -C /data .
tar -tzf $HOME/openpra-backup/mongo_data.tar.gz > /dev/null && echo "MongoDB backup OK"
tar -tzf $HOME/openpra-backup/minio_data.tar.gz > /dev/null && echo "MinIO backup OK"
```

Both checks must print `OK`. If the folder has a `.env` file, copy it into the backup as well with `cp .env $HOME/openpra-backup/`. Keep the backup and the old bundle's folder until the new version has run well for a while.

### Upgrade step 4. Unpack the new bundle in a new folder

Make a new folder for the new bundle. Never use the old bundle's folder, because both bundles unpack to a folder named `openpra-offline`.

```bash
mkdir ~/openpra-new
```

If `mkdir` reports that the folder exists, an earlier upgrade used that name. Pick another name and use it in the commands below. Copy the new parts and their checksum file into the new folder. Then check and unpack them:

```bash
cd ~/openpra-new
sha256sum -c openpra-offline-bundle.sha256
cat openpra-offline-bundle.tar.gz.part-* | tar -xz
```

### Upgrade step 5. Load the new images

```bash
cd ~/openpra-new/openpra-offline
docker load -i openpra-images.tar
```

### Upgrade step 6. Carry over the settings

If the old bundle has a `deploy/.env`, copy it into the new bundle:

```bash
cp $HOME/openpra-backup/.env ~/openpra-new/openpra-offline/deploy/.env
```

For the first bundle, write the settings into the new `deploy/.env` instead. Replace the key with your own if you set one. A new `JWT_SECRET` only logs everyone out once.

```bash
cd ~/openpra-new/openpra-offline/deploy
echo "TFA_ENC_KEY=offline-tfa-key-change-me" >> .env
echo "JWT_SECRET=$(openssl rand -hex 48)" >> .env
```

The first bundle served other machines without any setting. If other machines used it, add this server's IP address or host name too:

```bash
echo "OPENPRA_BIND=0.0.0.0" >> .env
echo "OPENPRA_HOST=192.168.1.50" >> .env
```

### Upgrade step 7. Start the new version

```bash
cd ~/openpra-new/openpra-offline/deploy
docker compose up -d
docker compose ps
```

Every service should be `Up`, and MongoDB, RabbitMQ and MinIO should be `healthy`. On the first start the backend converts old workbooks to the current format and keeps a copy of each original. Sign in and open a project to check your data. Then each user reloads the app once with Ctrl+Shift+R, or Cmd+Shift+R on macOS, because browsers may still hold the old page.

### Go back to the old version

If the new version does not work, restore the backup and the old images. Each restore command first reads its backup file in full, and only then replaces the content of the volume.

```bash
cd ~/openpra-new/openpra-offline/deploy
docker compose down
docker run --rm -v openpra-offline_mongo_data:/data -v $HOME/openpra-backup:/backup openpra-apps-web-backend:local sh -c "tar -tzf /backup/mongo_data.tar.gz > /dev/null && find /data -mindepth 1 -delete && tar --numeric-owner -xzf /backup/mongo_data.tar.gz -C /data"
docker run --rm -v openpra-offline_minio_data:/data -v $HOME/openpra-backup:/backup openpra-apps-web-backend:local sh -c "tar -tzf /backup/minio_data.tar.gz > /dev/null && find /data -mindepth 1 -delete && tar --numeric-owner -xzf /backup/minio_data.tar.gz -C /data"
docker load -i $HOME/openpra-backup/images.tar
```

Then go to the folder with the old compose file and start the old stack with the same settings as before:

```bash
docker compose up -d
```

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
