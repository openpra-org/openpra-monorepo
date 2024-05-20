import { FailureModesAndEffectsAnalyses } from "../types/fmea/FailureModesAndEffectsAnalyses";

const API_ENDPOINT = "/api";
const FMEA_ENDPOINT = `${API_ENDPOINT}/failure-modes-and-effects-analyses`;

export default class FmeaApiManager {
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

  static async storeFmea(
    data: FailureModesAndEffectsAnalyses,
    override: any = null,
    onSuccessCallback = this.defaultSuccessCallback,
    onFailCallback = this.defaultFailCallback,
  ): Promise<FailureModesAndEffectsAnalyses> {
    return await fetch(`${FMEA_ENDPOINT}`, {
      method: "POST",
      cache: "no-cache",
      headers: {
        "Content-Type": "application/json",
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

  static async getFmea(
    fmeaId: any = "-1",
    body: any,
    override: any = null,
    onSuccessCallback = this.defaultSuccessCallback,
    onFailCallback = this.defaultFailCallback,
  ): Promise<FailureModesAndEffectsAnalyses> {
    return await fetch(`${FMEA_ENDPOINT}/${fmeaId}`, {
      method: "POST",
      cache: "no-cache",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    })
      .then((res) =>
        res.ok
          ? onSuccessCallback(res.text(), override)
          : onFailCallback(res, override),
      )
      .then((response) =>
        !response.trim()
          ? ({} as FailureModesAndEffectsAnalyses)
          : (JSON.parse(response) as FailureModesAndEffectsAnalyses),
      )
      .catch((err) => onFailCallback(err, override));
  }
  static async getAllFmea(
    override: any = null,
    onSuccessCallback = this.defaultSuccessCallback,
    onFailCallback = this.defaultFailCallback,
  ): Promise<any[]> {
    return await fetch(`${FMEA_ENDPOINT}`, {
      method: "GET",
      cache: "no-cache",
      headers: {
        "Content-Type": "application/json",
      },
    })
      .then((res) =>
        res.ok
          ? onSuccessCallback(res.text(), override)
          : onFailCallback(res, override),
      )
      .then((response) => (!response.trim() ? {} : JSON.parse(response)))
      .catch((err) => onFailCallback(err, override));
  }
  static async addColumn(
    fmeaId: number,
    body: any,
    override: any = null,
    onSuccessCallback = this.defaultSuccessCallback,
    onFailCallback = this.defaultFailCallback,
  ): Promise<FailureModesAndEffectsAnalyses> {
    return await fetch(`${FMEA_ENDPOINT}/${fmeaId}/column`, {
      method: "PUT",
      cache: "no-cache",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    })
      .then((res) =>
        res.ok
          ? onSuccessCallback(res.text(), override)
          : onFailCallback(res, override),
      )
      .then((response) =>
        !response.trim()
          ? ({} as FailureModesAndEffectsAnalyses)
          : (JSON.parse(response) as FailureModesAndEffectsAnalyses),
      )
      .catch((err) => onFailCallback(err, override));
  }

  static async addRow(
    fmeaId: number,
    override: any = null,
    onSuccessCallback = this.defaultSuccessCallback,
    onFailCallback = this.defaultFailCallback,
  ): Promise<FailureModesAndEffectsAnalyses> {
    return await fetch(`${FMEA_ENDPOINT}/${fmeaId}/row`, {
      method: "PUT",
      cache: "no-cache",
      headers: {
        "Content-Type": "application/json",
      },
    })
      .then((res) =>
        res.ok
          ? onSuccessCallback(res.text(), override)
          : onFailCallback(res, override),
      )
      .then((response) =>
        !response.trim()
          ? ({} as FailureModesAndEffectsAnalyses)
          : (JSON.parse(response) as FailureModesAndEffectsAnalyses),
      )
      .catch((err) => onFailCallback(err, override));
  }

  static async updateCell(
    fmeaId: number,
    body: any,
    override: any = null,
    onSuccessCallback = this.defaultSuccessCallback,
    onFailCallback = this.defaultFailCallback,
  ): Promise<FailureModesAndEffectsAnalyses> {
    return await fetch(`${FMEA_ENDPOINT}/${fmeaId}/cell`, {
      method: "PUT",
      cache: "no-cache",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    })
      .then((res) =>
        res.ok
          ? onSuccessCallback(res.text(), override)
          : onFailCallback(res, override),
      )
      .then((response) =>
        !response.trim()
          ? ({} as FailureModesAndEffectsAnalyses)
          : (JSON.parse(response) as FailureModesAndEffectsAnalyses),
      )
      .catch((err) => onFailCallback(err, override));
  }

  static async updateDropdownOptions(
    fmeaId: number,
    body: any,
    override: any = null,
    onSuccessCallback = this.defaultSuccessCallback,
    onFailCallback = this.defaultFailCallback,
  ): Promise<FailureModesAndEffectsAnalyses> {
    return await fetch(`${FMEA_ENDPOINT}/${fmeaId}/dropdown`, {
      method: "PUT",
      cache: "no-cache",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    })
      .then((res) =>
        res.ok
          ? onSuccessCallback(res, override)
          : onFailCallback(res, override),
      )
      .catch((err) => onFailCallback(err, override));
  }

  static async deleteColumn(
    fmeaId: number,
    column: string,
    override: any = null,
    onSuccessCallback = this.defaultSuccessCallback,
    onFailCallback = this.defaultFailCallback,
  ): Promise<FailureModesAndEffectsAnalyses> {
    return this.put(
      `${FMEA_ENDPOINT}/${fmeaId}/${column}/delete`,
      override,
      onSuccessCallback,
      onFailCallback,
    );
  }

  static async deleteRow(
    fmeaId: number,
    rowId: string,
    override: any = null,
    onSuccessCallback = this.defaultSuccessCallback,
    onFailCallback = this.defaultFailCallback,
  ): Promise<FailureModesAndEffectsAnalyses> {
    return await fetch(`${FMEA_ENDPOINT}/${fmeaId}/${rowId}/delete`, {
      method: "DELETE",
      cache: "no-cache",
      headers: {
        "Content-Type": "application/json",
      },
    })
      .then((res) =>
        res.ok
          ? onSuccessCallback(res.text(), override)
          : onFailCallback(res, override),
      )
      .then((response) =>
        !response.trim()
          ? ({} as FailureModesAndEffectsAnalyses)
          : (JSON.parse(response) as FailureModesAndEffectsAnalyses),
      )
      .catch((err) => onFailCallback(err, override));
  }

  static async deleteRows(
    fmeaId: number,
    body: any,
    override: any = null,
    onSuccessCallback = this.defaultSuccessCallback,
    onFailCallback = this.defaultFailCallback,
  ): Promise<FailureModesAndEffectsAnalyses> {
    return await fetch(`${FMEA_ENDPOINT}/${fmeaId}/rows`, {
      method: "DELETE",
      cache: "no-cache",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    })
      .then((res) =>
        res.ok
          ? onSuccessCallback(res.text(), override)
          : onFailCallback(res, override),
      )
      .then((response) =>
        !response.trim()
          ? ({} as FailureModesAndEffectsAnalyses)
          : (JSON.parse(response) as FailureModesAndEffectsAnalyses),
      )
      .catch((err) => onFailCallback(err, override));
  }
  static async deleteFmea(
    fmeaId: number,
    override: any = null,
    onSuccessCallback = this.defaultSuccessCallback,
    onFailCallback = this.defaultFailCallback,
  ): Promise<boolean> {
    return await fetch(`${FMEA_ENDPOINT}/${fmeaId}/delete`, {
      method: "PUT",
      cache: "no-cache",
      headers: {
        "Content-Type": "application/json",
      },
    })
      .then((res) =>
        res.ok
          ? onSuccessCallback(res, override)
          : onFailCallback(res, override),
      )
      .catch((err) => onFailCallback(err, override));
  }

  static async updateColumnDetails(
    fmeaId: number,
    body: any,
    override: any = null,
    onSuccessCallback = this.defaultSuccessCallback,
    onFailCallback = this.defaultFailCallback,
  ): Promise<FailureModesAndEffectsAnalyses> {
    return await fetch(
      `${FMEA_ENDPOINT}/${fmeaId}/${body.prev_column_name}/update`,
      {
        method: "PUT",
        cache: "no-cache",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      },
    )
      .then((res) =>
        res.ok
          ? onSuccessCallback(res.text(), override)
          : onFailCallback(res, override),
      )
      .then((response) =>
        !response.trim()
          ? ({} as FailureModesAndEffectsAnalyses)
          : (JSON.parse(response) as FailureModesAndEffectsAnalyses),
      )
      .catch((err) => onFailCallback(err, override));
  }

  static async get(
    url: string,
    override: any = null,
    onSuccessCallback = this.defaultSuccessCallback,
    onFailCallback = this.defaultFailCallback,
  ) {
    return await fetch(url, {
      method: "GET",
      cache: "no-cache",
      headers: {
        "Content-Type": "application/json",
      },
    })
      .then((res) =>
        res.ok
          ? onSuccessCallback(res.text(), override)
          : onFailCallback(res, override),
      )
      .catch((err) => onFailCallback(err, override));
  }

  static async put(
    url: string,
    override: any = null,
    onSuccessCallback = this.defaultSuccessCallback,
    onFailCallback = this.defaultFailCallback,
  ) {
    return await fetch(url, {
      method: "PUT",
      cache: "no-cache",
      headers: {
        "Content-Type": "application/json",
      },
    })
      .then((res) =>
        res.ok
          ? onSuccessCallback(res, override)
          : onFailCallback(res, override),
      )
      .catch((err) => onFailCallback(err, override));
  }

  static async getRowById(
    fmeaId: number = -1,
    rowId: string,
    override: any = null,
    onSuccessCallback = this.defaultSuccessCallback,
    onFailCallback = this.defaultFailCallback,
  ): Promise<{ id: string; rowData: Object }> {
    return await fetch(`${FMEA_ENDPOINT}/${fmeaId}/row/${rowId}`, {
      method: "GET",
      cache: "no-cache",
    })
      .then((res) =>
        res.ok
          ? onSuccessCallback(res.text(), override)
          : onFailCallback(res, override),
      )
      .then((response) => (!response.trim() ? {} : JSON.parse(response)))
      .catch((err) => onFailCallback(err, override));
  }
}
