# mef-schema

## Generate TypeScript Types

To build the types/interfaces and place them in the shared-types package folder, run:
```shell
nx run mef-schema:generate-types
```

## Generate ZOD Schemas

Naming Convention: If the name of the json schema is xyz-schema.json then the name of the Zod Schema class would be XyzDto

Run `nx run mef-schema:generate-zod` to build the types/interfaces and place them in the shared-types package folder.
