/**
 * @remarks This file contains the FactorError class which is used to handle errors related to the Factors class. The
 * FactorError class extends the built-in Error class and is used to throw and catch errors that occur when setting and
 * calculating factors in the Factors class.
 */

/**
 * @public FactorError
 *
 * @remarks This class is used to handle errors related to the Factors class. The FactorError class extends the built-in
 * Error class and is used to throw and catch errors that occur when setting and calculating factors in the Factors
 * class.
 */
export default class FactorError extends Error {
  /**
   * @remarks Creates a new FactorError object. This constructor creates a new FactorError object with a specified error
   * message.
   *
   * @param message - The error message.
   */
  constructor(message?: string) {
    super(message);
    this.name = "FactorError";
  }
}
