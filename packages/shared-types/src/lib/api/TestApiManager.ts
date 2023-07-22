import InternalEventsModel from "../types/modelTypes/largeModels/internalEventsModel";
import AuthService from "./AuthService";

const API_ENDPOINT = '/api';
const collabEndpoint = `${API_ENDPOINT}/collab`;

export default class TestApiManager {


    static callSnackbar(status: any, res: any, override: any) {
        //TODO::
    }

    static defaultSuccessCallback(res: any, override: any) {
        try {
          const { showSuccess } = override;
          if (showSuccess) {
            this.callSnackbar('success', res, override);
          }
        } catch {

        }
        return res;
    }

    static defaultFailCallback(res: any, override: any) {
    try {
        const { showFailure } = override;
        if (showFailure) {
        this.callSnackbar('error', res, override);
        }
    } catch {

    }
    return res;
    }

    static postInternalEvent(data: InternalEventsModel, override: any = null, onSuccessCallback = this.defaultSuccessCallback, onFailCallback = this.defaultFailCallback) {
        return fetch('/internal-events', {
          method: 'POST',
          cache: 'no-cache',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `JWT ${AuthService.getEncodedToken()}`,
          },
          body: JSON.stringify(data) // body data type must match "Content-Type" header
        }).then(res => (res.ok ? onSuccessCallback(res, override) : onFailCallback(res, override)))
          .catch(err => onFailCallback(err, override));
    }
}
