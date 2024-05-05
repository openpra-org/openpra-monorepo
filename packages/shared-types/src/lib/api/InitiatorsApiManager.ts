

const API_ENDPOINT = "/api";
const INITIATOR_ENDPOINT = `${API_ENDPOINT}/initiators`;

export default class InitiatorApiManager {
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

  static async getAllInitiators(
    override: any = null,
    onSuccessCallback = this.defaultSuccessCallback,
    onFailCallback = this.defaultFailCallback,
  ) {
    return await this.get(
      `${INITIATOR_ENDPOINT}/fetchall`,
      override,
      onSuccessCallback,
      onFailCallback,
    );
  }

  static async getInitiatorById(
    id: string,
    override: any = null,
    onSuccessCallback = this.defaultSuccessCallback,
    onFailCallback = this.defaultFailCallback,
  ) {
    return await this.get(
      `${INITIATOR_ENDPOINT}/${id}`,
      override,
      onSuccessCallback,
      onFailCallback,
    );
  }

  static async createInitiator(
    data: any,
    override: any = null,
    onSuccessCallback = this.defaultSuccessCallback,
    onFailCallback = this.defaultFailCallback,
  ) {
    return await fetch(`${INITIATOR_ENDPOINT}`, {
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

  static async updateInitiator(
    id: string,
    data: any,
    override: any = null,
    onSuccessCallback = this.defaultSuccessCallback,
    onFailCallback = this.defaultFailCallback,
  ) {
    return await fetch(`${INITIATOR_ENDPOINT}/${id}`, {
      method: "PUT",
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

  static async deleteInitiator(
    id: string,
    override: any = null,
    onSuccessCallback = this.defaultSuccessCallback,
    onFailCallback = this.defaultFailCallback,
  ) {
    return await fetch(`${INITIATOR_ENDPOINT}/${id}`, {
      method: "DELETE",
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

  static async addSourceToInitiator(
    id: string,
    sourceId: string,
    override: any = null,
    onSuccessCallback = this.defaultSuccessCallback,
    onFailCallback = this.defaultFailCallback,
  ) {
    return await fetch(`${INITIATOR_ENDPOINT}/${id}/addSource/${sourceId}`, {
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

  static async removeSourceFromInitiator(
    id: string,
    sourceId: string,
    override: any = null,
    onSuccessCallback = this.defaultSuccessCallback,
    onFailCallback = this.defaultFailCallback,
  ) {
    return await fetch(`${INITIATOR_ENDPOINT}/${id}/removeSource/${sourceId}`, {
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

  static async getInitiatorsBySourceId(
    sourceId: string,
    override: any = null,
    onSuccessCallback = this.defaultSuccessCallback,
    onFailCallback = this.defaultFailCallback,
  ) {
    return await this.get(
      `${INITIATOR_ENDPOINT}/source/${sourceId}`,
      override,
      onSuccessCallback,
      onFailCallback,
    );
  }

  static async setInitiatorState(
    id: string,
    state: string,
    override: any = null,
    onSuccessCallback = this.defaultSuccessCallback,
    onFailCallback = this.defaultFailCallback,
  ) {
    return await fetch(`${INITIATOR_ENDPOINT}/${id}/setState/${state}`, {
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
}
