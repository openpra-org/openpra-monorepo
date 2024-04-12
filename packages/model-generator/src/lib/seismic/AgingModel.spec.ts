import { AgingModel } from "./AgingModel";

describe("AgingModel", () => {
  let agingModel: AgingModel;

  beforeEach(() => {
    agingModel = new AgingModel();
  });

  test("Linear aging should update failure model parameters correctly", async () => {
    // Define the node JSON object
    const nodeJson = {
      "_id": { "$oid": "651a0157ff3b4433457db73d" },
      "room_id": { "$oid": "65026bcf7358e5227605e79b" },
      "failure_model": {
        "distribution_type": "SL",
        "beta_r_uncertainty": 0.2,
        "beta_u_uncertainty": 0.05,
        "pga": "",
        "median_seismic_acceleration": 2,
        "amplification": 1.2,
        "aging_model": {
          "type": "linear",
          "aging_rate": [-0.006, -0.002],
          "affected_parameters": ["median_seismic_acceleration", "beta_r_uncertainty"],
          "time": 15
        }
      },
      "description": "Fire Source 1",
      "name": "FR-SRC-1",
      "type": "SBE",
      "logic_type": "BE",
      "ssc_id": { "$oid": "656fee14026b2a847fc7a64c" },
      "elevation": 3.8,
      "correlation_set": "SIF-[room_id]"
    };

    // Call the update_failure_model method
    await agingModel.update_failure_model(nodeJson);

    // Check if failure model parameters are updated correctly
    expect(nodeJson.failure_model.median_seismic_acceleration).toBeCloseTo(1.91, 2); // Expected value: 2 - 0.006 * 15 = 1.91
    expect(nodeJson.failure_model.beta_r_uncertainty).toBeCloseTo(0.17, 2); // Expected value: 0.2 - 0.002 * 15 = 0.11
  });

  // Add more test cases for other aging types and scenarios as needed
  test("Function-based aging should update failure model parameters correctly", async () => {
    // Define the node JSON object based on your JSON input for function-based aging
    const nodeJson = {
      "_id": { "$oid": "651a006dff3b4433457db733" },
      "room_id": { "$oid": "65026bcc7358e5227605e791" },
      "failure_model": {
        "distribution_type": "SL",
        "median_seismic_acceleration": 1.8,
        "beta_r_uncertainty": 0.3,
        "beta_u_uncertainty": 0.15,
        "pga": "",
        "amplification": 1,
        "aging_model": {
          "type": "function",
          "expression": "affected_parameter * math.exp(aging_rate * (time-5))",
          "aging_rate": [-0.009, -0.008],
          "affected_parameters": ["median_seismic_acceleration", "beta_r_uncertainty"],
          "time": 40
        }
      },
      "description": "Fire Source 2",
      "name": "FR-SRC-2",
      "type": "SBE",
      "logic_type": "BE",
      "ssc_id": { "$oid": "656fedae026b2a847fc7a64b" },
      "elevation": 2.1,
      "correlation_set": "SIF-[room_id]"
    };

    // Call the update_failure_model method to apply aging
    await agingModel.update_failure_model(nodeJson);

    // Expected calculations:
    // median_seismic_acceleration updated: 1.8 * exp(-0.009 * (40-5)) ≈ 1.3136
    // beta_r_uncertainty updated: 0.3 * exp(-0.008 * (40-5)) ≈ 0.259389

    // Verify if failure model parameters are updated correctly (use appropriate precision)
    expect(nodeJson.failure_model.median_seismic_acceleration).toBeCloseTo(1.31361997368, 3);
    expect(nodeJson.failure_model.beta_r_uncertainty).toBeCloseTo(0.22673512243, 2); // Note: Adjust precision as needed based on your function's implementation and rounding behavior
    // Optionally, you might want to check other parameters remained unchanged if needed
    expect(nodeJson.failure_model.beta_u_uncertainty).toBe(0.15);
    expect(nodeJson.failure_model.pga).toBe("");
    expect(nodeJson.failure_model.amplification).toBe(1);
  });
});




