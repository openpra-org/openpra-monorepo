import HclApiManager from "./HclApiManager";

export default class DataApiManager extends HclApiManager {
  public static override ENDPOINT: string = HclApiManager.ENDPOINT + "/data/parameter-estimates/";

  public static getSpecialEvents() {
    return HclApiManager.getWithOptions(DataApiManager.ENDPOINT+'special-events/');
  }
  public static getComponentReliability() {
    return HclApiManager.getWithOptions(DataApiManager.ENDPOINT+'component-reliability/');
  }
  public static getInitiatingEvents() {
    return HclApiManager.getWithOptions(DataApiManager.ENDPOINT+'initiating-events/');
  }
  public static getTrainUA() {
    return HclApiManager.getWithOptions(DataApiManager.ENDPOINT+'train-ua/');
  }
  public static getCCF() {
    return HclApiManager.getWithOptions(DataApiManager.ENDPOINT+'ccf/');
  }



}
