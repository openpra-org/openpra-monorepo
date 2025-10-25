import * as fs from "fs/promises";
import * as path from "path";
import { parseSchema } from "json-schema-to-zod";
import { format } from "prettier";
import { FindJSONFiles } from "./generate-types";

/**
 * Generates Zod files from JSON schema files.
 *
 * @param jsonFiles - An array of paths to JSON files.
 * @param rootDir - The root directory where the .d.ts files will be placed, maintaining the relative paths.
 */
export async function GenerateZodType(jsonFiles: string[], rootDir: string): Promise<void> {
  for (const jsonFile of jsonFiles) {
    const dtsRelativePath = rootDir.concat("/", jsonFile.replace(".json", ".ts"));
    // Construct the full path for the .d.ts file under the specified root directory
    const dtsFile = path.join(rootDir, dtsRelativePath);
    try {
      // Ensure the directory exists where the .d.ts file will be written
      await fs.mkdir(path.dirname(dtsFile), { recursive: true });

      const data = await fs.readFile(jsonFile, "utf-8");
      const fileName = jsonFile.split("/");
      const moduleName =
        fileName[fileName.length - 1].split("-")[0].charAt(0).toUpperCase() +
        fileName[fileName.length - 1].split("-")[0].slice(1) +
        "Schema";
      // Generate ZOD Files
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
      const ts = parseSchema(JSON.parse(data), {
        module: "esm",
        name: moduleName,
        path: [],
        seen: new Map(),
      });
      const code = `
                    /* Auto generated file DO NOT UPDATE.\nTo change the Zod Dto update the relevant schema file\n */

                    import { z } from "nestjs-zod/z";
                    import { createZodDto } from "nestjs-zod";

                    const ${moduleName} = ${ts};

                    class ${moduleName}Dto extends createZodDto(${moduleName}) {}

                    export { ${moduleName}Dto }

                    `;
      const formattedTs = await format(code, { parser: "typescript" });
      // Write .d.ts file asynchronously
      await fs.writeFile(dtsFile, formattedTs);
    } catch (_error) {
      /* empty */
    }
  }
}

/**
 * Orchestrates the generation of zod schema files (.ts) files from JSON schema files found in a specified directory.
 *
 * @returns A promise that resolves when all zod .ts files have been generated or rejects if an error occurs.
 */
export async function GenerateZod(inputDirectory: string, outputDirectory: string): Promise<void> {
  try {
    // Find all JSON files in the starting directory
    const jsonFiles = await FindJSONFiles(inputDirectory);
    // Generate TypeScript declaration files from the found JSON files
    await GenerateZodType(jsonFiles, outputDirectory);
  } catch (_error) {
    /*empty*/
  }
}

// Retrieve the command-line arguments
const args = process.argv; // Remove the first two elements

// Check if the directory argument is provided
if (args.length === 4 && args[1].endsWith("generate-zod-types.js")) {
  void GenerateZod(args[2], args[3]).then();
}
