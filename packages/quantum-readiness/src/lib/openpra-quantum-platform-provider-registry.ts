export type OpenPraQuantumProviderId = "local_simulator" | "ibm_gate_hardware" | "dwave_annealer";

export type OpenPraQuantumProviderStatus = "available" | "dry_run_only" | "not_configured";

export interface OpenPraQuantumProviderCapability {
  providerId: OpenPraQuantumProviderId;
  displayName: string;
  backendFamily: "local_gate" | "ibm_gate" | "dwave_annealing";
  supportedMode: "local_validation" | "remote_hardware" | "remote_annealing";
  providerStatus: OpenPraQuantumProviderStatus;
  evidenceClass: "local_validation_evidence" | "platform_ibm_hardware_new" | "dry_run_evidence";
  liveExecutionAllowed: boolean;
  boundednessStatement: string;
}

export function getOpenPraQuantumProviderRegistry(): OpenPraQuantumProviderCapability[] {
  return [
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
  ];
}

export function getOpenPraQuantumProviderCapability(
  providerId: OpenPraQuantumProviderId,
): OpenPraQuantumProviderCapability | undefined {
  return getOpenPraQuantumProviderRegistry().find((provider) => provider.providerId === providerId);
}
