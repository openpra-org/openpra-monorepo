# RAPTOR (probabilistic Risk Assessment: Parallel Task ORchestrator)

A distributed microservice architecture designed for Probabilistic Risk Assessment (PRA) jobs primarily using the SCRAM engine. This system handles job orchestration, distributed quantification, and adaptive analysis using NestJS, RabbitMQ, and MinIO.

## Features

- **Distributed Quantification**: Splits large quantification jobs into smaller sequences for parallel processing.
- **Adaptive Analysis**: Supports adaptive quantification workflows.
- **SCRAM Integration**: Native integration with the SCRAM C++ engine via Node.js addons.
- **Robust Queuing**: Uses RabbitMQ for job distribution and status tracking.
- **Object Storage**: Utilizes MinIO for storing large inputs and reports.
- **Containerized**: Fully Dockerized for easy deployment.

## Prerequisites

- **Docker** and **Docker Compose**
- **Node.js** (v20+) and **pnpm** (if running locally without Docker)

## Quick Start (Docker)

The easiest way to run the system is using Docker Compose. This will set up the Raptor Manager, Raptor Engine, RabbitMQ, and MinIO services.

1.  **Clone the repository:**

    ```bash
    git clone <your-repo-url>
    cd <repo-name>
    ```

2.  **Start the services:**

    ```bash
    docker-compose -f docker/docker-compose.yml up -d --build
    ```

3.  **Verify deployment:**
    - **Raptor Manager API**: Accessible at `http://localhost:3000`
    - **RabbitMQ Management**: Accessible at `http://localhost:15672` (Default credentials: `guest`/`guest`)
    - **MinIO Console**: Accessible at `http://localhost:9001`

4.  **Stop the services:**
    ```bash
    docker-compose -f docker/docker-compose.yml down
    ```

## Local Development

If you prefer to run the services locally (outside of Docker containers), follow these steps. Note that you will still need RabbitMQ and MinIO running.

1.  **Install Dependencies:**

    ```bash
    pnpm install
    ```

2.  **Configure Environment:**
    Ensure you have a `.env` file in the root directory with the necessary configuration (see `docker/configs/.docker-compose.env` for reference). You may need to adjust `RABBITMQ_URL` and `MINIO_ENDPOINT` to point to your local instances.

3.  **Start the Manager:**

    ```bash
    pnpm start:manager
    ```

4.  **Start the Engine:**
    In a separate terminal:
    ```bash
    pnpm start:engine
    ```

## Architecture

- **Raptor Manager**: A NestJS application that exposes REST APIs for submitting quantification jobs. It handles job validation, splitting (for distributed jobs), and queuing tasks to RabbitMQ.
- **Raptor Engine**: A NestJS application that consumes tasks from RabbitMQ. It executes the SCRAM engine (via `scram-node`) to perform the actual quantification and uploads results to MinIO.
- **RabbitMQ**: Message broker used for task queues (`quant_job_queue`, `distributed_sequences_queue`, etc.).
- **MinIO**: S3-compatible object storage for job inputs (XML/MEF files) and outputs (JSON reports).

## API Endpoints

The Raptor Manager exposes several endpoints for job management. Key endpoints include:

- `POST /scram`: Submit a standard quantification job.
- `POST /scram/adaptive`: Submit an adaptive quantification job.
- `GET /scram/stats/:id`: Retrieve statistics for a specific job.
- `GET /scram/output/:jobId`: Retrieve the aggregated output of a job.
