import * as math from "mathjs";

export class AgingModel {
  constructor() {}

  async update_failure_model(node: any): Promise<void> {
    if (!node.failure_model || !node.failure_model.aging_model) return;

    const agingType = node.failure_model.aging_model.type; // Corrected property name

    try {
      switch (agingType) {
        case "linear":
          await this.linear_aging(node);
          break;
        case "function":
          await this.function_based_aging_model(node);
          break;
        case "corrosion":
          await this.corrosion_aging(node.id, node.failure_model.aging_model); // Corrected property name
          break;
        case "fatigue":
          await this.fatigue_aging(node.id, node.failure_model.aging_model); // Corrected property name
          break;
        default:
          throw new Error("Unsupported aging type");
      }
    } catch (error) {
      console.error(`Error updating failure model: ${error}`);
      // Optionally, handle the error more gracefully
    }
  }


  private async linear_aging(node: any): Promise<void> {
    if (!node.failure_model ?.aging_model) {
      console.error('Node does not have an aging model');
      return;
    }

    const agingModel = node.failure_model .aging_model;
    let agingRate = agingModel.aging_rate || 0; // Default to 0 if not present

    // Fetch the node's aging time, defaulting to 0 if not present
    const time = node.failure_model ?.aging_model?.time || 0;

    try {
      // Check if aging_rate is a list or a single float
      if (Array.isArray(agingRate)) {
        // If aging_rate is an array, update each affected parameter by its respective rate
        const affectedParameters = agingModel.affected_parameters || [];
        for (let i = 0; i < affectedParameters.length; i++) {
          const parameter = affectedParameters[i];
          const rate = i < agingRate.length ? agingRate[i] : 0; // Use specific rate if available, else default to 0

          const currentValue = node.failure_model [parameter] || 0;
          const newValue = currentValue + rate * time;
          node.failure_model [parameter] = newValue;
        }
      } else {
        // If aging_rate is a single float, update the first affected parameter
        const affectedParameter = agingModel.affected_parameters?.[0]; // Assume at least one affected parameter exists
        if (affectedParameter) {
          const currentValue = node.failure_model [affectedParameter] || 0;
          const newValue = currentValue + agingRate * time;
          node.failure_model [affectedParameter] = newValue;
        }
      }
    } catch (error) {
      console.error(`Error while applying linear aging: ${error}`);
      // Handle or rethrow the error based on your application's error handling policy
      // For example, you could throw the error again if you want to propagate it to the caller
      throw error;
    }
  }

  async function_based_aging_model(node: any): Promise<void> {
    // Assuming failure_model and its sub-properties are optional, check accordingly
    if (!node.failure_model || !node.failure_model.aging_model) return;
    const aging_model = node.failure_model.aging_model;
    const aging_rates: number[] = aging_model.aging_rate || [];
    const function_str = aging_model.expression || "";
    const time = aging_model.time || 0;  // Directly use the node time, default to 0 if not present

    // Iterate over affected parameters and update them
    const affected_parameters: string[] = aging_model.affected_parameters || [];

    aging_rates.forEach((rate, index) => {
      const parameter = affected_parameters[index];
      if (parameter) {
        const current_value = node.failure_model[parameter] || 0;
        const new_value = this.evaluate_function(function_str, time, rate, current_value);
        if (new_value !== null) {  // Check if evaluation was successful
          node.failure_model[parameter] = new_value;
        }
      }
    });
  }

  private evaluate_function(function_str: string, time: number, aging_rate: number, affected_parameter: number): number | null {
    try {
      // Setup the scope for the mathjs evaluation
      const scope = { time, aging_rate, affected_parameter, math };
      const result = math.evaluate(function_str, scope);
      return result as number;
    } catch (e) {
      console.error(`Error evaluating function expression: ${e}`);
      throw new Error(`Evaluation failed: ${e}`);
    }
  }



  private async corrosion_aging(sscId: string, parameters: any): Promise<void> {
    // Placeholder
  }

  private async fatigue_aging(sscId: string, parameters: any): Promise<void> {
    // Placeholder
  }
}


