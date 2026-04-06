# PROVENANCE LOG v1

## Purpose

This log records major authorship, design, development, and testing milestones for the OpenPRA Quantum Readiness Contribution.

## Entry format

Each entry should record:
1. date
2. milestone
3. human-authored contribution
4. evidence
5. notes

---

## 2026 04 05
Milestone:
Project direction frozen as OpenPRA Quantum Readiness Module v1

Human-authored contribution:
Devin Peters selected the initial contribution scope and approved readiness analysis as the first target rather than full hardware execution.

Evidence:
Conversation planning record
Repository workspace creation
OpenPRA monorepo clone

Notes:
This established the first contribution boundary.

## 2026 04 05
Milestone:
Quantum-readiness package created

Human-authored contribution:
Devin Peters executed package creation, reviewed package structure, approved type design, and accepted the first package skeleton into the repo.

Evidence:
Repository file creation history
Shell command history
Git diff and future commit history

Notes:
This created the standalone library package.

## 2026 04 05
Milestone:
core readiness logic validated

Human-authored contribution:
Devin Peters reviewed the readiness model, accepted the normalized fault tree contract, and executed tests, build, lint, and smoke runs.

Evidence:
Test outputs
Build outputs
Lint outputs
Smoke runner artifacts

Notes:
This confirmed deterministic readiness behavior.

## 2026 04 05
Milestone:
OpenPRA graph adapter and heuristics validated

Human-authored contribution:
Devin Peters approved graph-based adaptation as the correct integration seam and accepted conservative heuristics for likely OpenPRA node interpretation.

Evidence:
Spec results
Smoke runner outputs
Repository history

Notes:
This aligned the package with the actual OpenPRA graph structure.

## 2026 04 05
Milestone:
backend service and controller integration completed

Human-authored contribution:
Devin Peters approved the backend service layer, controller routes, the ID-retrieval path, and the route-level testing strategy.

Evidence:
Backend service specs
Controller specs
HTTP specs
Lint outputs

Notes:
This established the first end-to-end, backend-accessible feature slice.

## 2026 04 05
Milestone:
authorship and copyright preparation started

Human-authored contribution:
Devin Peters initiated authorship documentation, provenance documentation, and registration planning for software and written materials.

Evidence:
AUTHORS_AND_ATTRIBUTION_v1.md
HUMAN_AUTHORSHIP_AND_AI_USE_STATEMENT_v1.md
COPYRIGHT_AND_DISCLOSURE_WORKFLOW_v1.md
Repository history

Notes:
This milestone is intended to preserve clear authorship attribution before external submission.

---

## Ongoing instruction

Add a new dated entry after every major milestone.
