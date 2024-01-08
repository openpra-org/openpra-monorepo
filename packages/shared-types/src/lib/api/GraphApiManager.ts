import {FaultTreeGraph} from "../types/faultTreeGraph/Graph";
import AuthService from "./AuthService";
// import { Logger } from '@nestjs/common';


const API_ENDPOINT = "/api";
const GRAPH_ENDPOINT = `${API_ENDPOINT}/nested-models`;
const FAULT_TREE_GRAPH_ENDPOINT = `${GRAPH_ENDPOINT}/fault-tree-graph`;

export default class GraphApiManager {

  static callSnackbar(status: any, res: any, override: any) {
    //TODO::
  }

  static defaultSuccessCallback(res: any, override: any) {
    try {
      const { showSuccess } = override;
      if (showSuccess) {
        this.callSnackbar("success", res, override);
      }
    } catch {}
    return res;
  }

  static defaultFailCallback(res: any, override: any) {
    try {
      const { showFailure } = override;
      if (showFailure) {
        this.callSnackbar("error", res, override);
      }
    } catch {}
    return res;
  }

  static async storeFaultTree(
    data: FaultTreeGraph,
    override: any = null,
    onSuccessCallback = this.defaultSuccessCallback,
    onFailCallback = this.defaultFailCallback,
  ): Promise<FaultTreeGraph> {
    // Logger.log("test");
    return await fetch(`${FAULT_TREE_GRAPH_ENDPOINT}`, {
      method: "POST",
      cache: "no-cache",
      headers: {
        "Content-Type": "application/json",
        Authorization: `JWT ${AuthService.getEncodedToken()}`,
      },
      body: JSON.stringify(data),
    })
      .then((res) =>
        res.ok
          ? onSuccessCallback(res, override)
          : onFailCallback(res, override),
      )
      .catch((err) => onFailCallback(err, override));
  }

  static async getFaultTree(
    faultTreeId: any = "-1",
    override: any = null,
    onSuccessCallback = this.defaultSuccessCallback,
    onFailCallback = this.defaultFailCallback,
  ): Promise<FaultTreeGraph> {
    return this.get(
      `${FAULT_TREE_GRAPH_ENDPOINT}/?faultTreeId=${faultTreeId}`,
      override,
      onSuccessCallback,
      onFailCallback
    )
      .then((response) => {
        return !response.trim() ? {} as FaultTreeGraph : JSON.parse(response) as FaultTreeGraph;
      })
      .catch((error) => {
        console.error("Error fetching fault tree diagram:", error);
        throw error;
      });
  }

  static async get(
    url: any,
    override: any = null,
    onSuccessCallback = this.defaultSuccessCallback,
    onFailCallback = this.defaultFailCallback,
  ) {
    return await fetch(url, {
      method: "GET",
      cache: "no-cache",
      headers: {
        "Content-Type": "application/json",
        Authorization: `JWT ${AuthService.getEncodedToken()}`,
      },
    })
      .then((res) =>
        res.ok
          ? onSuccessCallback(res.text(), override)
          : onFailCallback(res, override),
      )
      .catch((err) => onFailCallback(err, override));
  }
}
