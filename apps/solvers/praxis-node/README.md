# PRAXIS Node addon

This package contains the NAPI-RS boundary between Node.js and the PRAXIS Rust
solver. Its only public functions are synchronous JSON operations:

- `validate(requestJson)` validates the versioned transport envelope.
- `execute(requestJson)` dispatches to the method-specific PRAXIS adapter.

Method-specific execution is introduced with the corresponding editor vertical
slices. Until an adapter is connected, `execute` returns the structured
`PRAXIS_ILLEGAL_OPERATION` response.

The Praetor Docker image builds the Linux GNU addon in its builder stage and
copies only `package.json`, the generated loader and declarations, and the
release `.node` binary into the runtime image.

The addon depends directly on PRAXIS. TensorBayes remains an internal PRAXIS
dependency and is not coupled to the Node boundary.

## JSON protocol

The current protocol version is `1.0.0`. A call carries the backend's typed
validate or execute request together with the immutable project-model snapshots
needed to resolve cross-model references:

```json
{
  "schemaVersion": "1.0.0",
  "request": {},
  "modelSnapshots": []
}
```

Successful computations use the corresponding versioned result envelope:

```json
{ "schemaVersion": "1.0.0", "result": {} }
```

Request-validation and PRAXIS failures use a stable error kind and code, while
retaining a human-readable message and structured details:

```json
{
  "schemaVersion": "1.0.0",
  "error": {
    "kind": "VALIDATION_ERROR",
    "code": "UNSUPPORTED_SCHEMA_VERSION",
    "message": "...",
    "details": {
      "expectedSchemaVersion": "1.0.0",
      "receivedSchemaVersion": "2.0.0"
    }
  }
}
```

## Development

```shell
pnpm --filter praxis-node build:debug
pnpm --filter praxis-node lint
pnpm --filter praxis-node test
```
