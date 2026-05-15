#!/usr/bin/env node
import { execSync } from "child_process";
import fs from "fs";
import path from "path";
const element = process.argv[2];
if (!element) {
  console.error("Please specify a technical element name");
  process.exit(1);
}
const validElements = [
  "core",
  "systems-analysis",
  "event-sequence-analysis",
  "data-analysis",
  "plant-operating-states-analysis",
  "initiating-event-analysis",
  "risk-integration",
  "success-criteria",
  "event-sequence-quantification",
  "mechanistic-source-term",
  "radiological-consequence-analysis",
  "integration",
];
if (!validElements.includes(element)) {
  console.error(`Invalid element name. Valid elements are: ${validElements.join(", ")}`);
  process.exit(1);
}
const outputDir = path.join(process.cwd(), "docs", "json-schemas");
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}
function findTsFiles(dir, fileList = []) {
  const files = fs.readdirSync(dir);
  files.forEach((file) => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat.isDirectory()) {
      findTsFiles(filePath, fileList);
    } else if (file.endsWith(".ts")) {
      fileList.push(filePath);
    }
  });
  return fileList;
}
function extractPattern(typeDef) {
  if (!typeDef) return null;
  if (typeDef.type === "string" && typeDef.description) {
    const patternMatch = typeDef.description.match(/tags\.Pattern<"([^"]+)">/);
    if (patternMatch) {
      return patternMatch[1];
    }
  }
  if (typeDef.type === "string" && typeDef.properties && typeDef.properties["typia.tag"]) {
    const tag = typeDef.properties["typia.tag"];
    if (
      tag.properties &&
      tag.properties.schema &&
      tag.properties.schema.properties &&
      tag.properties.schema.properties.pattern
    ) {
      return tag.properties.schema.properties.pattern.const;
    }
  }
  if (typeDef.$ref && typeDef.$ref.startsWith("#/definitions/")) {
    const refType = typeDef.$ref.split("/").pop();
    if (refType === "ReleaseCategoryReference") {
      return "^RC-[A-Za-z0-9_-]+$";
    } else if (refType === "SourceTermDefinitionReference") {
      return "^ST-[0-9]+$";
    } else if (refType === "SystemReference") {
      return "^SYS-[A-Za-z0-9_-]+$";
    } else if (refType === "HumanActionReference") {
      return "^HRA-[0-9]+$";
    } else if (refType === "PlantOperatingStateReference") {
      return "^POS-[A-Z0-9_-]+$";
    }
  }
  return null;
}
function handlePatternTypes(schema, elementDir) {
  const patternTypes = {};
  try {
    const tsFiles = findTsFiles(elementDir).map((file) => path.relative(process.cwd(), file));
    for (const file of tsFiles) {
      try {
        const content = fs.readFileSync(file, "utf8");
        const patternMatches = [
          ...content.matchAll(
            /export\s+type\s+(\w+)\s*=\s*string\s+&\s+tags\.Pattern<"([^"]+)">|export\s+type\s+(\w+)\s*=\s*string\s+&\s+tags\.Pattern<typeof\s+[\w.]+>/g,
          ),
        ];
        for (const match of patternMatches) {
          const typeName = match[1] || match[3];
          let pattern = match[2];
          if (!pattern) {
            const typeRef = match[0].match(/typeof\s+([\w.]+)/);
            if (typeRef) {
              const refName = typeRef[1];
              const patternDefMatch = content.match(new RegExp(`${refName}\\s*=\\s*["'\`]([^"'\`]+)["'\`]`));
              if (patternDefMatch) {
                pattern = patternDefMatch[1];
              }
            }
            if (!pattern) {
              if (typeName === "ReleaseCategoryReference") {
                pattern = "^RC-[A-Za-z0-9_-]+$";
              } else if (typeName === "SourceTermDefinitionReference") {
                pattern = "^ST-[0-9]+$";
              } else if (typeName === "SystemReference") {
                pattern = "^SYS-[A-Za-z0-9_-]+$";
              } else if (typeName === "HumanActionReference") {
                pattern = "^HRA-[0-9]+$";
              } else if (typeName === "PlantOperatingStateReference") {
                pattern = "^POS-[A-Z0-9_-]+$";
              }
            }
          }
          if (pattern) {
            patternTypes[typeName] = pattern;
          }
        }
      } catch (error) {
        console.warn(`Error reading file ${file}: ${error.message}`);
      }
    }
  } catch (error) {
    console.warn(`Error searching for pattern types: ${error.message}`);
  }
  if (schema.definitions) {
    for (const [key, def] of Object.entries(schema.definitions)) {
      if (patternTypes[key]) {
        schema.definitions[key] = {
          type: "string",
          pattern: patternTypes[key],
          description: def.description || `String matching pattern: ${patternTypes[key]}`,
        };
      }
      if (def.properties) {
        for (const [propKey, propDef] of Object.entries(def.properties)) {
          if (propDef.$ref) {
            const refType = propDef.$ref.split("/").pop();
            if (patternTypes[refType]) {
              def.properties[propKey] = {
                type: "string",
                pattern: patternTypes[refType],
                description: propDef.description || `String matching pattern: ${patternTypes[refType]}`,
              };
            }
          }
        }
      }
    }
  }
  return schema;
}
function enhanceSchemaWithPattern(schema, pattern) {
  if (!schema) return schema;
  if (pattern) {
    if (schema.type === "string") {
      schema.pattern = pattern;
    } else if (schema.type === "object") {
      if (schema.properties) {
        for (const [key, value] of Object.entries(schema.properties)) {
          if (value.type === "string" || value.$ref) {
            const propPattern = extractPattern(value);
            if (propPattern) {
              if (value.$ref) {
                schema.properties[key] = {
                  type: "string",
                  pattern: propPattern,
                  description: value.description || `String matching pattern: ${propPattern}`,
                };
              } else {
                value.pattern = propPattern;
              }
            }
          }
        }
      }
      const objPattern = extractPattern(schema);
      if (objPattern) {
        schema.type = "string";
        schema.pattern = objPattern;
        schema.description = schema.description || `String matching pattern: ${objPattern}`;
        delete schema.properties;
        delete schema.required;
        delete schema.allOf;
      }
    }
  }
  return schema;
}
function enhanceRecordSchema(schema) {
  if (!schema) return schema;
  if (schema.type === "object" && schema.additionalProperties) {
    if (schema.additionalProperties.type === "number") {
      schema.additionalProperties = {
        type: "number",
        description: "Value associated with the key",
      };
    } else if (schema.additionalProperties.type === "object") {
      schema.additionalProperties = {
        type: "object",
        description: "Object associated with the key",
        properties: schema.additionalProperties.properties || {},
        required: schema.additionalProperties.required || [],
      };
    } else if (schema.additionalProperties.type === "string") {
      schema.additionalProperties = {
        type: "string",
        description: "String value associated with the key",
      };
    }
  }
  if (schema.$ref && schema.$ref.startsWith("#/definitions/Record<")) {
    const refName = schema.$ref.split("/").pop();
  }
  return schema;
}
function enhanceAllRecordTypes(schema) {
  if (!schema.definitions) return schema;
  const recordTypes = Object.keys(schema.definitions).filter((key) => key.startsWith("Record<"));
  for (const recordType of recordTypes) {
    const recordDef = schema.definitions[recordType];
    if (recordDef.type === "object" && !recordDef.additionalProperties) {
      const match = recordType.match(/Record<([^,]+),\s*([^>]+)>/);
      if (match) {
        const keyType = match[1].trim();
        const valueType = match[2].trim();
        if (valueType === "string") {
          recordDef.additionalProperties = {
            type: "string",
            description: "String value associated with the key",
          };
        } else if (valueType === "number") {
          recordDef.additionalProperties = {
            type: "number",
            description: "Numeric value associated with the key",
          };
        } else if (valueType.startsWith("{") && valueType.endsWith("}")) {
          recordDef.additionalProperties = {
            type: "object",
            description: "Object value associated with the key",
          };
          try {
            const props = valueType.substring(1, valueType.length - 1).split(";");
            const objProps = {};
            for (const prop of props) {
              if (!prop.trim()) continue;
              const [name, type] = prop.split(":").map((p) => p.trim());
              if (name && type) {
                objProps[name] = {
                  type:
                    type === "string" ? "string"
                    : type === "number" ? "number"
                    : "object",
                };
              }
            }
            if (Object.keys(objProps).length > 0) {
              recordDef.additionalProperties.properties = objProps;
            }
          } catch (e) {}
        } else {
          recordDef.additionalProperties = {
            type: "object",
            description: `Value of type ${valueType} associated with the key`,
          };
        }
        if (keyType.includes("Reference")) {
          const patternType = keyType;
          if (patternType === "ReleaseCategoryReference") {
            recordDef.propertyNames = {
              pattern: "^RC-[A-Za-z0-9_-]+$",
            };
          } else if (patternType === "SourceTermDefinitionReference") {
            recordDef.propertyNames = {
              pattern: "^ST-[0-9]+$",
            };
          } else if (patternType === "SystemReference") {
            recordDef.propertyNames = {
              pattern: "^SYS-[A-Za-z0-9_-]+$",
            };
          } else if (patternType === "HumanActionReference") {
            recordDef.propertyNames = {
              pattern: "^HRA-[0-9]+$",
            };
          } else if (patternType === "PlantOperatingStateReference") {
            recordDef.propertyNames = {
              pattern: "^POS-[A-Z0-9_-]+$",
            };
          }
        }
      }
    }
  }
  return schema;
}
try {
  const outputFile = path.join(outputDir, `${element}.json`);
  const mainTsFile = `${element}/${element.split("-").pop()}.ts`;
  console.log(`Generating schema for ${element}...`);
  console.log(`Using file: ${mainTsFile}`);
  const minimalSchema = {
    $schema: "http://json-schema.org/draft-07/schema#",
    id: element,
    title: element,
    definitions: {},
  };
  fs.writeFileSync(outputFile, JSON.stringify(minimalSchema, null, 2));
  const elementDir = path.join(process.cwd(), element);
  if (fs.existsSync(elementDir) && fs.statSync(elementDir).isDirectory()) {
    const tsFiles = findTsFiles(elementDir).map((file) => path.relative(process.cwd(), file));
    console.log(`Found ${tsFiles.length} TypeScript files in ${element} directory and subdirectories.`);
    for (const filePath of tsFiles) {
      console.log(`Processing ${filePath}...`);
      try {
        const fileName = path.basename(filePath).replace(".ts", "");
        const tempOutputFile = path.join(outputDir, `${element}-${fileName}.temp.json`);
        const command = `npx typescript-json-schema ${filePath} "*" --out ${tempOutputFile} --required --strictNullChecks --refs`;
        execSync(command, { stdio: "inherit" });
        if (fs.existsSync(tempOutputFile)) {
          const fileSchema = JSON.parse(fs.readFileSync(tempOutputFile, "utf8"));
          if (fileSchema.definitions && Object.keys(fileSchema.definitions).length > 0) {
            console.log(`Found ${Object.keys(fileSchema.definitions).length} definitions in ${fileName}`);
            const mainSchema = JSON.parse(fs.readFileSync(outputFile, "utf8"));
            for (const [key, value] of Object.entries(fileSchema.definitions)) {
              let enhancedSchema = enhanceSchemaWithPattern(value, extractPattern(value));
              enhancedSchema = enhanceRecordSchema(enhancedSchema);
              mainSchema.definitions[key] = enhancedSchema;
            }
            fs.writeFileSync(outputFile, JSON.stringify(mainSchema, null, 2));
          }
          fs.unlinkSync(tempOutputFile);
        }
      } catch (error) {
        console.warn(`Error processing ${filePath}: ${error.message}`);
      }
    }
    const mainSchema = JSON.parse(fs.readFileSync(outputFile, "utf8"));
    const enhancedSchema = handlePatternTypes(mainSchema, elementDir);
    const finalEnhancedSchema = enhanceAllRecordTypes(enhancedSchema);
    fs.writeFileSync(outputFile, JSON.stringify(finalEnhancedSchema, null, 2));
  }
  const finalSchema = JSON.parse(fs.readFileSync(outputFile, "utf8"));
  if (!finalSchema.definitions || Object.keys(finalSchema.definitions).length === 0) {
    console.warn(`Warning: Generated schema for ${element} appears to be empty.`);
  } else {
    console.log(
      `Schema generated successfully for ${element} with ${Object.keys(finalSchema.definitions).length} definitions.`,
    );
  }
} catch (error) {
  console.error(`Error generating schema for ${element}:`, error);
  process.exit(1);
}
