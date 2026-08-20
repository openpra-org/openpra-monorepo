import { QuantifyRequest } from './quantify-request';

/**
 * Schema for the quantification report
 */
export interface QuantifyReport {
  /**
   * ID of the document
   */
  _id?: string;
  /**
   * String-encoded array of OpenPSA MEF XML quantification reports
   */
  results: string[];
}

export interface BinaryQuantifyReport {
  /**
   * ID of the document
   */
  configuration: QuantifyRequest;
  /**
   * String-encoded array of OpenPSA MEF XML quantification reports
   */
  results: string[];
}
