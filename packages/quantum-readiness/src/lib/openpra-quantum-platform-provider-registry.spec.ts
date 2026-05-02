import {
  getOpenPraQuantumProviderCapability,
  getOpenPraQuantumProviderRegistry,
} from "./openpra-quantum-platform-provider-registry";

describe("OpenPRA quantum provider registry", () => {
  it("exposes three provider paths", () => {
    const providers = getOpenPraQuantumProviderRegistry();
    expect(providers.map((p) => p.providerId)).toEqual(["local_simulator", "ibm_gate_hardware", "dwave_annealer"]);
  });

  it("marks IBM hardware as live capable", () => {
    const ibm = getOpenPraQuantumProviderCapability("ibm_gate_hardware");
    expect(ibm?.liveExecutionAllowed).toBe(true);
    expect(ibm?.evidenceClass).toBe("platform_ibm_hardware_new");
  });

  it("marks D Wave as dry run only", () => {
    const dwave = getOpenPraQuantumProviderCapability("dwave_annealer");
    expect(dwave?.providerStatus).toBe("dry_run_only");
    expect(dwave?.liveExecutionAllowed).toBe(false);
  });

  it("marks local simulator as non hardware validation", () => {
    const local = getOpenPraQuantumProviderCapability("local_simulator");
    expect(local?.evidenceClass).toBe("local_validation_evidence");
  });
});
