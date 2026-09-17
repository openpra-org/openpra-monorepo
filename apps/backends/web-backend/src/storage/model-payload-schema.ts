import { Document, Schema } from "mongoose";
import { modelPayloadStore, type ModelPayloadReference } from "./model-payload-store";

type Row = Record<string, any>;
type PayloadFields = Record<string, (value: any) => unknown>;
const referencesPath = "modelPayloadReferences";

/** Keep all existing model readers/writers on one storage boundary, including lean queries. */
export function modelPayloadSchema(schema: Schema, fields: PayloadFields): void {
  schema.add({ [referencesPath]: { type: Object, default: undefined } });

  const assign = (row: Row, field: string, value: unknown): void => {
    if (row instanceof Document) {
      // Hydrate persisted values, bypassing immutable-array setters. Packing is
      // only a representation change; application updates remain immutable.
      const isNew = row.isNew;
      row.init({ [field]: value });
      row.isNew = isNew;
      row.markModified(field);
    } else row[field] = value;
  };

  const pack = async (row: Row): Promise<void> => {
    const references = { ...row[referencesPath] };
    // Serialize sequentially: a workbook/snapshot can already be hundreds of MB.
    for (const [field, placeholder] of Object.entries(fields)) {
      if (row instanceof Document && !row.isSelected(field)) continue;
      const reference = await modelPayloadStore.put(row[field]);
      if (reference) {
        references[field] = reference;
        assign(row, field, placeholder(row[field]));
      } else {
        delete references[field];
      }
    }
    assign(row, referencesPath, Object.keys(references).length ? references : undefined);
  };

  const unpack = async (row: Row | null, selectedFields = Object.keys(fields)): Promise<void> => {
    if (!row) return;
    const references = row[referencesPath] as Record<string, ModelPayloadReference> | undefined;
    for (const field of selectedFields) {
      // A projection that omits a field must not download its payload.
      if ((row as Row)[field] === undefined || !references?.[field]) continue;
      assign(row, field, await modelPayloadStore.get(references[field]));
      if (row instanceof Document) row.unmarkModified(field);
    }
  };

  schema.pre("save", async function () {
    if (this.$locals["modelPayloadMetadataOnly"] === true
      || (!this.isNew && Object.keys(fields).some((field) => !this.isSelected(field)))) {
      throw new Error("Save a complete model document, or use an explicit field update");
    }
    // Retain the caller's values if MinIO or MongoDB rejects this save.
    this.$locals["modelPayloadOriginal"] = Object.fromEntries(
      [...Object.keys(fields), referencesPath].map((field) => [field, this.get(field)]),
    );
    await pack(this);
  });
  const restore = (doc: Document): void => {
    const original = doc.$locals["modelPayloadOriginal"] as Row | undefined;
    if (!original) return;
    for (const field of Object.keys(fields)) assign(doc, field, original[field]);
    delete doc.$locals["modelPayloadOriginal"];
  };
  schema.post("save", function (doc) {
    restore(doc);
    for (const field of Object.keys(fields)) doc.unmarkModified(field);
  });
  schema.post("save", function (error: Error, doc: Document, next: (error?: Error) => void) {
    const original = doc.$locals["modelPayloadOriginal"] as Row | undefined;
    if (original) assign(doc, referencesPath, original[referencesPath]);
    restore(doc);
    next(error);
  });

  schema.pre("insertMany", function (next, docs: Row[]) {
    void (async () => {
      for (let index = 0; index < docs.length; index++) {
        docs[index] = { ...docs[index] };
        await pack(docs[index]);
      }
    })().then(() => next(), next);
  });
  schema.post("insertMany", async function (docs: Row[]) {
    for (const doc of docs) await unpack(doc);
  });

  schema.pre(["find", "findOne", "findOneAndUpdate", "findOneAndReplace"], function () {
    const projection = this.projection();
    if (!projection) return;
    const includesPayload = Object.keys(fields).some((field) => projection[field] === 1);
    if (includesPayload) this.select({ [referencesPath]: 1 });
  });
  schema.post(["find", "findOne", "findOneAndUpdate", "findOneAndReplace"], async function (result: Row | Row[] | null) {
    for (const doc of Array.isArray(result) ? result : [result]) {
      if (this.getOptions()["modelPayloadMetadataOnly"] === true) {
        // History lists expose provenance, even when its contribution list is large.
        await unpack(doc, ["target", "contributions"].filter((field) => field in fields));
        if (doc instanceof Document) doc.$locals["modelPayloadMetadataOnly"] = true;
      } else await unpack(doc);
    }
  });

  schema.pre("bulkWrite", function () {
    throw new Error("Model payloads require create, insertMany, save or explicit field updates");
  });

  schema.pre(["updateOne", "updateMany", "findOneAndUpdate", "replaceOne", "findOneAndReplace"], async function () {
    const update = this.getUpdate() as Row | null;
    if (!update) return;
    if (Array.isArray(update)) throw new Error("Model payload updates require ordinary update operators");
    const operation = (this as unknown as { op: string }).op;
    if (operation === "replaceOne" || operation === "findOneAndReplace") {
      await pack(update);
      return;
    }
    for (const [operator, changes] of Object.entries(update)) {
      for (const path of Object.keys(changes as Row)) {
        if (Object.keys(fields).some((field) => path.startsWith(`${field}.`))) {
          throw new Error("Replace the complete model payload when updating its contents");
        }
        if (!(path in fields)) continue;
        if (schema.path(path).options.immutable) throw new Error(`Model payload '${path}' is immutable`);
        if (operator !== "$set" && operator !== "$unset") throw new Error("Unsupported model payload update operator");
      }
    }
    for (const [field, placeholder] of Object.entries(fields)) {
      if (Object.hasOwn(update.$set ?? {}, field)) {
        const reference = await modelPayloadStore.put(update.$set[field]);
        if (reference) {
          update.$set[field] = placeholder(update.$set[field]);
          update.$set[`${referencesPath}.${field}`] = reference;
        } else {
          (update.$unset ??= {})[`${referencesPath}.${field}`] = 1;
        }
      } else if (Object.hasOwn(update.$unset ?? {}, field)) {
        update.$unset[`${referencesPath}.${field}`] = 1;
      }
    }
  });
}

export const workbookPayloadFields: PayloadFields = {
  // These source identifiers are queried when loading linked example workbooks.
  mef: (value: Row) => ({ uuid: value.uuid }),
  previousMefJson: () => "@MinIO",
};
