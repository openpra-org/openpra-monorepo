# OpenRC Node addon

This package is the NAPI-RS boundary between Node.js and the OpenRC consequence
engine in `../openrc`. It exports two synchronous functions. Each one takes a
JSON string and returns a JSON string.

`validate(requestJson)` reads the config and the weather text. It runs every
check that comes before the first dose calculation.

`execute(requestJson)` runs the case. It returns the console text and the results.

## Request

```json
{
  "schemaVersion": "1.0.0",
  "request": {
    "methodType": "RADIOLOGICAL_CONSEQUENCE",
    "configText": "[run]\ncase_name = example\n",
    "metFileText": "D,3.0,270\n"
  }
}
```

`configText` is the text of an OpenRC config file. The addon reads it with the
same code as the command-line program, so a config that runs there runs here.

`metFileText` is the text of the weather file. Send it when the config sets
`[meteorology] met_file`. Leave it out when the config describes a single trial.

## Response

A successful validation returns `scope`, `valid`, `caseName`, `mode`,
`geometry`, `nuclideCount`, `segmentCount` and `metRecordCount`.

A successful execution returns `methodType`, `console` and `results`. `results`
holds the keys and numbers of the results file that the command-line program
writes. `console` holds the lines that the command-line program prints, without
the lines that name files.

```json
{
  "schemaVersion": "1.0.0",
  "result": {
    "methodType": "RADIOLOGICAL_CONSEQUENCE",
    "console": "  case_name : example\n",
    "results": { "case_name": "example", "tede_sv": 0.0008076858265216514 }
  }
}
```

A failure returns `error` with `kind`, `code`, `message` and `details`.

A request that cannot be read has the kind `VALIDATION_ERROR`. Its code is
`INVALID_REQUEST_JSON`, `UNSUPPORTED_SCHEMA_VERSION`, `UNSUPPORTED_METHOD_TYPE`
or `INVALID_REQUEST`.

A case that the engine rejects has the kind `SOLVER_ERROR`. Its code starts with
`OPENRC_` and its message is the engine's own message. The codes are
`OPENRC_CONFIG_SYNTAX`, `OPENRC_MISSING_KEY`, `OPENRC_INVALID_VALUE`,
`OPENRC_FILE_NOT_FOUND`, `OPENRC_ZERO_DIVISION`, `OPENRC_OUT_OF_RANGE`,
`OPENRC_INVALID_TYPE`, `OPENRC_JSON`, `OPENRC_IO` and `OPENRC_PANIC`.

`require("openrc-node/protocol")` loads the response check, the worker heap
setting and the name of the deadline header without loading the native binary.

## Differences from the command-line program

The addon reads no file and writes no file. The dose coefficients and the decay
data that are compiled into the engine are used, as the engine always does. The
keys `[dcf] path`, `[decay] path`, `[outputs] write_csv` and
`[outputs] output_dir` must be present, but their values are not used.

Results are always returned. A case whose results cannot be built fails here,
even when `write_csv = false` lets the command-line program finish.

A number that is not finite comes back as `null`, because JSON cannot hold it.

A message about the config names it `'<string>'`, where the command-line
program names the file.

## PRAETOR

PRAETOR runs every OpenRC call as a queued job, the same way it runs PRAXIS.
The manager stores the request and puts the job id on the queue `openrc_jobs`.
An engine takes the job and runs the addon in a child process, so a time limit
or a cancellation can stop it. The engine adds the fingerprint of the binary to
the answer as `engine`, with the name `OPENRC`.

`POST /q/openrc/jobs` submits `{ operation, request, jobId, timeoutMs }`, where
`operation` is `execute` or `validate` and `request` is the request shown above.
`GET /q/openrc/jobs/:jobId` reports the state. `GET /q/openrc/jobs/:jobId/result`
returns the response. `DELETE /q/openrc/jobs/:jobId` cancels the job.

`POST /q/openrc/native/validate` and `POST /q/openrc/native/execute` submit a job
and wait for it. The header `x-openrc-deadline` sets a deadline in milliseconds
since the epoch.

The settings are the ones PRAXIS jobs use: `PRAETOR_WORKER_SLOTS`,
`PRAETOR_JOB_MAX_ATTEMPTS`, `PRAETOR_JOB_TIMEOUT_MS`, `PRAETOR_JOB_STALE_MS` and
`PRAETOR_NATIVE_HEAP_MB`. Each engine keeps its slots for OpenRC jobs apart from
its slots for PRAXIS jobs. The queue names come from the `MQ_OPENRC_JOB_*` and
`MQ_OPENRC_CANCEL_EXCHANGE_ID` keys and have defaults.

A job that fails outside the engine has the kind `EXECUTION_ERROR`. Its code is
`OPENRC_TIMEOUT`, `OPENRC_CANCELLED`, `OPENRC_PROCESS_EXITED`,
`OPENRC_WORKER_FAILURE`, `OPENRC_INVALID_RESPONSE` or one of the PRAETOR codes
`PRAETOR_WORKER_LOST`, `PRAETOR_WORKER_FAILURE`, `PRAETOR_INPUT_MISSING` and
`PRAETOR_NO_OUTPUT`.

`node test/http-consequence-smoke.mjs http://localhost:3000/q` runs every
reference case and the job routes against a running PRAETOR.

## Web backend

The web backend reaches the engine through PRAETOR only. Its pieces are in
`apps/backends/web-backend/src/rc-workbooks`.

`PraetorConsequenceClient` in `praetor-consequence.client.ts` submits a request
as an OpenRC job, polls its state and returns the response. It cancels the job
when the HTTP request that asked for it is cancelled. `PRAETOR_URL` gives the
address of PRAETOR.

`adaptRcCaseRequests` in `openrc-case-adapters.ts` writes the requests for one
saved RC case, one consequence metric, one receptor and the weather trials of
the case. The metric must be an individual dose at the boundary or by distance,
without protective actions. The receptor is on the plume centerline. Each
weather trial is one weather row. Release times count from accident start, and
the integration time is the window plus the start of the first release.

The engine releases and deposits nuclides by its own ten chemical groups. When
nuclides of one engine group have different fractions or velocities in the
case, the adapter writes more than one request, and the doses of the requests
add up trial by trial.

The adapter follows the engine wherever the engine has its own behaviour, and
it names each such point in a note. Nuclides without an engine group are left
out. Noble gases are never deposited, whatever velocity the case gives them. A
window that starts at plume arrival is counted from release onset. Stability
class G is passed on, and the engine runs it as class D. Every weather trial is
equally likely, whatever its probability. Rain and boundary weather are not
used.

`adaptOpenRcTrialDoses` adds the doses of the requests in sievert.
`adaptOpenRcStatistics` gives percentiles by the engine's own rule, which
interpolates between the sorted doses of equally likely trials. The mean and
the chance of exceeding a dose are taken over the same equally likely trials.

`RcConsequenceRunsService` in `rc-consequence-runs.service.ts` runs one saved
input snapshot and one metric as an OpenRC run. A dose at the EAB takes one
receptor distance. A dose by distance takes up to 100 distances. Each distance
and each request of the adapter is one PRAETOR job. The service follows the
jobs, keeps their progress, and adds the doses up when every job has ended. A
run stops its other jobs when one job fails or is cancelled. Runs are kept in
the collection `rc_consequence_runs`, at most 200 for a workbook.

The routes are under `/api/rc-workbooks/:id/consequence-runs`.
`GET setup?snapshotId=` tells which metrics of a snapshot OpenRC can run, and
gives the receptor distances and the receptor height of its site. `POST` starts
a run from `{ snapshotId, metricId, distancesMetres, heightMetres }`. `GET`
lists the runs. `GET :runId` gives one run with its statistics.
`GET :runId/trials` pages the dose of each weather trial, ten at a time.
`GET :runId/files/input` and `GET :runId/files/output` page the text sent to
the engine and the text it returned. `POST :runId/cancel`, `POST :runId/remove`
and `POST :runId/record` cancel a run, remove it, and record it.

A recorded run is a category result with `valueSource: "calculated"`. It names
the run, the fingerprint of every engine build that served its jobs, the
receptor and the number of weather trials. A dose by distance keeps the statistics of every distance. The input
and the output of the run are stored with the result as its output file.

## RC workbook

Step 08 of the RC workbook has the tab OpenRC runs under Case inputs and
outputs. Its code is in
`apps/frontends/web-frontend/src/rc-workbooks/rcConsequenceRuns.tsx`. The
analyst picks an input snapshot and a metric that OpenRC can run. The receptor
distance is linked to the site boundary distance or to the Step 02 distances,
or it is typed. The receptor height is linked to the Step 02 receptor height,
or it is typed. The job status on the card shows the running jobs and cancels
them. A finished run shows the statistics the metric asks for, the dose of
each weather trial, and the text sent to the engine and returned by it. A run
of one weather trial also shows the dose of each nuclide. Record as category
result makes the run the result of its release category, and the mean goes to
every event sequence family of that category.

## Build

```bash
pnpm nx run solvers-openrc-node:build
```

The build writes `index.js`, `index.d.ts` and the binary for the current
platform. The binary holds the dose coefficients and the decay data, so it is
about 20 MB.

## Test

```bash
pnpm nx run solvers-openrc-node:test
```

```bash
cargo test --lib
```

The Node tests run every case of the reference set in
`../openrc/tests/data/python_reference` through the addon. They compare the
results, the console text and the errors with the output of the Python engine.
Set `OPENRC_EXACT=1` to require bit-identical numbers. Without it a relative
difference of 1e-10 is allowed, so another platform's math library does not
break the tests.

`npm run test:windows` and `npm run test:linux` load the platform binary
directly.
