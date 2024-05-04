const API_ENDPOINT = "/api";
const INITIATINGEVENTGROUP_ENDPOINT = `${API_ENDPOINT}/initiating-event-group`;

export default class InitiatingEventGroupApiManager {
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

  static async getAllInitiatingEventGroups(
    override: any = null,
    onSuccessCallback = this.defaultSuccessCallback,
    onFailCallback = this.defaultFailCallback,
  ) {
    return await this.get(
      `${INITIATINGEVENTGROUP_ENDPOINT}/`,
      override,
      onSuccessCallback,
      onFailCallback,
    );
  }

  static async getInitiatingEventGroupById(
    id: string,
    override: any = null,
    onSuccessCallback = this.defaultSuccessCallback,
    onFailCallback = this.defaultFailCallback,
  ) {
    return await this.get(
      `${INITIATINGEVENTGROUP_ENDPOINT}/${id}`,
      override,
      onSuccessCallback,
      onFailCallback,
    );
  }

  static async createInitiatingEventGroup(
    data: any,
    override: any = null,
    onSuccessCallback = this.defaultSuccessCallback,
    onFailCallback = this.defaultFailCallback,
  ) {
    return await fetch(`${INITIATINGEVENTGROUP_ENDPOINT}`, {
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

  static async updateInitiatingEventGroup(
    id: string,
    data: any,
    override: any = null,
    onSuccessCallback = this.defaultSuccessCallback,
    onFailCallback = this.defaultFailCallback,
  ) {
    return await fetch(`${INITIATINGEVENTGROUP_ENDPOINT}/${id}`, {
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

  static async deleteInitiatingEventGroup(
    id: string,
    override: any = null,
    onSuccessCallback = this.defaultSuccessCallback,
    onFailCallback = this.defaultFailCallback,
  ) {
    return await fetch(`${INITIATINGEVENTGROUP_ENDPOINT}/${id}`, {
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

  static async addInitiatingEventToGroup(
    id: string,
    eventId: string,
    override: any = null,
    onSuccessCallback = this.defaultSuccessCallback,
    onFailCallback = this.defaultFailCallback,
  ) {
    return await fetch(`${INITIATINGEVENTGROUP_ENDPOINT}/${id}/addEvent/${eventId}`, {
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

  static async removeInitiatingEventFromGroup(
    id: string,
    eventId: string,
    override: any = null,
    onSuccessCallback = this.defaultSuccessCallback,
    onFailCallback = this.defaultFailCallback,
  ) {
    return await fetch(`${INITIATINGEVENTGROUP_ENDPOINT}/${id}/removeEvent/${eventId}`, {
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
}
