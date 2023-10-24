/**
 * @file FactorError.ts
 * @brief This file contains the FactorError class which is used to handle errors related to the Factors class.
 * @details The FactorError class extends the built-in Error class and is used to throw and catch errors that occur
 * when setting and calculating factors in the Factors class.
 */

/**
 * @class FactorError
 * @brief This class is used to handle errors related to the Factors class.
 * @details The FactorError class extends the built-in Error class and is used to throw and catch errors that occur
 * when setting and calculating factors in the Factors class.
 */
export default class FactorError extends Error {
  /**
   * @brief Creates a new FactorError object.
   * @details This constructor creates a new FactorError object with a specified error message.
   * @param message The error message.
   */
  constructor(message?: string) {
    super(message);
    this.name = "FactorError";
  }
}
