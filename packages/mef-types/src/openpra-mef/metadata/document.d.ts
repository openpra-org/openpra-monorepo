/**
 * The version of the document
 */
export type SemanticVersionSchema = string;

/**
 * AdaptedSchema.org DigitalDocument metadata for a document
 */
export interface DigitalDocumentAdaptedDocumentMetadata {
  /**
   * The time the document was created
   */
  dateCreated: string;
  /**
   * The last time the document was modified
   */
  dateModified?: string;
  version: SemanticVersionSchema;
  /**
   * The people or systems that created the document
   */
  creator?: string[];
  /**
   * The people or systems that contributed to the document
   */
  contributor?: string[];
  /**
   * The people or systems that reviewed the document
   */
  reviewedBy?: string[];
  /**
   * The license under which the document is released
   */
  license?: string;
}
