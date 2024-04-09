import { MongoClient, Db, ObjectId, Collection, Document } from "mongodb";

/**
 * @public Represents a class for handling seismic events and their interactions with a MongoDB database.
 */
class SeismicEventDB {
  private readonly client: MongoClient;
  private readonly db: Db;
  private readonly generalInput: Collection;
  private readonly mainshockFt: Collection;

  /**
   * @remarks Initializes a new instance of the SeismicEventDB class with MongoDB connection.
   * @param mongodbUri - The MongoDB connection URI.
   * @param dbName - The name of the database to connect to.
   */
  constructor(mongodbUri: string, dbName: string) {
    this.client = new MongoClient(mongodbUri);
    this.db = this.client.db(dbName);

    this.generalInput = this.db.collection("General_Input");
    this.mainshockFt = this.db.collection("mainshock_ft");
  }

  /**
   * @remarks Generates a mainshock fault tree based on the provided SSC document.
   * @param sscDocument - The SSC document to use for generating the fault tree.
   * @returns The generated mainshock fault tree.
   */
  async generateMainshockFaultTree(sscDocument: Document): Promise<any> {
    const msVector = await this.generalInput.findOne(
      {},
      { projection: { "Mainshock.MS_vector": 1 } },
    );

    if (!msVector) {
      throw new Error("MS_vector is not found in the database.");
    }

    const msVectorValues: number = msVector.Mainshock?.MS_vector;

    if (
      !msVectorValues ||
      !Array.isArray(msVectorValues) ||
      !msVectorValues.every((value) => typeof value === "number")
    ) {
      throw new Error("MS_vector is empty or contains non-numeric values.");
    }

    const room_id = String(sscDocument.room_id);
    const ssc_name = String(sscDocument.name);
    const ssc_description = String(sscDocument.description);
    // @ts-expect-error
    const mainshockFtTemplate: Document = await this.mainshockFt.findOne({
      id: "MSFT",
    });

    this.replacePlaceholders(
      mainshockFtTemplate,
      room_id,
      ssc_name,
      ssc_description,
    );
    this.removeObjectIds(mainshockFtTemplate);

    mainshockFtTemplate.inputs.push(
      ...(await this.createMainshockPgaGate(sscDocument, msVectorValues)),
    );

    return mainshockFtTemplate;
  }

  /**
   * @remarks Creates mainshock PGA gates based on the provided SSC document and mainshock vector values.
   * @param sscDocument - The SSC document containing information about the seismic structural component.
   * @param msVectorValues - An array of mainshock PGA vector values.
   * @returns An array of mainshock gate bins with updated failure model parameters.
   */
  private async createMainshockPgaGate(
    sscDocument: Document,
    msVectorValues: number[],
  ): Promise<Document[]> {
    const room_id = String(sscDocument.room_id);
    const ssc_name = String(sscDocument.name);
    const ssc_description = String(sscDocument.description);
    const correlation_set = String(sscDocument.correlation_set || ""); // Default to "" if not present
    const mainshockGateBins: Document[] = []; // List to store the mainshock_gate_bin objects

    // Check if amplification is set to "Yes" in generalInput
    const amplificationDoc = await this.generalInput.findOne(
      {},
      { projection: { "Mainshock.amplification": 1 } },
    );
    const amplificationEnabled =
      amplificationDoc?.Mainshock?.amplification === "Yes";

    if (sscDocument.type === "SBE") {
      for (let binNum = 0; binNum < msVectorValues.length; binNum++) {
        const msBin = msVectorValues[binNum];
        const mainshockGateBin = await this.mainshockFt.findOne({ id: "MSGT" });

        // @ts-expect-error
        for (const input of mainshockGateBin.inputs) {
          if (input.id === "MS-BE") {
            const failureModelParams = sscDocument.failure_model || {};
            if (amplificationEnabled) {
              failureModelParams.pga =
                msBin * (failureModelParams.amplification || 1);
            } else {
              failureModelParams.pga = msBin;
            }

            input.failure_model = failureModelParams;
            input.correlation_set = correlation_set;

            this.replacePlaceholders(
              mainshockGateBin,
              room_id,
              ssc_name,
              ssc_description,
              msBin,
              binNum + 1, // Adjust for zero-based index
            );
            this.removeObjectIds(mainshockGateBin);
          }
        }
        // Create a deep copy of mainshockGateBin before appending it to the list
        mainshockGateBins.push(JSON.parse(JSON.stringify(mainshockGateBin)));
      }
    }

    return mainshockGateBins;
  }

  // Additional methods (createMainshockPgaGate, replacePlaceholders, removeObjectIds, etc.) would be similarly translated.
  // Due to the complexity and length of the original Python code, only the structure and an example method are provided here.
  // Ensure to implement the rest of the methods following TypeScript syntax and best practices.

  /**
   * Recursively replaces placeholders in a JSON object or array with specific values.
   * @param jsonObj - The JSON object or array to process.
   * @param room_id - The room ID to replace the placeholder with.
   * @param ssc_name - The SSC name to replace the placeholder with.
   * @param ssc_description - The SSC description to replace the placeholder with.
   * @param PGA_bin - The PGA bin value to replace the placeholder with.
   * @param PGA_bin_num - The PGA bin number to replace the placeholder with.
   */
  private replacePlaceholders(
    jsonObj: any,
    room_id?: string,
    ssc_name?: string,
    ssc_description?: string,
    PGA_bin?: number,
    PGA_bin_num?: number,
  ): void {
    if (Array.isArray(jsonObj)) {
      // If jsonObj is an array, process each element
      jsonObj.forEach((item) => {
        this.replacePlaceholders(
          item,
          room_id,
          ssc_name,
          ssc_description,
          PGA_bin,
          PGA_bin_num,
        );
      });
    } else if (typeof jsonObj === "object" && jsonObj !== null) {
      // If jsonObj is an object, process each key-value pair
      Object.entries(jsonObj).forEach(([key, value]) => {
        if (typeof value === "string") {
          // Replace placeholders in the string value
          let newValue = value;
          if (room_id !== undefined)
            newValue = newValue.replace("[room_id]", room_id);
          if (ssc_name !== undefined)
            newValue = newValue.replace("[ssc_name]", ssc_name);
          if (ssc_description !== undefined)
            newValue = newValue.replace("[ssc_description]", ssc_description);
          if (PGA_bin !== undefined)
            newValue = newValue.replace("[PGA_bin]", PGA_bin.toString());
          if (PGA_bin_num !== undefined)
            newValue = newValue.replace(
              "[PGA_bin_num]",
              PGA_bin_num.toString(),
            );
          jsonObj[key] = newValue;
        } else {
          // Recursively process nested objects or arrays
          this.replacePlaceholders(
            value,
            room_id,
            ssc_name,
            ssc_description,
            PGA_bin,
            PGA_bin_num,
          );
        }
      });
    }
    // If jsonObj is neither an object nor an array, do nothing (base case for recursion)
  }

  /**
   * Recursively removes MongoDB ObjectId instances from an object or array, converting them to strings.
   * @param obj - The object or array to process.
   * @returns The processed object or array with ObjectId instances converted to strings.
   */
  private removeObjectIds(obj: any): any {
    if (Array.isArray(obj)) {
      // If it's an array, process each element
      return obj.map((item) => this.removeObjectIds(item));
    } else if (typeof obj === "object" && obj !== null) {
      // If it's an object, process each key-value pair
      const processedObj: Record<string, any> = {};
      for (const [key, value] of Object.entries(obj)) {
        if (value instanceof ObjectId) {
          // If the value is an ObjectId, convert it to a string
          processedObj[key] = value.toHexString();
        } else {
          // Otherwise, recursively process the value
          processedObj[key] = this.removeObjectIds(value);
        }
      }
      return processedObj;
    }
    // If it's neither an array nor an object, return it unchanged
    return obj;
  }

  /**
   * Recursively searches for an object by its ID within a MongoDB document.
   * @param document - The document (or sub-document) to search within. Can be an object or an array.
   * @param targetId - The ID of the object to find.
   * @param path - The current path taken to reach the current document. Used internally for recursion.
   * @returns A tuple containing the found object (or null if not found) and the path to the object as an array of keys and indexes.
   */
  private findObjectById(
    document: Document | Document[],
    targetId: string,
    path: (string | number)[] = [],
  ): [Document | null, (string | number)[]] {
    if (Array.isArray(document)) {
      // If the document is an array, iterate through its elements
      for (let index = 0; index < document.length; index++) {
        const item = document[index];
        const newPath = [...path, index];
        const [result, resultPath] = this.findObjectById(
          item,
          targetId,
          newPath,
        );
        if (result) return [result, resultPath]; // If the object is found, return it along with the path
      }
    } else if (typeof document === "object" && document !== null) {
      // If the document is an object, check if it's the target object
      if ("id" in document && document.id === targetId) {
        return [document, path]; // Object found, return it along with the current path
      }
      // Otherwise, iterate through its properties
      for (const [key, value] of Object.entries(document)) {
        const newPath = [...path, key];
        const [result, resultPath] = this.findObjectById(
          value,
          targetId,
          newPath,
        );
        if (result) return [result, resultPath]; // If the object is found in a nested structure, return it
      }
    }
    // If the object is not found, return null and an empty path
    return [null, []];
  }

  /**
   * Updates the value of a specified parameter within the failure model of a MongoDB document.
   * @param mongodbDocument - The MongoDB document to search within.
   * @param targetId - The ID of the target object whose failure model needs to be updated.
   * @param stringParam - The parameter within the failure model to update.
   * @param newValue - The new value to assign to the specified parameter.
   * @returns The updated MongoDB document, or null if the target object is not found.
   */
  async updateFailureModelValue(
    mongodbDocument: Document,
    targetId: string,
    stringParam: string,
    newValue: any,
  ): Promise<Document | null> {
    const [foundObject, pathToObject] = this.findObjectById(
      mongodbDocument,
      targetId,
    );

    if (foundObject) {
      // Check if the found object has a "failure_model" and update its specified parameter
      if (
        "failure_model" in foundObject &&
        typeof foundObject.failure_model === "object"
      ) {
        foundObject.failure_model[stringParam] = newValue;

        // Update the original document with the modified object
        let currentObject: any = mongodbDocument;
        for (const step of pathToObject.slice(0, -1)) {
          currentObject = currentObject[step];
        }
        currentObject[pathToObject[pathToObject.length - 1]] = foundObject;

        // Return the updated document
        return mongodbDocument;
      }
    }

    // Return null if the target ID is not found in the document
    return null;
  }

  /**
   * Updates the "inputs" field of a MongoDB document by appending new objects to it.
   * @param mongodbDocument - The MongoDB document to search within.
   * @param targetId - The ID of the target object whose "inputs" field needs to be updated.
   * @param newObjects - The new objects to append to the "inputs" field.
   * @returns The updated MongoDB document, or null if the target object is not found or if "inputs" is not a list.
   */
  async updateInputs(
    mongodbDocument: Document,
    targetId: string,
    newObjects: any[],
  ): Promise<Document | null> {
    const [foundObject, pathToObject] = this.findObjectById(
      mongodbDocument,
      targetId,
    );

    if (foundObject) {
      // Check if the found object has "inputs" and ensure it's a list
      if ("inputs" in foundObject && Array.isArray(foundObject.inputs)) {
        // Append the new objects to the "inputs" list
        foundObject.inputs.push(...newObjects);

        // Update the original document with the modified "inputs"
        let currentObject: any = mongodbDocument;
        for (const step of pathToObject.slice(0, -1)) {
          currentObject = currentObject[step];
        }
        currentObject[pathToObject[pathToObject.length - 1]] = foundObject;

        // Return the updated document
        return mongodbDocument;
      }
    }

    // Return null if the target ID is not found or if "inputs" is not a list
    return null;
  }

  /**
   * Extracts a specific object from a MongoDB document based on a given key.
   * @param mongodbDoc - The MongoDB document from which to extract the object.
   * @param extractedObj - The key of the object to extract.
   * @returns The extracted object if found, or null otherwise.
   */
  private extractObjectMongoDB(
    mongodbDoc: Document,
    extractedObj: string,
  ): any | null {
    if (mongodbDoc.hasOwnProperty(extractedObj)) {
      const obj = mongodbDoc[extractedObj];
      return obj;
    } else {
      return null;
    }
  }

  private correlationClass(): void {
    return;
  }
}

export { SeismicEventDB };
