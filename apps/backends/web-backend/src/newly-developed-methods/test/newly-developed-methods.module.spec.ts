import { readdirSync, readFileSync } from "fs";
import { extname, join, relative } from "path";
import { MODULE_METADATA } from "@nestjs/common/constants";
import { BayesianNetworkModule } from "../bayesian-network/bayesian-network.module";
import { EventTreeModule } from "../event-tree/event-tree.module";
import { FaultTreeModule } from "../fault-tree/fault-tree.module";
import { HybridCausalLogicModule } from "../hybrid-causal-logic/hybrid-causal-logic.module";
import { NewlyDevelopedMethodsModule } from "../newly-developed-methods.module";
import { NewlyDevelopedMethodsSharedModule } from "../shared/newly-developed-methods-shared.module";
import { PraetorAnalysisClient } from "../shared/praetor-analysis.client";
import { WorkbookDependencyDiscoveryService } from "../shared/workbook-dependency-discovery.service";
import { WorkbookAnalysisRunsService } from "../shared/workbook-analysis-runs.service";
import { WorkbooksModule } from "../../workbooks/workbooks.module";
import { WorkbookModelAccessService } from "../../workbooks/workbook-model-access.service";

interface SourceViolation {
  file: string;
  rule: string;
}

const METHOD_BACKEND_ROOT = join(__dirname, "..");

function productionTypeScriptFiles(root: string): string[] {
  return readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const path = join(root, entry.name);
    if (entry.isDirectory()) {
      return entry.name === "test" ? [] : productionTypeScriptFiles(path);
    }
    return extname(entry.name) === ".ts" ? [path] : [];
  });
}

function findViolations(
  files: string[],
  rules: readonly { name: string; pattern: RegExp }[],
): SourceViolation[] {
  return files.flatMap((file) => {
    const source = readFileSync(file, "utf8");
    return rules
      .filter(({ pattern }) => pattern.test(source))
      .map(({ name }) => ({ file: relative(METHOD_BACKEND_ROOT, file), rule: name }));
  });
}

describe("NewlyDevelopedMethodsModule", () => {
  it("composes a separate backend module for every planned method area", () => {
    expect(Reflect.getMetadata(MODULE_METADATA.IMPORTS, NewlyDevelopedMethodsModule)).toEqual([
      NewlyDevelopedMethodsSharedModule,
      FaultTreeModule,
      BayesianNetworkModule,
      EventTreeModule,
      HybridCausalLogicModule,
    ]);
  });

  it("does not register project-level method-model persistence or routes", () => {
    const projectRoute = ["projects", ":projectId", "method-models"].join("/");
    const collectionName = ["method", "models"].join("_");
    const violations = findViolations(productionTypeScriptFiles(METHOD_BACKEND_ROOT), [
      { name: "project method-model route", pattern: new RegExp(projectRoute) },
      { name: "project method-model collection", pattern: new RegExp(collectionName) },
      { name: "project method-model controller", pattern: /MethodModelsController/ },
      { name: "project method-model service", pattern: /MethodModelsService/ },
    ]);

    expect(violations).toEqual([]);
    expect(
      Reflect.getMetadata(MODULE_METADATA.CONTROLLERS, NewlyDevelopedMethodsSharedModule) ?? [],
    ).toEqual([]);
    expect(Reflect.getMetadata(MODULE_METADATA.PROVIDERS, NewlyDevelopedMethodsSharedModule)).toEqual([
      PraetorAnalysisClient,
      WorkbookDependencyDiscoveryService,
      WorkbookAnalysisRunsService,
    ]);
  });

  it("imports the shared workbook authorization boundary for future analysis execution", () => {
    const sharedImports = Reflect.getMetadata(
      MODULE_METADATA.IMPORTS,
      NewlyDevelopedMethodsSharedModule,
    ) as unknown[];
    const workbookExports = Reflect.getMetadata(
      MODULE_METADATA.EXPORTS,
      WorkbooksModule,
    ) as unknown[];

    expect(sharedImports).toContain(WorkbooksModule);
    expect(workbookExports).toContain(WorkbookModelAccessService);
  });

  it("does not register a project-level fault-tree basic-event catalogue", () => {
    const projectRoute = ["projects", ":projectId", "fault-tree-basic-event-catalogue"].join(
      "/",
    );
    const collectionName = ["fault", "tree", "basic", "event", "catalogues"].join("_");
    const violations = findViolations(productionTypeScriptFiles(METHOD_BACKEND_ROOT), [
      { name: "project FT catalogue route", pattern: new RegExp(projectRoute) },
      { name: "project FT catalogue collection", pattern: new RegExp(collectionName) },
      {
        name: "project FT catalogue controller",
        pattern: /FaultTreeBasicEventCataloguesController/,
      },
      { name: "project FT catalogue service", pattern: /FaultTreeBasicEventCataloguesService/ },
      { name: "project FT catalogue record", pattern: /FaultTreeBasicEventCatalogueRecord/ },
    ]);

    expect(violations).toEqual([]);
    expect(Reflect.getMetadata(MODULE_METADATA.IMPORTS, FaultTreeModule) ?? []).toEqual([]);
    expect(Reflect.getMetadata(MODULE_METADATA.CONTROLLERS, FaultTreeModule) ?? []).toEqual([]);
    expect(Reflect.getMetadata(MODULE_METADATA.PROVIDERS, FaultTreeModule) ?? []).toEqual([]);
    expect(Reflect.getMetadata(MODULE_METADATA.EXPORTS, FaultTreeModule) ?? []).toEqual([]);
  });
});
