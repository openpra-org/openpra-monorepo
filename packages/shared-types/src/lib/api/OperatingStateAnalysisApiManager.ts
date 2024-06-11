import { CustomColumn, OperatingState } from "../types/OperatingStates/types";
import { AuthService } from "./AuthService";

const API_ENDPOINT = "/api";
const OPERATING_STATES_ENDPOINT = `${API_ENDPOINT}/operating-state-analysis/operating-states`;

export class OperatingStateAnalysisApiManager {
  static async createOperatingState(data: OperatingState): Promise<OperatingState> {
    return this.post(`${OPERATING_STATES_ENDPOINT}`, data);
  }

  static async getAllOperatingStates(): Promise<OperatingState[]> {
    return this.get(`${OPERATING_STATES_ENDPOINT}`);
  }

  static async getOperatingStateById(id: string): Promise<OperatingState> {
    return this.get(`${OPERATING_STATES_ENDPOINT}/${id}`);
  }

  static async updateOperatingState(id: string, data: Partial<OperatingState>): Promise<OperatingState> {
    return this.put(`${OPERATING_STATES_ENDPOINT}/${id}`, data);
  }

  // static async deleteOperatingState(id: string): Promise<OperatingState> {
  //   return this.delete(`${OPERATING_STATES_ENDPOINT}/${id}`);
  // }
  static async deleteOperatingState(id: string): Promise<void> {
    const response = await fetch(`${OPERATING_STATES_ENDPOINT}/${id}`, {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${AuthService.getEncodedToken()}`,
      },
    });
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
  }

  private static async post(url: string, data: any): Promise<OperatingState> {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${AuthService.getEncodedToken()}`,
      },
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return await response.json();
  }
  static async addNewColumn(operatingStateId: number, CustomColumn: CustomColumn) {
    const response = await fetch(`${OPERATING_STATES_ENDPOINT}/columns/${operatingStateId}`, {
      method: "PUT",
      headers: {
        "Content-Type": "appslication/json",
        Authorization: `Bearer ${AuthService.getEncodedToken()}`,
      },
      body: JSON.stringify(CustomColumn),
    });

    if (!response.ok) {
      const message = `An error has occurred: ${response.status}`;
      throw new Error(message);
    }

    return await response.json(); // Assuming the server responds with the updated operating state
  }
  private static async get(url: string): Promise<any> {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${AuthService.getEncodedToken()}`,
      },
    });
    console.log(response);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response}`);
    }
    return await response.json();
  }

  private static async put(url: string, data: any): Promise<OperatingState> {
    const response = await fetch(url, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${AuthService.getEncodedToken()}`,
      },
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return await response.json();
  }
  static async getAllColumns() {
    const response = await fetch(`http://localhost:4200/api/operating-state-analysis/operating-states/columns`);
    if (!response.ok) {
      throw new Error("Failed to fetch columns");
    }
    return await response.json();
  }
  // private static async delete(url: string): Promise<OperatingState> {
  //   const response = await fetch(url, {
  //     method: "DELETE",
  //     headers: {
  //       "Content-Type": "application/json",
  //       Authorization: `Bearer ${AuthService.getEncodedToken()}`,
  //     },
  //   });
  //   if (!response.ok) {
  //     throw new Error(`HTTP error! status: ${response.status}`);
  //   }
  //   return await response.json();
  // }
}
