import { Injectable } from "@nestjs/common";
import fs from "fs";
import path from "path";
import { promises as promise_fs } from "fs";
import { tmpdir } from "os";
import { spawn } from "child_process";
import { QuantifyModel } from "scram-node"
import { BinaryQuantifyReport } from "shared-types/src/openpra-mef/util/quantify-report";
import { CommandLineOptions, NodeQuantRequest } from "shared-types/src/openpra-mef/util/quantify-request";
import { QuantifyRequest } from "shared-types/src/openpra-mef/util/quantify-request";
import { Report } from "shared-types/src/openpra-mef/util/report";

@Injectable()
export class QuantifyService {
  public async quantifyModel(scramNodeModel: NodeQuantRequest): Promise<Report> {
    return QuantifyModel(scramNodeModel.settings, scramNodeModel.model);
  }

  // call shell commands from here.
  // 1. write the model data xmls to a set of files (at-least 1 element in set)
  // 2. parse CommandLineOptions from QuantifyRequest as a command-line options string for scram
  // 3. assuming scram exists in the PATH, or assuming we have the PATH variable for scram,
  // 4. run the scram shell command with the given options string, and path for the XML file set.
  // 5. alternatively, if scram accepts model file content over STDIN, pipe that string-encoded data directly.
  // 6. pipe the output from the shell command (STDOUT goes to a report.xml file) (STDERR gets redirected to an error.log)
  // file.
  // here are the command line options for scram.
  /**
   * ./scram
   * No input or configuration file is given.
   *
   * Usage:    scram [options] input-files...
   *
   * Options:
   *   --help                   Display this help message
   *   --version                Display version information
   *   --project path           Project file with analysis configurations
   *   --allow-extern           **UNSAFE** Allow external libraries
   *   --validate               Validate input files without analysis
   *   --bdd                    Perform qualitative analysis with BDD
   *   --zbdd                   Perform qualitative analysis with ZBDD
   *   --mocus                  Perform qualitative analysis with MOCUS
   *   --prime-implicants       Calculate prime implicants
   *   --probability            Perform probability analysis
   *   --importance             Perform importance analysis
   *   --uncertainty            Perform uncertainty analysis
   *   --ccf                    Perform common-cause failure analysis
   *   --sil                    Compute the Safety Integrity Level metrics
   *   --rare-event             Use the rare event approximation
   *   --mcub                   Use the MCUB approximation
   *   -l [ --limit-order ] int Upper limit for the product order
   *   --cut-off double         Cut-off probability for products
   *   --mission-time double    System mission time in hours
   *   --time-step double       Time step in hours for probability analysis
   *   --num-trials int         Number of trials for Monte Carlo simulations
   *   --num-quantiles int      Number of quantiles for distributions
   *   --num-bins int           Number of bins for histograms
   *   --seed int               Seed for the pseudo-random number generator
   *   -o [ --output ] path     Output file for reports
   *   --no-indent              Omit indentation whitespace in output XML
   *   --verbosity int          Set log verbosity
   */
  /**
   * Performs the quantification process by executing the scram command with the provided models and options.
   *
   * @param modelsWithConfig - The quantification request containing models and command-line options.
   * @returns A promise that resolves with the quantification report.
   */
  public async usingScramBinary(modelsWithConfig: QuantifyRequest): Promise<BinaryQuantifyReport> {
    const { models, ...options } = modelsWithConfig;
    // Step 1: Write the model data XMLs to a set of files
    const modelFilePaths = await this.writeModelFilesBase64(models);

    // Step 2: Parse CommandLineOptions from QuantifyRequest as a command-line options string for scram
    const optionsString = this.constructCommandLineOptions(options);

    // Step 3: Execute the scram shell command with the given options string and path for the XML file set
    const reportFilePath = await this.executeScramCommand(optionsString, modelFilePaths);

    // Step 4: Read the content of the generated report file
    const reportContent: string = await this.readReportFile(reportFilePath);

    // Step 5: Construct and return the QuantifyReport object
    return {
      configuration: modelsWithConfig, // Optionally include the configuration used for the analysis
      results: [reportContent], // Assuming the report content is directly usable
    };
  }

  public async writeModelFilesBase64(models: string[]): Promise<string[]> {
    // Create a unique temporary directory for our model files
    const tempDir = await promise_fs.mkdtemp(path.join(tmpdir(), "models-"));

    // Write each model to a separate file within the temporary directory
    const fileWrites = models.map(async (model, index) => {
      // Decode the base64 model string
      const decodedModel = Buffer.from(model, "base64").toString("utf8");

      const filePath = path.join(tempDir, `model-${index}.xml`);
      await promise_fs.writeFile(filePath, decodedModel, "utf8");
      return filePath;
    });

    // Wait for all files to be written and return their paths
    return Promise.all(fileWrites);
  }

  /**
   * Constructs a command-line options string from the given CommandLineOptions object.
   * This method transforms the options object into a string of command-line flags
   * suitable for the scram command. Boolean flags are included directly if true,
   * while options with values are included with their respective values.
   *
   * @param options - The command-line options object.
   * @returns string - The constructed command-line options string.
   */
  public constructCommandLineOptions(options: CommandLineOptions): string {
    const flags = Object.entries(options).map(([key, value]) => {
      // Transform camelCase keys to kebab-case for command-line flags
      const flag = key.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);

      if (typeof value === "boolean") {
        // For boolean flags, just return the flag if true; otherwise, return an empty string
        return value ? `--${flag}` : "";
      } else {
        // For options with values, return the flag followed by its value
        return `--${flag} ${value}`;
      }
    });

    // Filter out any empty strings and join the flags with spaces
    return flags.filter(Boolean).join(" ");
  }

  /**
   * Executes the scram command with the given options and model file paths.
   * Captures the output and errors, writing them to respective files.
   *
   * @param optionsString - The command-line options as a string.
   * @param modelFilePaths - An array of paths to the model files.
   * @returns A promise that resolves with the path to the output report file.
   */
  public async executeScramCommand(optionsString: string, modelFilePaths: string[]): Promise<string> {
    // Define paths for the output report and error log
    const reportFilePath = path.join(process.cwd(), "report.xml");
    const errorLogPath = path.join(process.cwd(), "error.log");

    // Prepare the scram command arguments
    const args = optionsString.split(" ").concat(modelFilePaths);

    return new Promise((resolve, reject) => {
      const scramProcess = spawn("scram-cli", args, { shell: true });

      // Stream for capturing standard error
      const errorStream = fs.createWriteStream(errorLogPath);
      const outputStream = fs.createWriteStream(reportFilePath);

      scramProcess.stderr.pipe(errorStream);
      scramProcess.stdout.pipe(outputStream);

      scramProcess.on("close", (code) => {
        errorStream.close();

        if (code === 0) {
          resolve(reportFilePath);
        } else {
          reject(new Error(`Scram command failed with exit code ${code}. See error log at: ${errorLogPath}`));
        }
      });

      scramProcess.on("error", (error) => {
        reject(new Error(`Failed to start scram command: ${error.message}`));
      });
    });
  }

  /*
   * Reads the content of a report file.
   *
   * @param filePath - The path to the report file.
   * @returns A promise that resolves with the content of the report file as a string.
   * @throws {Error} If the file cannot be read.
   */
  public async readReportFile(filePath: string): Promise<string> {
    try {
      return await promise_fs.readFile(filePath, { encoding: "utf8" });
    } catch (error) {
      throw new Error(`Failed to read report file at ${filePath}.`);
    }
  }
}
