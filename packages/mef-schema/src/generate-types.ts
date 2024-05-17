import * as fs from "fs/promises";
import * as path from "path";
import { compileFromFile } from "json-schema-to-typescript";

/**
 * Recursively searches for files with a specified extension within a given directory.
 *
 * @param extension - The file extension to search for.
 * @param dir - The directory to start the search from.
 * @param fileList - An array to accumulate the paths of found files. Defaults to an empty array.
 * @returns A promise that resolves to an array of strings, each representing a file path that ends with the specified extension.
 */
export async function FindFilesWithExtension(
  extension: string,
  dir: string,
  fileList: string[] = [],
): Promise<string[]> {
  const files = await fs.readdir(dir);

  for (const file of files) {
    const filePath = path.join(dir, file);
    const stat = await fs.stat(filePath);

    if (stat.isDirectory()) {
      await FindFilesWithExtension(extension, filePath, fileList); // Recurse into subdirectories
    } else if (filePath.endsWith(extension)) {
      fileList.push(filePath); // Add file to list if it matches the extension
    }
  }
  return fileList;
}

/**
 * Finds all JSON files within a specified directory and its subdirectories.
 *
 * @param dir - The directory to start the search from.
 * @param fileList - An array to accumulate the paths of found JSON files. Defaults to an empty array.
 * @returns A promise that resolves to an array of strings, each representing a path to a JSON file.
 */
export async function FindJSONFiles(dir: string, fileList: string[] = []): Promise<string[]> {
  return FindFilesWithExtension(".json", dir, fileList);
}

/**
 * Generates TypeScript declaration (.d.ts) files from JSON schema files.
 *
 * @param jsonFiles - An array of paths to JSON files.
 * @param rootDir - The root directory where the .d.ts files will be placed, maintaining the relative paths.
 */
export async function GenerateTypescript(jsonFiles: string[], rootDir: string): Promise<void> {
  for (const jsonFile of jsonFiles) {
    const dtsRelativePath = rootDir.concat("/", jsonFile.replace(".json", ".d.ts"));
    // Construct the full path for the .d.ts file under the specified root directory
    const dtsFile = path.join(rootDir, dtsRelativePath);
    try {
      // Ensure the directory exists where the .d.ts file will be written
      await fs.mkdir(path.dirname(dtsFile), { recursive: true });
      // Generate TypeScript definition
      const ts = await compileFromFile(jsonFile, {
        bannerComment: "",
        strictIndexSignatures: true,
        additionalProperties: false,
        style: {
          bracketSpacing: true,
          printWidth: 120,
          singleQuote: false,
          singleAttributePerLine: true,
          endOfLine: "lf",
        },
      });
      // Write .d.ts file asynchronously
      await fs.writeFile(dtsFile, ts);
    } catch (error) {
      /* empty */
    }
  }
}

/**
 * Orchestrates the generation of TypeScript declaration (.d.ts) files from JSON schema files found in a specified directory.
 *
 * @returns A promise that resolves when all .d.ts files have been generated or rejects if an error occurs.
 */
export async function Generate(inputDirectory: string, outputDirectory: string): Promise<void> {
  try {
    // Find all JSON files in the starting directory
    const jsonFiles = await FindJSONFiles(inputDirectory);
    // Generate TypeScript declaration files from the found JSON files
    await GenerateTypescript(jsonFiles, outputDirectory);
  } catch (error) {
    /*empty*/
  }
}

// Retrieve the command-line arguments
const args = process.argv; // Remove the first two elements

// Check if the directory argument is provided
if (args.length === 4) {
  void Generate(args[2], args[3]).then();
}
