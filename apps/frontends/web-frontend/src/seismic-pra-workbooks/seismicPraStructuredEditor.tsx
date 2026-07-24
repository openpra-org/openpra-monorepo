import { type JSX, useMemo, useState } from "react";
import { z } from "zod";
import { POSIcon } from "../pos-workbooks/posIcons";
import { Drawer } from "./seismicPraFields";

type JsonPrimitive = string | number | boolean | null;
type JsonValue = JsonPrimitive | JsonValue[] | JsonObject;
interface JsonObject { [key: string]: JsonValue }
type EditorPath = (string | number)[];

interface StructuredEditorDrawerProps<S extends z.ZodType> {
  eyebrow: string;
  title: string;
  subtitle: string;
  schema: S;
  value: z.output<S>;
  editable: boolean;
  initialFocus?: EditorPath;
  createAt?: EditorPath;
  onClose: () => void;
  onApply: (value: z.output<S>) => void;
  onRemove?: () => void;
  removeLabel?: string;
}

function humanize(value: string): string {
  return value
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function toJson(value: object): JsonValue {
  return JSON.parse(JSON.stringify(value)) as JsonValue;
}

function isObject(value: JsonValue): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function unwrap(schema: z.ZodType): z.ZodType {
  if (schema instanceof z.ZodOptional || schema instanceof z.ZodNullable || schema instanceof z.ZodDefault) return unwrap(schema.unwrap() as z.ZodType);
  return schema;
}

function normalizeOptionalNulls(schemaInput: z.ZodType, value: JsonValue): JsonValue | undefined {
  if (value === null && schemaInput instanceof z.ZodOptional) return undefined;
  if (value === null && schemaInput instanceof z.ZodNullable) return null;
  const schema = unwrap(schemaInput);
  if (schema instanceof z.ZodObject && isObject(value)) {
    const result: JsonObject = {};
    for (const [key, childValue] of Object.entries(value)) {
      const childSchema = schema.shape[key] as z.ZodType | undefined;
      const normalized = childSchema === undefined ? childValue : normalizeOptionalNulls(childSchema, childValue);
      if (normalized !== undefined) result[key] = normalized;
    }
    return result;
  }
  if (schema instanceof z.ZodArray && Array.isArray(value)) {
    return value.map((item) => normalizeOptionalNulls(schema.element as z.ZodType, item)).filter((item): item is JsonValue => item !== undefined);
  }
  if (schema instanceof z.ZodRecord && isObject(value)) {
    const result: JsonObject = {};
    for (const [key, childValue] of Object.entries(value)) {
      const normalized = normalizeOptionalNulls(schema.valueType as z.ZodType, childValue);
      if (normalized !== undefined) result[key] = normalized;
    }
    return result;
  }
  return value;
}

function defaultFor(schemaInput: z.ZodType, key = ""): JsonValue {
  const schema = unwrap(schemaInput);
  if (schema instanceof z.ZodString) {
    if (key === "uuid" || key.endsWith("Id")) return crypto.randomUUID();
    if (key === "createdAt" || key === "modifiedAt" || key.endsWith("Date")) return new Date().toISOString();
    if (key === "name") return "New record";
    return "";
  }
  if (schema instanceof z.ZodNumber) return 0;
  if (schema instanceof z.ZodBoolean) return false;
  if (schema instanceof z.ZodEnum) return schema.options[0] ?? "";
  if (schema instanceof z.ZodLiteral) return Array.from(schema.values)[0] as JsonPrimitive;
  if (schema instanceof z.ZodArray) return [];
  if (schema instanceof z.ZodObject) {
    const result: JsonObject = {};
    for (const [childKey, childSchema] of Object.entries(schema.shape)) {
      if (!(childSchema instanceof z.ZodOptional)) result[childKey] = defaultFor(childSchema as z.ZodType, childKey);
    }
    return result;
  }
  if (schema instanceof z.ZodRecord) return {};
  if (schema instanceof z.ZodTuple) return schema.def.items.map((item) => defaultFor(item as z.ZodType));
  if (schema instanceof z.ZodUnion) return defaultFor(schema.options[0] as z.ZodType, key);
  if (schema instanceof z.ZodUnknown) return {};
  return "";
}

function valueAt(root: JsonValue, path: EditorPath): JsonValue {
  let current = root;
  for (const segment of path) {
    if (Array.isArray(current) && typeof segment === "number") current = current[segment] ?? null;
    else if (isObject(current) && typeof segment === "string") current = current[segment] ?? null;
    else return null;
  }
  return current;
}

function schemaAt(root: z.ZodType, path: EditorPath): z.ZodType {
  let current = unwrap(root);
  for (const segment of path) {
    if (current instanceof z.ZodObject && typeof segment === "string") current = unwrap(current.shape[segment] as z.ZodType);
    else if (current instanceof z.ZodArray && typeof segment === "number") current = unwrap(current.element as z.ZodType);
    else if (current instanceof z.ZodRecord && typeof segment === "string") current = unwrap(current.valueType as z.ZodType);
    else if (current instanceof z.ZodTuple && typeof segment === "number") current = unwrap(current.def.items[segment] as z.ZodType);
  }
  return current;
}

function replaceAt(root: JsonValue, path: EditorPath, next: JsonValue): JsonValue {
  if (path.length === 0) return next;
  const [head, ...tail] = path;
  if (Array.isArray(root) && typeof head === "number") {
    const copy = [...root];
    copy[head] = replaceAt(copy[head] ?? null, tail, next);
    return copy;
  }
  if (isObject(root) && typeof head === "string") return { ...root, [head]: replaceAt(root[head] ?? null, tail, next) };
  return root;
}

function removeAt(root: JsonValue, path: EditorPath): JsonValue {
  if (path.length === 0) return root;
  const parentPath = path.slice(0, -1);
  const index = path[path.length - 1];
  const parent = valueAt(root, parentPath);
  if (Array.isArray(parent) && typeof index === "number") return replaceAt(root, parentPath, parent.filter((_, itemIndex) => itemIndex !== index));
  if (isObject(parent) && typeof index === "string") {
    const copy = { ...parent };
    delete copy[index];
    return replaceAt(root, parentPath, copy);
  }
  return root;
}

function removeStructuredRecord<S extends z.ZodType>(value: z.output<S>, path: EditorPath): z.output<S> {
  return removeAt(toJson(value as object), path) as z.output<S>;
}

function initialEditorState<S extends z.ZodType>(schema: S, value: z.output<S>, initialFocus: EditorPath, createAt?: EditorPath): { draft: JsonValue; focus: EditorPath } {
  const serialized = toJson(value as object);
  const draft = normalizeOptionalNulls(schema, serialized) ?? serialized;
  if (createAt === undefined) return { draft, focus: initialFocus };
  const collection = valueAt(draft, createAt);
  const collectionSchema = unwrap(schemaAt(schema, createAt));
  if (!Array.isArray(collection) || !(collectionSchema instanceof z.ZodArray)) return { draft, focus: createAt };
  const index = collection.length;
  return {
    draft: replaceAt(draft, createAt, [...collection, defaultFor(collectionSchema.element as z.ZodType)]),
    focus: [...createAt, index],
  };
}

function needsTextarea(key: string): boolean {
  return /(description|basis|method|review|treatment|justification|limitation|approach|impact|insight|result|scope|process|evidence|summary|conclusion|documentation|uncertainty|assumption|responsibilit|qualification|implementation|validity|sufficiency|coverage|interpretation)/i.test(key);
}

function PrimitiveControl({ schema: inputSchema, fieldKey, value, editable, onChange }: { schema: z.ZodType; fieldKey: string; value: JsonValue; editable: boolean; onChange: (value: JsonValue) => void }): JSX.Element {
  const schema = unwrap(inputSchema);
  const id = `seismic-editor-${fieldKey.replace(/[^a-z0-9]/gi, "-").toLowerCase()}`;
  if (schema instanceof z.ZodBoolean) {
    return <label className="sstructured__check" htmlFor={id}><input id={id} type="checkbox" checked={value === true} disabled={!editable} onChange={(event) => onChange(event.target.checked)} /><span>{value === true ? "Yes" : "No"}</span></label>;
  }
  if (schema instanceof z.ZodEnum) {
    return <select id={id} className="posfield__select" value={typeof value === "string" ? value : ""} disabled={!editable} onChange={(event) => onChange(event.target.value)}>{schema.options.map((option) => <option value={String(option)} key={String(option)}>{humanize(String(option))}</option>)}</select>;
  }
  if (schema instanceof z.ZodNumber) {
    return <input id={id} className="posfield__input posmono" type="number" step="any" value={typeof value === "number" ? value : 0} disabled={!editable} onChange={(event) => onChange(Number(event.target.value))} />;
  }
  const text = typeof value === "string" ? value : value === null ? "" : String(value);
  if (fieldKey === "uuid") return <code className="sstructured__id">{text}</code>;
  if (needsTextarea(fieldKey)) return <textarea id={id} className="posfield__textarea" rows={5} value={text} disabled={!editable} onChange={(event) => onChange(event.target.value)} />;
  return <input id={id} className="posfield__input" value={text} disabled={!editable} onChange={(event) => onChange(event.target.value)} />;
}

function isPrimitiveSchema(inputSchema: z.ZodType): boolean {
  const schema = unwrap(inputSchema);
  return schema instanceof z.ZodString || schema instanceof z.ZodNumber || schema instanceof z.ZodBoolean || schema instanceof z.ZodEnum || schema instanceof z.ZodLiteral;
}

function recordLabel(value: JsonValue, index: number): string {
  if (!isObject(value)) return `Item ${index + 1}`;
  for (const key of ["name", "title", "description", "requirement", "eventDateOrAge", "source", "assumption", "alternative"]) {
    const candidate = value[key];
    if (typeof candidate === "string" && candidate.trim().length > 0) return candidate;
  }
  return `Record ${index + 1}`;
}

function recordMeta(value: JsonValue): string {
  if (!isObject(value)) return "";
  for (const key of ["uuid", "id", "type", "status", "result", "disposition", "sourceType", "hazardType", "modelKind"]) {
    const candidate = value[key];
    if (typeof candidate === "string" && candidate.trim().length > 0) return key === "uuid" || key === "id" ? candidate : humanize(candidate);
  }
  return `${Object.keys(value).length} fields`;
}

function inferredSchema(value: JsonValue): z.ZodType {
  if (typeof value === "boolean") return z.boolean();
  if (typeof value === "number") return z.number();
  return z.string();
}

function StructuredEditorDrawer<S extends z.ZodType>({ eyebrow, title, subtitle, schema, value, editable, initialFocus = [], createAt, onClose, onApply, onRemove, removeLabel = "Remove record" }: StructuredEditorDrawerProps<S>): JSX.Element {
  const [initialState] = useState(() => initialEditorState(schema, value, initialFocus, createAt));
  const [draft, setDraft] = useState<JsonValue>(initialState.draft);
  const [focus, setFocus] = useState<EditorPath>(initialState.focus);
  const [error, setError] = useState<string | null>(null);
  const rootDepth = createAt === undefined ? initialFocus.length : initialState.focus.length;
  const currentSchema = useMemo(() => schemaAt(schema, focus), [schema, focus]);
  const currentValue = valueAt(draft, focus);
  const pathLabel = (path: EditorPath): string => {
    if (path.length === rootDepth) return title;
    const segment = path[path.length - 1];
    const pathValue = valueAt(draft, path);
    return typeof segment === "number" ? recordLabel(pathValue, segment) : humanize(String(segment));
  };
  const focusTitle = pathLabel(focus);

  function updateCurrent(next: JsonValue): void {
    setDraft((current) => replaceAt(current, focus, next));
    setError(null);
  }

  function save(): void {
    const parsed = currentSchema.safeParse(currentValue);
    if (!parsed.success) {
      setError(z.prettifyError(parsed.error));
      return;
    }
    onApply(draft as z.output<S>);
    onClose();
  }

  function renderPrimitiveArray(arraySchema: z.ZodArray, arrayValue: JsonValue[]): JSX.Element {
    return <div className="sstructured__collection">
      <div className="sstructured__collection-head"><div><span className="sstructured__caption">Items</span><strong>{arrayValue.length} item{arrayValue.length === 1 ? "" : "s"}</strong></div>{editable && <button type="button" className="posnav__btn posnav__btn--sm posnav__btn--primary" onClick={() => updateCurrent([...arrayValue, defaultFor(arraySchema.element as z.ZodType)])}><POSIcon.Plus /> Add item</button>}</div>
      <div className="sstructured__primitive-list">{arrayValue.map((item, index) => <div className="sstructured__primitive-row" key={index}><PrimitiveControl schema={arraySchema.element as z.ZodType} fieldKey={`${String(focus[focus.length - 1] ?? "item")}-${index}`} value={item} editable={editable} onChange={(next) => updateCurrent(arrayValue.map((entry, entryIndex) => entryIndex === index ? next : entry))} />{editable && <button type="button" className="posdrawer__close" aria-label="Remove item" onClick={() => updateCurrent(arrayValue.filter((_, entryIndex) => entryIndex !== index))}><POSIcon.Close /></button>}</div>)}</div>
    </div>;
  }

  function renderObject(objectSchema: z.ZodObject, objectValue: JsonObject): JSX.Element {
    const entries = Object.entries(objectSchema.shape);
    const primitiveEntries = entries.filter(([, childSchema]) => isPrimitiveSchema(childSchema as z.ZodType));
    const primitiveArrays = entries.filter(([, childSchema]) => {
      const unwrapped = unwrap(childSchema as z.ZodType);
      return unwrapped instanceof z.ZodArray && isPrimitiveSchema(unwrapped.element as z.ZodType);
    });
    const nestedEntries = entries.filter(([, childSchema]) => {
      const unwrapped = unwrap(childSchema as z.ZodType);
      return !isPrimitiveSchema(unwrapped) && !(unwrapped instanceof z.ZodArray && isPrimitiveSchema(unwrapped.element as z.ZodType));
    });
    return <>
      {primitiveEntries.length > 0 && <div className="sstructured__fields">{primitiveEntries.map(([key, childSchema]) => <div className={`sstructured__field${needsTextarea(key) ? " sstructured__field--wide" : ""}`} key={key}><label className="posfield__label" htmlFor={`seismic-editor-${key}`}>{humanize(key)}</label><PrimitiveControl schema={childSchema as z.ZodType} fieldKey={key} value={objectValue[key] ?? defaultFor(childSchema as z.ZodType, key)} editable={editable} onChange={(next) => updateCurrent({ ...objectValue, [key]: next })} /></div>)}</div>}
      {primitiveArrays.map(([key, childSchema]) => {
        const arraySchema = unwrap(childSchema as z.ZodType) as z.ZodArray;
        const arrayValue = Array.isArray(objectValue[key]) ? objectValue[key] as JsonValue[] : [];
        return <div className="sstructured__subsection" key={key}><div className="sstructured__subhead"><div><span className="sstructured__caption">{humanize(key)}</span><strong>{arrayValue.length} item{arrayValue.length === 1 ? "" : "s"}</strong></div>{editable && <button type="button" className="posnav__btn posnav__btn--sm posnav__btn--primary" onClick={() => updateCurrent({ ...objectValue, [key]: [...arrayValue, defaultFor(arraySchema.element as z.ZodType)] })}><POSIcon.Plus /> Add {humanize(key).replace(/s$/, "")}</button>}</div>{renderInlinePrimitiveArray(key, arraySchema, arrayValue, objectValue)}</div>;
      })}
      {nestedEntries.length > 0 && <div className="sstructured__navlist">{nestedEntries.map(([key, childSchema]) => {
        const childValue = objectValue[key] ?? defaultFor(childSchema as z.ZodType, key);
        const count = Array.isArray(childValue) ? childValue.length : isObject(childValue) ? Object.keys(childValue).length : 0;
        return <button type="button" className="sstructured__navrow" key={key} onClick={() => setFocus([...focus, key])}><span><strong>{humanize(key)}</strong><small>{Array.isArray(childValue) ? `${count} record${count === 1 ? "" : "s"}` : `${count} fields`}</small></span><POSIcon.ArrowR /></button>;
      })}</div>}
    </>;
  }

  function renderInlinePrimitiveArray(key: string, arraySchema: z.ZodArray, arrayValue: JsonValue[], objectValue: JsonObject): JSX.Element {
    return <div className="sstructured__primitive-list">
      {arrayValue.map((item, index) => <div className="sstructured__primitive-row" key={index}><PrimitiveControl schema={arraySchema.element as z.ZodType} fieldKey={`${key}-${index}`} value={item} editable={editable} onChange={(next) => updateCurrent({ ...objectValue, [key]: arrayValue.map((entry, entryIndex) => entryIndex === index ? next : entry) })} />{editable && <button type="button" className="posdrawer__close" aria-label="Remove item" onClick={() => updateCurrent({ ...objectValue, [key]: arrayValue.filter((_, entryIndex) => entryIndex !== index) })}><POSIcon.Close /></button>}</div>)}
    </div>;
  }

  function renderArray(arraySchema: z.ZodArray, arrayValue: JsonValue[]): JSX.Element {
    if (isPrimitiveSchema(arraySchema.element as z.ZodType)) return renderPrimitiveArray(arraySchema, arrayValue);
    return <div className="sstructured__collection">
      <div className="sstructured__collection-head"><div><span className="sstructured__caption">Collection</span><strong>{arrayValue.length} record{arrayValue.length === 1 ? "" : "s"}</strong></div>{editable && <button type="button" className="posnav__btn posnav__btn--sm posnav__btn--primary" onClick={() => updateCurrent([...arrayValue, defaultFor(arraySchema.element as z.ZodType)])}><POSIcon.Plus /> Add record</button>}</div>
      {arrayValue.length === 0 ? <div className="sstructured__empty"><strong>No records yet</strong><span>Add the first record to complete this section.</span></div> : <div className="sstructured__records">{arrayValue.map((item, index) => <div className="sstructured__record" key={index}><button type="button" className="sstructured__record-open" onClick={() => setFocus([...focus, index])}><span><strong>{recordLabel(item, index)}</strong><small>{recordMeta(item)}</small></span><POSIcon.ArrowR /></button>{editable && <button type="button" className="posdrawer__close" aria-label={`Remove ${recordLabel(item, index)}`} onClick={() => setDraft((current) => removeAt(current, [...focus, index]))}><POSIcon.Close /></button>}</div>)}</div>}
    </div>;
  }

  function renderRecord(recordSchema: z.ZodRecord, recordValue: JsonObject): JSX.Element {
    const entries = Object.entries(recordValue);
    return <div className="sstructured__collection">
      <div className="sstructured__collection-head"><div><span className="sstructured__caption">Keyed values</span><strong>{entries.length} entr{entries.length === 1 ? "y" : "ies"}</strong></div>{editable && <button type="button" className="posnav__btn posnav__btn--sm posnav__btn--primary" onClick={() => { let key = "newKey"; let suffix = 1; while (key in recordValue) { key = `newKey${suffix}`; suffix += 1; } updateCurrent({ ...recordValue, [key]: defaultFor(recordSchema.valueType as z.ZodType) }); }}><POSIcon.Plus /> Add entry</button>}</div>
      {entries.map(([key, entryValue]) => <div className="sstructured__record" key={key}><button type="button" className="sstructured__record-open" onClick={() => setFocus([...focus, key])}><span><strong>{humanize(key)}</strong><small>{recordMeta(entryValue)}</small></span><POSIcon.ArrowR /></button>{editable && <button type="button" className="posdrawer__close" aria-label={`Remove ${key}`} onClick={() => setDraft((current) => removeAt(current, [...focus, key]))}><POSIcon.Close /></button>}</div>)}
    </div>;
  }

  function renderTuple(tupleSchema: z.ZodTuple, tupleValue: JsonValue[]): JSX.Element {
    return <div className="sstructured__fields">{tupleSchema.def.items.map((itemSchema, index) => <div className="sstructured__field" key={index}><span className="posfield__label">{index === 0 ? "Lower" : index === 1 ? "Upper" : `Value ${index + 1}`}</span><PrimitiveControl schema={itemSchema as z.ZodType} fieldKey={`tuple-${index}`} value={tupleValue[index] ?? defaultFor(itemSchema as z.ZodType)} editable={editable} onChange={(next) => updateCurrent(tupleValue.map((item, itemIndex) => itemIndex === index ? next : item))} /></div>)}</div>;
  }

  function renderDynamic(dynamicValue: JsonValue): JSX.Element {
    if (Array.isArray(dynamicValue)) {
      return <div className="sstructured__collection">
        <div className="sstructured__collection-head"><div><span className="sstructured__caption">Flexible collection</span><strong>{dynamicValue.length} item{dynamicValue.length === 1 ? "" : "s"}</strong></div>{editable && <button type="button" className="posnav__btn posnav__btn--sm posnav__btn--primary" onClick={() => updateCurrent([...dynamicValue, ""])}><POSIcon.Plus /> Add item</button>}</div>
        <div className="sstructured__records">{dynamicValue.map((item, index) => isObject(item) || Array.isArray(item) ? <div className="sstructured__record" key={index}><button type="button" className="sstructured__record-open" onClick={() => setFocus([...focus, index])}><span><strong>{recordLabel(item, index)}</strong><small>{recordMeta(item)}</small></span><POSIcon.ArrowR /></button>{editable && <button type="button" className="posdrawer__close" aria-label="Remove item" onClick={() => updateCurrent(dynamicValue.filter((_, itemIndex) => itemIndex !== index))}><POSIcon.Close /></button>}</div> : <div className="sstructured__primitive-row" key={index}><PrimitiveControl schema={inferredSchema(item)} fieldKey={`dynamic-${index}`} value={item} editable={editable} onChange={(next) => updateCurrent(dynamicValue.map((entry, itemIndex) => itemIndex === index ? next : entry))} />{editable && <button type="button" className="posdrawer__close" aria-label="Remove item" onClick={() => updateCurrent(dynamicValue.filter((_, itemIndex) => itemIndex !== index))}><POSIcon.Close /></button>}</div>)}</div>
      </div>;
    }
    if (isObject(dynamicValue)) {
      const entries = Object.entries(dynamicValue);
      return <div className="sstructured__collection">
        <div className="sstructured__collection-head"><div><span className="sstructured__caption">Flexible fields</span><strong>{entries.length} field{entries.length === 1 ? "" : "s"}</strong></div>{editable && <button type="button" className="posnav__btn posnav__btn--sm posnav__btn--primary" onClick={() => { let key = "newField"; let suffix = 1; while (key in dynamicValue) { key = `newField${suffix}`; suffix += 1; } updateCurrent({ ...dynamicValue, [key]: "" }); }}><POSIcon.Plus /> Add field</button>}</div>
        <div className="sstructured__fields">{entries.map(([key, item]) => isObject(item) || Array.isArray(item) ? <button type="button" className="sstructured__navrow" key={key} onClick={() => setFocus([...focus, key])}><span><strong>{humanize(key)}</strong><small>{recordMeta(item)}</small></span><POSIcon.ArrowR /></button> : <div className="sstructured__field" key={key}><label className="posfield__label" htmlFor={`seismic-editor-dynamic-${key}`}>{humanize(key)}</label><div className="sstructured__primitive-row"><PrimitiveControl schema={inferredSchema(item)} fieldKey={`dynamic-${key}`} value={item} editable={editable} onChange={(next) => updateCurrent({ ...dynamicValue, [key]: next })} />{editable && <button type="button" className="posdrawer__close" aria-label={`Remove ${key}`} onClick={() => { const next = { ...dynamicValue }; delete next[key]; updateCurrent(next); }}><POSIcon.Close /></button>}</div></div>)}</div>
      </div>;
    }
    return <PrimitiveControl schema={inferredSchema(dynamicValue)} fieldKey={String(focus[focus.length - 1] ?? "value")} value={dynamicValue} editable={editable} onChange={updateCurrent} />;
  }

  function renderCurrent(): JSX.Element {
    const activeSchema = unwrap(currentSchema);
    if (activeSchema instanceof z.ZodObject) return renderObject(activeSchema, isObject(currentValue) ? currentValue : defaultFor(activeSchema) as JsonObject);
    if (activeSchema instanceof z.ZodArray) return renderArray(activeSchema, Array.isArray(currentValue) ? currentValue : []);
    if (activeSchema instanceof z.ZodRecord) return renderRecord(activeSchema, isObject(currentValue) ? currentValue : {});
    if (activeSchema instanceof z.ZodTuple) return renderTuple(activeSchema, Array.isArray(currentValue) ? currentValue : []);
    if (activeSchema instanceof z.ZodUnion) {
      const selected = activeSchema.options.map((option) => option as z.ZodType).find((option) => option.safeParse(currentValue).success) ?? activeSchema.options[0] as z.ZodType;
      if (selected instanceof z.ZodObject) return renderObject(selected, isObject(currentValue) ? currentValue : defaultFor(selected) as JsonObject);
      return renderDynamic(currentValue);
    }
    if (activeSchema instanceof z.ZodUnknown) return renderDynamic(currentValue);
    return <PrimitiveControl schema={activeSchema} fieldKey={String(focus[focus.length - 1] ?? "value")} value={currentValue} editable={editable} onChange={updateCurrent} />;
  }

  return <Drawer eyebrow={eyebrow} title={focusTitle} subtitle={focus.length === rootDepth ? subtitle : `${title} · complete record editor`} onClose={onClose} footer={<>{error !== null && <span className="sstructured__footer-error">Resolve validation errors before saving.</span>}<button type="button" className="posnav__btn" onClick={onClose}>Cancel</button>{editable && <button type="button" className="posnav__btn posnav__btn--primary" onClick={save}><POSIcon.Check /> Save changes</button>}</>}>
    {focus.length > rootDepth && <button type="button" className="sstructured__back" onClick={() => setFocus(focus.slice(0, -1))}><POSIcon.ArrowL /> Back to {pathLabel(focus.slice(0, -1))}</button>}
    <div className="sstructured__context"><span>{focus.length === rootDepth ? "Complete section" : pathLabel(focus)}</span>{!editable && <span className="posbadge">Read only</span>}</div>
    {renderCurrent()}
    {error !== null && <pre className="sstructured__error">{error}</pre>}
    {editable && onRemove !== undefined && <div className="poscard sstructured__remove"><div className="poscard__head"><h3 className="poscard__title">{removeLabel}</h3></div><p className="posfield__hint">This removes the selected entry from the Seismic PRA workbook.</p><button type="button" className="posnav__btn posnav__btn--sm" onClick={() => { onRemove(); onClose(); }}><POSIcon.Close /> {removeLabel}</button></div>}
  </Drawer>;
}

export { removeStructuredRecord, StructuredEditorDrawer, type EditorPath, type JsonValue };
