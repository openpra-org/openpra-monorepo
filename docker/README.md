# Docker Configuration

The configuration is designed to build and deploy a full-stack application with `web-editor`, `web-backend`, and a MongoDB database, along with a Mongo Express for database management during development.

## Overview

The Docker setup is divided into several components:

- **Dockerfile**: Defines the multi-stage build process for creating Docker images for both the frontend and backend services.
- **default.conf**: The Nginx configuration file for the frontend service, which serves the static files and proxies requests.
- **docker-compose.yml**: A Docker Compose file for local development, setting up the MongoDB and Mongo Express services.
- **stack.yml**: A Docker Stack deployment file for deploying the services using Docker Swarm, with Traefik as a reverse proxy and load balancer.

## [Dockerfile](Dockerfile)

The `Dockerfile` is a multi-stage build file that creates separate images for
the frontend and backend services.

- **Base Image**: Built from `node:20.2.0-slim`, it installs necessary build tools and the NX CLI.
- **Frontend Builder**: Compiles the frontend application using the NX build command.
- **Frontend**: Uses Nginx to serve the frontend static files.
- **Backend**: Sets up the backend service, ready to connect to the MongoDB database.

## [default.conf](default.conf)

The `default.conf` file is the Nginx configuration for the frontend service. It
sets up the server to listen on port 80 and serve files from
the `/usr/share/nginx/html/web-editor` directory, with a fallback to
`index.html` for single-page application routing.

## [docker-compose.yml](../docker-compose.yml)

The `docker-compose.yml` file is used for local development. It defines two
services:

- **mongo**: The MongoDB database service.
- **mongo-express**: A web-based MongoDB administration interface.

## [stack.yml](stack.yml)

The `stack.yml` file is used for deploying the application stack to a Docker
Swarm cluster. It includes service definitions for the frontend, backend,
MongoDB, and Mongo Express, along with their respective configurations for
Traefik labels, networks, and secrets.

## Usage

To build and run the services locally, you can use Docker Compose:

```shell
docker-compose -f docker-compose.yml up --build
```

For deployment to a Docker Swarm cluster, first ensure that the `traefik-public`
network is created and then deploy the stack:

```shell
docker stack deploy -c stack.yml openpra
```
