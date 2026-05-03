import { Controller, Get } from "@nestjs/common";
import * as fs from "fs";

@Controller("quantum-pra")
export class QuantumPraController {
  @Get("latest")
  getLatest() {
    const path =
      "/mnt/storage_array/projects/OPENPRA_DEV_v1/openpra-monorepo/_work/openpra_quantum_platform_phase1/VALIDATION/WS21_END_TO_END_SINGLE_CASE_v1/stdout.json";

    if (!fs.existsSync(path)) {
      return {
        status: "NO_DATA",
        message: "No quantum PRA output found",
      };
    }

    const data = JSON.parse(fs.readFileSync(path, "utf8"));

    return {
      status: "OK",
      data,
    };
  }
}
