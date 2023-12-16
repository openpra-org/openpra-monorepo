export type ConstantJSON = {
  value: boolean;
};

class Constant {
  private value: boolean;

  /**
   * @param {ConstantJSON} obj - dictionary object to parse.
   * @returns {Constant}
   */
  static build(obj: ConstantJSON): Constant {
    return new Constant(obj.value);
  }

  /**
   * @param {boolean} value
   */
  constructor(value: boolean) {
    this.value = value;
  }

  /**
   * @returns {boolean}
   */
  getValue(): boolean {
    return this.value;
  }

  /**
   * @param {boolean} value
   */
  setValue(value: boolean) {
    this.value = value;
  }

  /**
   * @returns {ConstantJSON} - dictionary object that describes this
   */
  toJSON(): ConstantJSON {
    return {
      value: JSON.parse(String(this.value)),
    };
  }

  clone(): Constant {
    return Constant.build(this.toJSON());
  }
}
