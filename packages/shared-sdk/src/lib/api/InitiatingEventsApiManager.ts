import { Fmea } from 'shared-types';

const API_ENDPOINT = '/api';
const FMEA_ENDPOINT = `${API_ENDPOINT}/fmea`;

/**
 * Status values for snackbar/toast UI feedback.
 */
type SnackbarStatus = 'success' | 'error';

/**
 * Optional overrides that control whether success/failure snackbars are shown.
 */
type CallbackOverride = { showSuccess?: boolean; showFailure?: boolean } | null;

/**
 * Success callback signature used by API helpers.
 *
 * @param res - The raw string body or Response received from fetch.
 * @param override - Optional UI behavior overrides for snackbars.
 */
type SuccessCallback = (
  res: string | Response,
  override: CallbackOverride,
) => unknown;

/**
 * Failure callback signature used by API helpers.
 *
 * @param res - The error object or Response received from fetch.
 * @param override - Optional UI behavior overrides for snackbars.
 */
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
  /**
   * Emit a snackbar/toast with the given status and response payload.
   *
   * @param _status - UI status to display (success or error).
   * @param _res - The payload or response used to render the message.
   * @param _override - Optional UI overrides to control snackbar behavior.
   */
  static callSnackbar(
    _status: SnackbarStatus,
    _res: unknown,
    _override: CallbackOverride,
  ) {
    //TODO::
  }

  /**
   * Default success callback used by API helpers.
   * Shows a success snackbar when the override enables it.
   *
   * @param this - Explicitly declares no this binding (set to void) for the static method.
   * @param res - The raw body string or Response returned from fetch.
   * @param override - Optional UI overrides controlling snackbar visibility.
   * @returns Echoes the input response for further chaining.
   */
  static defaultSuccessCallback(
    this: void,
    res: string | Response,
    override: CallbackOverride,
  ) {
    try {
      const showSuccess = !!override?.showSuccess;
      if (showSuccess) {
        FmeaApiManager.callSnackbar('success', res, override);
      }
    } catch (e: unknown) {
      // Intentionally ignore UI feedback errors
      console.debug('defaultSuccessCallback: ignoring showSuccess error', e);
    }
    return res;
  }

  /**
   * Default failure callback used by API helpers.
   * Shows an error snackbar when the override enables it.
   *
   * @param this - Explicitly declares no this binding (set to void) for the static method.
   * @param res - The error or Response returned from fetch.
   * @param override - Optional UI overrides controlling snackbar visibility.
   * @returns Echoes the input error/response for further chaining.
   */
  static defaultFailCallback(
    this: void,
    res: unknown,
    override: CallbackOverride,
  ) {
    try {
      const showFailure = !!override?.showFailure;
      if (showFailure) {
        FmeaApiManager.callSnackbar('error', res, override);
      }
    } catch (e: unknown) {
      // Intentionally ignore UI feedback errors
      console.debug('defaultFailCallback: ignoring showFailure error', e);
    }
    return res;
  }

  /**
   * Create and persist an FMEA document.
   *
   * @param data - The FMEA payload to store.
   * @param override - Optional UI behavior overrides for snackbars (success/failure).
   * @param onSuccessCallback - Invoked when the request succeeds; defaults to emitting a success snackbar.
   * @param onFailCallback - Invoked when the request fails; defaults to emitting a failure snackbar.
   * @returns The created FMEA parsed from the response body (empty object on failure).
   */
  static async storeFmea(
    data: Fmea,
    override: CallbackOverride = null,
    onSuccessCallback: SuccessCallback = this.defaultSuccessCallback,
    onFailCallback: FailCallback = this.defaultFailCallback,
  ): Promise<Fmea> {
    return await fetch(FMEA_ENDPOINT, {
      method: 'POST',
      cache: 'no-cache',
      headers: {
        'Content-Type': 'application/json',
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
        return '';
      })
      .then((responseText: string) =>
        responseText && responseText.trim()
          ? (JSON.parse(responseText) as Fmea)
          : ({} as Fmea),
      )
      .catch((err: unknown) => {
        onFailCallback(err, override);
        return {} as Fmea;
      });
  }

  /**
   * Fetch a single FMEA by identifier.
   *
   * @param fmeaId - FMEA identifier; defaults to "-1" when not provided.
   * @param override - Optional UI behavior overrides for snackbars (success/failure).
   * @param onSuccessCallback - Invoked when the request succeeds; defaults to emitting a success snackbar.
   * @param onFailCallback - Invoked when the request fails; defaults to emitting a failure snackbar.
   * @returns The fetched FMEA parsed from the response body (throws on fetch error).
   */
  static async getFmea(
    fmeaId: string | number = '-1',
    override: CallbackOverride = null,
    onSuccessCallback: SuccessCallback = this.defaultSuccessCallback,
    onFailCallback: FailCallback = this.defaultFailCallback,
  ): Promise<Fmea> {
    return this.get(
      `${FMEA_ENDPOINT}/${fmeaId}`,
      override,
      onSuccessCallback,
      onFailCallback,
    )
      .then((responseText: string) =>
        responseText && responseText.trim()
          ? (JSON.parse(responseText) as Fmea)
          : ({} as Fmea),
      )
      .catch((error) => {
        console.error('Error fetching fault tree diagram:', error);
        throw error;
      });
  }

  /**
   * Add a column to an existing FMEA.
   *
   * @param fmeaId - The numeric identifier of the FMEA to update.
   * @param body - Request payload describing the new column (name, type, etc.).
   * @param override - Optional UI behavior overrides for snackbars (success/failure).
   * @param onSuccessCallback - Invoked when the request succeeds; defaults to emitting a success snackbar.
   * @param onFailCallback - Invoked when the request fails; defaults to emitting a failure snackbar.
   * @returns The updated FMEA parsed from the response body (empty object on failure).
   */
  static async addColumn(
    fmeaId: number,
    body: unknown,
    override: CallbackOverride = null,
    onSuccessCallback: SuccessCallback = this.defaultSuccessCallback,
    onFailCallback: FailCallback = this.defaultFailCallback,
  ): Promise<Fmea> {
    return await fetch(`${FMEA_ENDPOINT}/${fmeaId}/column`, {
      method: 'PUT',
      cache: 'no-cache',
      headers: {
        'Content-Type': 'application/json',
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
        return '';
      })
      .then((responseText: string) =>
        responseText && responseText.trim()
          ? (JSON.parse(responseText) as Fmea)
          : ({} as Fmea),
      )
      .catch((err: unknown) => {
        onFailCallback(err, override);
        return {} as Fmea;
      });
  }

  /**
   * Insert a new row into an existing FMEA.
   *
   * @param fmeaId - The numeric identifier of the FMEA to update.
   * @param override - Optional UI behavior overrides for snackbars (success/failure).
   * @param onSuccessCallback - Invoked when the request succeeds; defaults to emitting a success snackbar.
   * @param onFailCallback - Invoked when the request fails; defaults to emitting a failure snackbar.
   * @returns The updated FMEA parsed from the response body (empty object on failure).
   */
  static async addRow(
    fmeaId: number,
    override: CallbackOverride = null,
    onSuccessCallback: SuccessCallback = this.defaultSuccessCallback,
    onFailCallback: FailCallback = this.defaultFailCallback,
  ): Promise<Fmea> {
    return await fetch(`${FMEA_ENDPOINT}/${fmeaId}/row`, {
      method: 'PUT',
      cache: 'no-cache',
      headers: {
        'Content-Type': 'application/json',
      },
    })
      .then(async (res: Response) => {
        if (res.ok) {
          const text = await res.text();
          onSuccessCallback(text, override);
          return text;
        }
        onFailCallback(res, override);
        return '';
      })
      .then((responseText: string) =>
        responseText && responseText.trim()
          ? (JSON.parse(responseText) as Fmea)
          : ({} as Fmea),
      )
      .catch((err: unknown) => {
        onFailCallback(err, override);
        return {} as Fmea;
      });
  }

  /**
   * Update a single FMEA cell value.
   *
   * @param fmeaId - The numeric identifier of the FMEA to update.
   * @param body - Payload describing the cell coordinates and new value.
   * @param override - Optional UI behavior overrides for snackbars (success/failure).
   * @param onSuccessCallback - Invoked when the request succeeds; defaults to emitting a success snackbar.
   * @param onFailCallback - Invoked when the request fails; defaults to emitting a failure snackbar.
   * @returns The updated FMEA parsed from the response body (empty object on failure).
   */
  static async updateCell(
    fmeaId: number,
    body: unknown,
    override: CallbackOverride = null,
    onSuccessCallback: SuccessCallback = this.defaultSuccessCallback,
    onFailCallback: FailCallback = this.defaultFailCallback,
  ): Promise<Fmea> {
    return await fetch(`${FMEA_ENDPOINT}/${fmeaId}/cell`, {
      method: 'PUT',
      cache: 'no-cache',
      headers: {
        'Content-Type': 'application/json',
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
        return '';
      })
      .then((responseText: string) =>
        responseText && responseText.trim()
          ? (JSON.parse(responseText) as Fmea)
          : ({} as Fmea),
      )
      .catch((err: unknown) => {
        onFailCallback(err, override);
        return {} as Fmea;
      });
  }

  /**
   * Replace dropdown options for a column in an FMEA.
   *
   * @param fmeaId - The numeric identifier of the FMEA to update.
   * @param body - A map of dropdown configuration for the column.
   * @param override - Optional UI behavior overrides for snackbars (success/failure).
   * @param onSuccessCallback - Invoked when the request succeeds; defaults to emitting a success snackbar.
   * @param onFailCallback - Invoked when the request fails; defaults to emitting a failure snackbar.
   * @returns The updated FMEA parsed from the response body (empty object on failure).
   */
  static async updateDropdownOptions(
    fmeaId: number,
    body: Record<string, unknown>,
    override: CallbackOverride = null,
    onSuccessCallback: SuccessCallback = this.defaultSuccessCallback,
    onFailCallback: FailCallback = this.defaultFailCallback,
  ): Promise<Fmea> {
    return await fetch(`${FMEA_ENDPOINT}/${fmeaId}/dropdown`, {
      method: 'PUT',
      cache: 'no-cache',
      headers: {
        'Content-Type': 'application/json',
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
        return '';
      })
      .then((responseText: string) =>
        responseText && responseText.trim()
          ? (JSON.parse(responseText) as Fmea)
          : ({} as Fmea),
      )
      .catch((err: unknown) => {
        onFailCallback(err, override);
        return {} as Fmea;
      });
  }

  /**
   * Delete a column from an FMEA.
   *
   * @param fmeaId - The numeric identifier of the FMEA to update.
   * @param column - The column name to remove.
   * @param override - Optional UI behavior overrides for snackbars (success/failure).
   * @param onSuccessCallback - Invoked when the request succeeds; defaults to emitting a success snackbar.
   * @param onFailCallback - Invoked when the request fails; defaults to emitting a failure snackbar.
   * @returns The updated FMEA parsed from the response body (empty object on failure).
   */
  static async deleteColumn(
    fmeaId: number,
    column: string,
    override: CallbackOverride = null,
    onSuccessCallback: SuccessCallback = this.defaultSuccessCallback,
    onFailCallback: FailCallback = this.defaultFailCallback,
  ): Promise<Fmea> {
    return this.put(
      `${FMEA_ENDPOINT}/${fmeaId}/${column}/delete`,
      override,
      onSuccessCallback,
      onFailCallback,
    );
  }

  /**
   * Delete a row from an FMEA.
   *
   * @param fmeaId - The numeric identifier of the FMEA to update.
   * @param rowId - The row identifier to remove.
   * @param override - Optional UI behavior overrides for snackbars (success/failure).
   * @param onSuccessCallback - Invoked when the request succeeds; defaults to emitting a success snackbar.
   * @param onFailCallback - Invoked when the request fails; defaults to emitting a failure snackbar.
   * @returns The updated FMEA parsed from the response body (empty object on failure).
   */
  static async deleteRow(
    fmeaId: number,
    rowId: string,
    override: CallbackOverride = null,
    onSuccessCallback: SuccessCallback = this.defaultSuccessCallback,
    onFailCallback: FailCallback = this.defaultFailCallback,
  ): Promise<Fmea> {
    return await fetch(`${FMEA_ENDPOINT}/${fmeaId}/${rowId}/delete`, {
      method: 'DELETE',
      cache: 'no-cache',
      headers: {
        'Content-Type': 'application/json',
      },
    })
      .then(async (res: Response) => {
        if (res.ok) {
          const text = await res.text();
          onSuccessCallback(text, override);
          return text;
        }
        onFailCallback(res, override);
        return '';
      })
      .then((responseText: string) =>
        responseText && responseText.trim()
          ? (JSON.parse(responseText) as Fmea)
          : ({} as Fmea),
      )
      .catch((err: unknown) => {
        onFailCallback(err, override);
        return {} as Fmea;
      });
  }

  /**
   * Delete an entire FMEA.
   *
   * @param fmeaId - The numeric identifier of the FMEA to delete.
   * @param override - Optional UI behavior overrides for snackbars (success/failure).
   * @param onSuccessCallback - Invoked when the request succeeds; defaults to emitting a success snackbar.
   * @param onFailCallback - Invoked when the request fails; defaults to emitting a failure snackbar.
   * @returns true when the delete succeeds, otherwise false.
   */
  static async deleteFmea(
    fmeaId: number,
    override: CallbackOverride = null,
    onSuccessCallback: SuccessCallback = this.defaultSuccessCallback,
    onFailCallback: FailCallback = this.defaultFailCallback,
  ): Promise<boolean> {
    return await fetch(`${FMEA_ENDPOINT}/${fmeaId}/delete`, {
      method: 'PUT',
      cache: 'no-cache',
      headers: {
        'Content-Type': 'application/json',
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

  /**
   * Update details for a column, including support for renaming via prev_column_name.
   *
   * @param fmeaId - The numeric identifier of the FMEA to update.
   * @param body - A record of updates; when prev_column_name is present, it is used in the URL.
   * @param override - Optional UI behavior overrides for snackbars (success/failure).
   * @param onSuccessCallback - Invoked when the request succeeds; defaults to emitting a success snackbar.
   * @param onFailCallback - Invoked when the request fails; defaults to emitting a failure snackbar.
   * @returns The updated FMEA parsed from the response body (empty object on failure).
   */
  static async updateColumnDetails(
    fmeaId: number,
    body: { prev_column_name: string } | Record<string, unknown>,
    override: CallbackOverride = null,
    onSuccessCallback: SuccessCallback = this.defaultSuccessCallback,
    onFailCallback: FailCallback = this.defaultFailCallback,
  ): Promise<Fmea> {
    const prevValue =
      typeof body === 'object' && body !== null && 'prev_column_name' in body
        ? (body as { prev_column_name?: unknown }).prev_column_name
        : undefined;
    const prev =
      typeof prevValue === 'string' || typeof prevValue === 'number'
        ? String(prevValue)
        : '';
    return await fetch(`${FMEA_ENDPOINT}/${fmeaId}/${prev}/update`, {
      method: 'PUT',
      cache: 'no-cache',
      headers: {
        'Content-Type': 'application/json',
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
        return '';
      })
      .then((responseText: string) =>
        responseText && responseText.trim()
          ? (JSON.parse(responseText) as Fmea)
          : ({} as Fmea),
      )
      .catch((err: unknown) => {
        onFailCallback(err, override);
        return {} as Fmea;
      });
  }

  /**
   * Low-level GET helper that returns a response body as text.
   *
   * @param url - Absolute or relative URL to fetch.
   * @param override - Optional UI behavior overrides for snackbars (success/failure).
   * @param onSuccessCallback - Invoked when the request succeeds; defaults to emitting a success snackbar.
   * @param onFailCallback - Invoked when the request fails; defaults to emitting a failure snackbar.
   * @returns The raw response text, or an empty string on failure.
   */
  static async get(
    url: string,
    override: CallbackOverride = null,
    onSuccessCallback: SuccessCallback = this.defaultSuccessCallback,
    onFailCallback: FailCallback = this.defaultFailCallback,
  ) {
    return await fetch(url, {
      method: 'GET',
      cache: 'no-cache',
      headers: {
        'Content-Type': 'application/json',
      },
    })
      .then(async (res: Response) => {
        if (res.ok) {
          const text = await res.text();
          onSuccessCallback(text, override);
          return text;
        }
        onFailCallback(res, override);
        return '';
      })
      .catch((err: unknown) => {
        onFailCallback(err, override);
        return '';
      });
  }

  /**
   * Low-level PUT helper that returns the response body parsed as FMEA when present.
   *
   * @param url - Absolute or relative URL to fetch with PUT.
   * @param override - Optional UI behavior overrides for snackbars (success/failure).
   * @param onSuccessCallback - Invoked when the request succeeds; defaults to emitting a success snackbar.
   * @param onFailCallback - Invoked when the request fails; defaults to emitting a failure snackbar.
   * @returns The updated FMEA parsed from the response body (empty object on failure).
   */
  static async put(
    url: string,
    override: CallbackOverride = null,
    onSuccessCallback: SuccessCallback = this.defaultSuccessCallback,
    onFailCallback: FailCallback = this.defaultFailCallback,
  ) {
    return await fetch(url, {
      method: 'PUT',
      cache: 'no-cache',
      headers: {
        'Content-Type': 'application/json',
      },
    })
      .then(async (res: Response) => {
        if (res.ok) {
          const text = await res.text();
          onSuccessCallback(text, override);
          return text;
        }
        onFailCallback(res, override);
        return '';
      })
      .then((responseText: string) =>
        responseText && responseText.trim()
          ? (JSON.parse(responseText) as Fmea)
          : ({} as Fmea),
      )
      .catch((err: unknown) => {
        onFailCallback(err, override);
        return {} as Fmea;
      });
  }
}
