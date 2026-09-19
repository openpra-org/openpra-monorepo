# Model payload storage

SY, ES and ESQ workbooks and method-run history use MinIO for payload fields
at least 1 MiB in JSON or BSON. Smaller fields remain inline. MongoDB retains
workbook identities, revisions, permissions, run status and snapshot identities.
Solver inputs and calculations are unchanged.

Use the existing `MINIO_ENDPOINT`, `MINIO_PORT`, `MINIO_USE_SSL`,
`MINIO_ACCESS_KEY` and `MINIO_SECRET_KEY` settings. The optional
`MINIO_MODEL_PAYLOADS_BUCKET` defaults to `openpra-model-payloads`. The backend
creates that private bucket on its first large save. Back up this bucket together
with MongoDB; neither backup alone contains the complete model history.

Objects contain gzip-compressed JSON, including signed zero. References include
the uncompressed length and SHA-256 checksum, verified on every read. Uploads
finish before the atomic MongoDB revision/status update. A failed upload cannot
advance a workbook revision. Missing or corrupt objects produce HTTP 503.

Existing inline records remain readable and move on their next save without
changing their numerical values. No startup migration rewrites user data.
Complete reads, lean reads, create, insertMany, save, replacements and whole-field
updates pass through one schema storage boundary. Partial-document saves, dotted
payload updates, update pipelines and bulkWrite are rejected. Direct collection
operations are reserved for maintenance and deliberately bypass this boundary.
History listings read metadata without downloading full snapshots or results.

Content-addressed objects can be shared by multiple workbooks and historical runs.
Objects are retained after edits, conflicts and deletions; deleting one workbook
must never remove another record's snapshot. Do not apply bucket expiry rules.
Reclaim unreferenced objects only during maintenance with all writers stopped,
after checking references in all four collections (`sy_workbooks`, `es_workbooks`,
`esq_workbooks`, `method_analysis_runs`) and preserving objects needed by backups.

The web backend and Praetor accept JSON bodies up to 256 MiB by default; override
with `HTTP_JSON_LIMIT`. The shipped API nginx proxy uses the same 256 MiB limit.
Change the proxy limit too if increasing it. These are transport limits, not
solver size guarantees.
