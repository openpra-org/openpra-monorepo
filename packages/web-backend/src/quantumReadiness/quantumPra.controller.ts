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
        boundednessStatement: "No quantum PRA review payload is currently available.",
      };
    }

    const data = JSON.parse(fs.readFileSync(path, "utf8"));

    return {
      status: "OK",
      data,
      boundednessStatement:
        "This endpoint exposes bounded quantum PRA review data only. It does not authorize production PRA quantification or comparative quantum performance claims.",
    };
  }
  @Get("providers")
  getProviders() {
    return {
      status: "OK",
      providers: [
        {
          providerId: "local_simulator",
          displayName: "Local simulator validation",
          backendFamily: "local_gate",
          supportedMode: "local_validation",
          providerStatus: "available",
          evidenceClass: "local_validation_evidence",
          liveExecutionAllowed: true,
          boundednessStatement: "Local simulator execution supports validation only. It is not hardware evidence.",
        },
        {
          providerId: "ibm_gate_hardware",
          displayName: "IBM gate based hardware",
          backendFamily: "ibm_gate",
          supportedMode: "remote_hardware",
          providerStatus: "available",
          evidenceClass: "platform_ibm_hardware_new",
          liveExecutionAllowed: true,
          boundednessStatement:
            "IBM execution may produce hardware evidence only when a real job is submitted, retrieved, and fully captured with provenance.",
        },
        {
          providerId: "dwave_annealer",
          displayName: "D Wave quantum annealer",
          backendFamily: "dwave_annealing",
          supportedMode: "remote_annealing",
          providerStatus: "dry_run_only",
          evidenceClass: "dry_run_evidence",
          liveExecutionAllowed: false,
          boundednessStatement:
            "D Wave support is provider ready but dry run only until account access, backend configuration, and live execution approval exist.",
        },
      ],
      boundednessStatement:
        "Provider registry exposes bounded execution options only. It does not authorize production PRA quantification or comparative quantum performance claims.",
    };
  }
}
