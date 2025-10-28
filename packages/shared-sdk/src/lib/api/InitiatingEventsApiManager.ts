import { Fmea } from "shared-types";

const API_ENDPOINT = "/api";
const FMEA_ENDPOINT = `${API_ENDPOINT}/fmea`;

type SnackbarStatus = "success" | "error";
type CallbackOverride = { showSuccess?: boolean; showFailure?: boolean } | null;
type SuccessCallback = (res: string | Response, override: CallbackOverride) => unknown;
type FailCallback = (res: unknown, override: CallbackOverride) => unknown;

/**
 * Client for FMEA-related API endpoints.
 * Provides helpers to create, fetch, update, and delete FMEA resources
 * and emits optional UI callbacks for success/failure handling.
 *
 * This is exported as the default class from the SDK.
 * @public
 */
export default class FmeaApiManager {
  static callSnackbar(_status: SnackbarStatus, _res: unknown, _override: CallbackOverride) {
    //TODO::
  }

  static defaultSuccessCallback(this: void, res: string | Response, override: CallbackOverride) {
    try {
      const showSuccess = !!override?.showSuccess;
      if (showSuccess) {
        FmeaApiManager.callSnackbar("success", res, override);
      }
    } catch (e: unknown) {
      // Intentionally ignore UI feedback errors
      console.debug("defaultSuccessCallback: ignoring showSuccess error", e);
    }
    return res;
  }

  static defaultFailCallback(this: void, res: unknown, override: CallbackOverride) {
    try {
      const showFailure = !!override?.showFailure;
      if (showFailure) {
        FmeaApiManager.callSnackbar("error", res, override);
      }
    } catch (e: unknown) {
      // Intentionally ignore UI feedback errors
      console.debug("defaultFailCallback: ignoring showFailure error", e);
    }
    return res;
  }

  static async storeFmea(
    data: Fmea,
    override: CallbackOverride = null,
    onSuccessCallback: SuccessCallback = this.defaultSuccessCallback,
    onFailCallback: FailCallback = this.defaultFailCallback,
  ): Promise<Fmea> {
    return await fetch(FMEA_ENDPOINT, {
      method: "POST",
      cache: "no-cache",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    })
      .then(async (res: Response) => {
        if (res.ok) {
          const text = await res.text();
          onSuccessCallback(text, override);
          return text;
        }
        onFailCallback(res, override);
        return "";
      })
      .then((responseText: string) =>
        responseText && responseText.trim() ? (JSON.parse(responseText) as Fmea) : ({} as Fmea),
      )
      .catch((err: unknown) => {
        onFailCallback(err, override);
        return {} as Fmea;
      });
  }

  static async getFmea(
    fmeaId: string | number = "-1",
    override: CallbackOverride = null,
    onSuccessCallback: SuccessCallback = this.defaultSuccessCallback,
    onFailCallback: FailCallback = this.defaultFailCallback,
  ): Promise<Fmea> {
    return this.get(`${FMEA_ENDPOINT}/${fmeaId}`, override, onSuccessCallback, onFailCallback)
      .then((responseText: string) =>
        responseText && responseText.trim() ? (JSON.parse(responseText) as Fmea) : ({} as Fmea),
      )
      .catch((error) => {
        console.error("Error fetching fault tree diagram:", error);
        throw error;
      });
  }

  static async addColumn(
    fmeaId: number,
    body: unknown,
    override: CallbackOverride = null,
    onSuccessCallback: SuccessCallback = this.defaultSuccessCallback,
    onFailCallback: FailCallback = this.defaultFailCallback,
  ): Promise<Fmea> {
    return await fetch(`${FMEA_ENDPOINT}/${fmeaId}/column`, {
      method: "PUT",
      cache: "no-cache",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    })
      .then(async (res: Response) => {
        if (res.ok) {
          const text = await res.text();
          onSuccessCallback(text, override);
          return text;
        }
        onFailCallback(res, override);
        return "";
      })
      .then((responseText: string) =>
        responseText && responseText.trim() ? (JSON.parse(responseText) as Fmea) : ({} as Fmea),
      )
      .catch((err: unknown) => {
        onFailCallback(err, override);
        return {} as Fmea;
      });
  }

  static async addRow(
    fmeaId: number,
    override: CallbackOverride = null,
    onSuccessCallback: SuccessCallback = this.defaultSuccessCallback,
    onFailCallback: FailCallback = this.defaultFailCallback,
  ): Promise<Fmea> {
    return await fetch(`${FMEA_ENDPOINT}/${fmeaId}/row`, {
      method: "PUT",
      cache: "no-cache",
      headers: {
        "Content-Type": "application/json",
      },
    })
      .then(async (res: Response) => {
        if (res.ok) {
          const text = await res.text();
          onSuccessCallback(text, override);
          return text;
        }
        onFailCallback(res, override);
        return "";
      })
      .then((responseText: string) =>
        responseText && responseText.trim() ? (JSON.parse(responseText) as Fmea) : ({} as Fmea),
      )
      .catch((err: unknown) => {
        onFailCallback(err, override);
        return {} as Fmea;
      });
  }

  static async updateCell(
    fmeaId: number,
    body: unknown,
    override: CallbackOverride = null,
    onSuccessCallback: SuccessCallback = this.defaultSuccessCallback,
    onFailCallback: FailCallback = this.defaultFailCallback,
  ): Promise<Fmea> {
    return await fetch(`${FMEA_ENDPOINT}/${fmeaId}/cell`, {
      method: "PUT",
      cache: "no-cache",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    })
      .then(async (res: Response) => {
        if (res.ok) {
          const text = await res.text();
          onSuccessCallback(text, override);
          return text;
        }
        onFailCallback(res, override);
        return "";
      })
      .then((responseText: string) =>
        responseText && responseText.trim() ? (JSON.parse(responseText) as Fmea) : ({} as Fmea),
      )
      .catch((err: unknown) => {
        onFailCallback(err, override);
        return {} as Fmea;
      });
  }

  static async updateDropdownOptions(
    fmeaId: number,
    body: Record<string, unknown>,
    override: CallbackOverride = null,
    onSuccessCallback: SuccessCallback = this.defaultSuccessCallback,
    onFailCallback: FailCallback = this.defaultFailCallback,
  ): Promise<Fmea> {
    return await fetch(`${FMEA_ENDPOINT}/${fmeaId}/dropdown`, {
      method: "PUT",
      cache: "no-cache",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    })
      .then(async (res: Response) => {
        if (res.ok) {
          const text = await res.text();
          onSuccessCallback(text, override);
          return text;
        }
        onFailCallback(res, override);
        return "";
      })
      .then((responseText: string) =>
        responseText && responseText.trim() ? (JSON.parse(responseText) as Fmea) : ({} as Fmea),
      )
      .catch((err: unknown) => {
        onFailCallback(err, override);
        return {} as Fmea;
      });
  }

  static async deleteColumn(
    fmeaId: number,
    column: string,
    override: CallbackOverride = null,
    onSuccessCallback: SuccessCallback = this.defaultSuccessCallback,
    onFailCallback: FailCallback = this.defaultFailCallback,
  ): Promise<Fmea> {
    return this.put(`${FMEA_ENDPOINT}/${fmeaId}/${column}/delete`, override, onSuccessCallback, onFailCallback);
  }

  static async deleteRow(
    fmeaId: number,
    rowId: string,
    override: CallbackOverride = null,
    onSuccessCallback: SuccessCallback = this.defaultSuccessCallback,
    onFailCallback: FailCallback = this.defaultFailCallback,
  ): Promise<Fmea> {
    return await fetch(`${FMEA_ENDPOINT}/${fmeaId}/${rowId}/delete`, {
      method: "DELETE",
      cache: "no-cache",
      headers: {
        "Content-Type": "application/json",
      },
    })
      .then(async (res: Response) => {
        if (res.ok) {
          const text = await res.text();
          onSuccessCallback(text, override);
          return text;
        }
        onFailCallback(res, override);
        return "";
      })
      .then((responseText: string) =>
        responseText && responseText.trim() ? (JSON.parse(responseText) as Fmea) : ({} as Fmea),
      )
      .catch((err: unknown) => {
        onFailCallback(err, override);
        return {} as Fmea;
      });
  }

  static async deleteFmea(
    fmeaId: number,
    override: CallbackOverride = null,
    onSuccessCallback: SuccessCallback = this.defaultSuccessCallback,
    onFailCallback: FailCallback = this.defaultFailCallback,
  ): Promise<boolean> {
    return await fetch(`${FMEA_ENDPOINT}/${fmeaId}/delete`, {
      method: "PUT",
      cache: "no-cache",
      headers: {
        "Content-Type": "application/json",
      },
    })
      .then((res: Response) => {
        if (res.ok) {
          onSuccessCallback(res, override);
          return true;
        }
        onFailCallback(res, override);
        return false;
      })
      .catch((err: unknown) => {
        onFailCallback(err, override);
        return false;
      });
  }

  static async updateColumnDetails(
    fmeaId: number,
    body: { prev_column_name: string } | Record<string, unknown>,
    override: CallbackOverride = null,
    onSuccessCallback: SuccessCallback = this.defaultSuccessCallback,
    onFailCallback: FailCallback = this.defaultFailCallback,
  ): Promise<Fmea> {
    const prevValue =
      typeof body === "object" && body !== null && "prev_column_name" in body ?
        (body as { prev_column_name?: unknown }).prev_column_name
      : undefined;
    const prev = typeof prevValue === "string" || typeof prevValue === "number" ? String(prevValue) : "";
    return await fetch(`${FMEA_ENDPOINT}/${fmeaId}/${prev}/update`, {
      method: "PUT",
      cache: "no-cache",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    })
      .then(async (res: Response) => {
        if (res.ok) {
          const text = await res.text();
          onSuccessCallback(text, override);
          return text;
        }
        onFailCallback(res, override);
        return "";
      })
      .then((responseText: string) =>
        responseText && responseText.trim() ? (JSON.parse(responseText) as Fmea) : ({} as Fmea),
      )
      .catch((err: unknown) => {
        onFailCallback(err, override);
        return {} as Fmea;
      });
  }

  static async get(
    url: string,
    override: CallbackOverride = null,
    onSuccessCallback: SuccessCallback = this.defaultSuccessCallback,
    onFailCallback: FailCallback = this.defaultFailCallback,
  ) {
    return await fetch(url, {
      method: "GET",
      cache: "no-cache",
      headers: {
        "Content-Type": "application/json",
      },
    })
      .then(async (res: Response) => {
        if (res.ok) {
          const text = await res.text();
          onSuccessCallback(text, override);
          return text;
        }
        onFailCallback(res, override);
        return "";
      })
      .catch((err: unknown) => {
        onFailCallback(err, override);
        return "";
      });
  }

  static async put(
    url: string,
    override: CallbackOverride = null,
    onSuccessCallback: SuccessCallback = this.defaultSuccessCallback,
    onFailCallback: FailCallback = this.defaultFailCallback,
  ) {
    return await fetch(url, {
      method: "PUT",
      cache: "no-cache",
      headers: {
        "Content-Type": "application/json",
      },
    })
      .then(async (res: Response) => {
        if (res.ok) {
          const text = await res.text();
          onSuccessCallback(text, override);
          return text;
        }
        onFailCallback(res, override);
        return "";
      })
      .then((responseText: string) =>
        responseText && responseText.trim() ? (JSON.parse(responseText) as Fmea) : ({} as Fmea),
      )
      .catch((err: unknown) => {
        onFailCallback(err, override);
        return {} as Fmea;
      });
  }
}
