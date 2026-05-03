# OpenPRA Quantum Artifact and API Contract v1

## Purpose

This document defines the first pass artifact model and service contract for the OpenPRA quantum integration project. It is intended to reduce drift before additional implementation work proceeds.

## Contract metadata

- schemaVersion: 1.0.0
- documentVersion: 1
- createdAtUtc: 2026-04-13T19:38:55Z
- createdBy: openpra_quantum_baseline_freeze_v1.sh 1.0.0

## Core design rule

OpenPRA quantum integration must support optional execution through:

- simulator
- emulator
- real_hardware

All execution providers must normalize into the same execution artifact shape so the rest of the platform can consume them consistently.

## Canonical workflow chain

PRA model  
-> subtree  
-> readiness artifact  
-> preparation artifact  
-> execution artifact  
-> recovery artifact  
-> importance artifact  
-> provenance manifest

## Required common fields for every artifact

Every quantum artifact must include at minimum:

- schemaVersion
- artifactType
- artifactId
- createdAtUtc
- createdBy
- inputReferences
- sourceHashes
- notes

## Artifact definitions

### 1. readiness artifact

Purpose: report whether a subtree is quantum tractable and why.

Required fields:
- schemaVersion
- artifactType = readiness
- artifactId
- subtreeId
- rootGateId
- topologyClass
- basicEventCount
- requiredQubits
- backendEligibility
- readinessDecision
- readinessReason
- createdAtUtc
- createdBy
- inputReferences
- sourceHashes
- notes

### 2. preparation artifact

Purpose: hold the quantum preparation output for a subtree.

Required fields:
- schemaVersion
- artifactType = preparation
- artifactId
- subtreeId
- rootGateId
- topologyClass
- clQuboEncoding
- variableMap
- qaoaRecipe
- backendEligibility
- statevectorVerificationResult
- createdAtUtc
- createdBy
- inputReferences
- sourceHashes
- notes

### 3. execution artifact

Purpose: normalize all provider outputs into one execution record.

Required fields:
- schemaVersion
- artifactType = execution
- artifactId
- subtreeId
- sourcePreparationArtifactId
- providerType
- providerName
- backendName
- executionMode
- jobIdOrRunId
- status
- shots
- submittedAtUtc
- completedAtUtc
- rawCounts
- createdAtUtc
- createdBy
- inputReferences
- sourceHashes
- notes

Allowed providerType values:
- simulator
- emulator
- real_hardware

### 4. recovery artifact

Purpose: hold MCS recovery results from quantum execution data.

Required fields:
- schemaVersion
- artifactType = recovery
- artifactId
- subtreeId
- sourceExecutionArtifactId
- classicalReferenceMcs
- tier1Result
- tier2Result
- tier3Result
- tier4NearMissAdvisory
- primaryMode
- requiresOperatorAttention
- semanticParityResult
- createdAtUtc
- createdBy
- inputReferences
- sourceHashes
- notes

### 5. importance artifact

Purpose: compare quantum derived PRA measures against classical baselines.

Required fields:
- schemaVersion
- artifactType = importance
- artifactId
- subtreeId
- sourceRecoveryArtifactId
- topologyClass
- recoveryMode
- requiresOperatorAttention
- quantumMeasures
- classicalMeasures
- agreementStatistics
- boundednessStatement
- createdAtUtc
- createdBy
- inputReferences
- sourceHashes
- notes

### 6. provenance manifest

Purpose: record the traceability chain for each workflow instance.

Required fields:
- schemaVersion
- artifactType = provenance_manifest
- artifactId
- workflowInstanceId
- relatedArtifactIds
- scriptOrPackageVersions
- timestamps
- sourceHashes
- acceptanceGateResults
- notes

## Persistence rules

1. Filesystem JSON artifacts are authoritative.
2. Database records are derived convenience views for API and UI use.
3. Database records must reference their authoritative filesystem artifact.
4. Artifacts must be versioned, not overwritten in place.

## Versioning rules

1. New outputs create a new artifactId and new timestamped artifact file.
2. Existing authoritative artifacts are not overwritten.
3. Any breaking schema change must increment schemaVersion.
4. Any endpoint that writes artifacts must also write a provenance manifest.

## First pass service contract

### readiness
- POST /api/quantum/readiness/:subtreeId
- GET /api/quantum/readiness/:subtreeId

### preparation
- POST /api/quantum/prepare/:subtreeId
- GET /api/quantum/preparation/:subtreeId
- POST /api/quantum/verify/:subtreeId

### execution
- POST /api/quantum/execute/:subtreeId
- GET /api/quantum/execution/:jobId

### recovery
- POST /api/quantum/recovery/single
- POST /api/quantum/recovery/batch
- GET /api/quantum/recovery/result/:caseId

### importance
- POST /api/quantum/importance/:subtreeId
- GET /api/quantum/importance/:subtreeId

### artifacts
- GET /api/quantum/artifact/:artifactId
- GET /api/quantum/provenance/:workflowInstanceId

## Product rule

The OpenPRA quantum path must allow a practitioner to:

1. identify a quantum tractable subtree
2. prepare the subtree for quantum execution
3. choose simulator, emulator, or real hardware
4. execute through the selected provider
5. recover MCS in platform
6. compare against the classical baseline
7. inspect provenance
8. export an artifact bundle

## Boundary rule

Nothing in this contract creates a claim of quantum advantage, production readiness, or regulatory grade equivalence. Any such claim would require separate evidence and separate validation.
