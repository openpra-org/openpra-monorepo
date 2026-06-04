import fs from "fs";
import path from "path";
import { promises as promise_fs } from "fs";
import { tmpdir } from "os";
import { spawn } from "child_process";
import { Injectable } from "@nestjs/common";
import type { CommandLineOptions } from "shared-types";
import type { QuantifyRequest } from "shared-types";
import type { BinaryQuantifyReport } from "shared-types";
@Injectable()
export class QuantifyService {
  public async usingScramBinary(modelsWithConfig: QuantifyRequest): Promise<BinaryQuantifyReport> {
    const { models, ...options } = modelsWithConfig;
    const modelFilePaths = await this.writeModelFilesBase64(models);
    const optionsString = this.constructCommandLineOptions(options);
    const reportFilePath = await this.executeScramCommand(optionsString, modelFilePaths);
    const reportContent: string = await this.readReportFile(reportFilePath);
    return {
      configuration: modelsWithConfig,
      results: [reportContent],
    };
  }
  public async writeModelFilesBase64(models: string[]): Promise<string[]> {
    const tempDir = await promise_fs.mkdtemp(path.join(tmpdir(), "models-"));
    const fileWrites = models.map(async (model, index) => {
      const decodedModel = Buffer.from(model, "base64").toString("utf8");
      const filePath = path.join(tempDir, `model-${index}.xml`);
      await promise_fs.writeFile(filePath, decodedModel, "utf8");
      return filePath;
    });
    return Promise.all(fileWrites);
  }
  public constructCommandLineOptions(options: CommandLineOptions): string {
    const flags = Object.entries(options).map(([key, value]) => {
      const flag = key.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
      if (typeof value === "boolean") {
        return value ? `--${flag}` : "";
      } else {
        return `--${flag} ${value}`;
      }
    });
    return flags.filter(Boolean).join(" ");
  }
  public async executeScramCommand(optionsString: string, modelFilePaths: string[]): Promise<string> {
    const reportFilePath = path.join(process.cwd(), "report.xml");
    const errorLogPath = path.join(process.cwd(), "error.log");
    const args = optionsString.split(" ").concat(modelFilePaths);
    return new Promise((resolve, reject) => {
      const scramProcess = spawn("scram-cli", args, { shell: true });
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
  public async readReportFile(filePath: string): Promise<string> {
    try {
      return await promise_fs.readFile(filePath, { encoding: "utf8" });
    } catch {
      throw new Error(`Failed to read report file at ${filePath}.`);
    }
  }
}
