import { ProxyTypes } from "./ProxyTypes";
import ReferenceTypes from "./ReferenceTypes";

export type OutcomeJSON = {
  name?: string;
  reference_type?: ReferenceTypes;
  tree_id?: number;
  path?: string;
  make_instance?: boolean;
  _proxy?: ProxyTypes;
};

export default class Outcome {
  public name: string;

  public referenceType: ReferenceTypes;

  public treeId: number;

  public path: string;

  public proxy: ProxyTypes;

  public makeInstance: boolean;

  /**
   * @param {OutcomeJSON} obj - dictionary object to parse
   * @return {Outcome}
   */
  static build(obj: OutcomeJSON = {}): Outcome {
    const makeInstance =
      obj && "make_instance" in obj ? obj.make_instance : false;
    return new Outcome(
      obj.name,
      obj.reference_type,
      obj.tree_id,
      obj.path,
      obj._proxy,
      makeInstance,
    );
  }

  /**
   * @param {string} name
   * @param {ReferenceTypes} referenceType
   * @param {number} treeId
   * @param {string} path
   * @param {ProxyTypes} proxy
   * @param {boolean} make_instance
   */
  constructor(
    name = "",
    referenceType: ReferenceTypes = null,
    treeId = NaN,
    path = "",
    proxy: ProxyTypes = ProxyTypes.EVENT_REFERENCE,
    make_instance = false,
  ) {
    this.name = name || "";
    this.referenceType = referenceType || null;
    this.treeId = treeId || 0;
    this.path = path || "";
    this.makeInstance = make_instance;
    this.proxy = proxy || ProxyTypes.EVENT_REFERENCE;
  }

  /**
   * @return {string}
   */
  getName(): string {
    return this.name;
  }

  /**
   * @param {string} name
   */
  setName(name: string) {
    this.name = name;
  }

  /**
   * @return {string}
   */
  getReferenceType(): string {
    return this.referenceType;
  }

  /**
   * @param {ReferenceTypes} referenceType
   */
  setReferenceType(referenceType: ReferenceTypes) {
    this.referenceType = referenceType;
  }

  /**
   * @return {number}
   */
  getTreeId(): number {
    return this.treeId;
  }

  /**
   * @param {number} treeId
   */
  setTreeId(treeId: number) {
    this.treeId = treeId;
  }

  /**
   * @return {string}
   */
  getPath(): string {
    return this.path;
  }

  /**
   * @param {string} path
   */
  setPath(path: string) {
    this.path = path;
  }

  /**
   * @return {ProxyTypes}
   */
  getProxy(): ProxyTypes {
    return this.proxy;
  }

  /**
   * @param {ProxyTypes} proxy
   */
  setProxy(proxy: ProxyTypes) {
    this.proxy = proxy;
  }

  /**
   * @return {OutcomeJSON} - dictionary that describes this
   */
  toJSON(): OutcomeJSON {
    const outcomeJSON: OutcomeJSON = {
      name: this.name,
      reference_type: this.referenceType,
      tree_id: Number(this.treeId),
      path: this.path,
      _proxy: this.proxy,
    };
    if (this.makeInstance) {
      outcomeJSON.make_instance = true;
    }
    return outcomeJSON;
  }

  clone(): Outcome {
    return Outcome.build(this.toJSON());
  }
}
