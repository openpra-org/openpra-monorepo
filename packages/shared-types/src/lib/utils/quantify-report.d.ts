import type { QuantifyRequest } from './quantify-request';

/**
 * Schema for the quantification report
 */
export interface QuantifyReport {
  /**
   * BSON type ID of the MongoDB document
   */
  _id?: string;
  /**
   * String-encoded array of OpenPSA MEF XML quantification reports
   */
  results: string[];
}

export interface BinaryQuantifyReport {
  /**
   * BSON type ID of the MongoDB document
   */
  configuration: QuantifyRequest;
  /**
   * String-encoded array of OpenPSA MEF XML quantification reports
   */
  results: string[];
}
