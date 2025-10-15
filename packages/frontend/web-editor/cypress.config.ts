// TODO:: Handle dangling/unused import
/* eslint-disable import/no-default-export, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call */
import { nxE2EPreset } from "@nx/cypress/plugins/cypress-preset";
import { nxComponentTestingPreset } from "@nx/react/plugins/component-testing";
import { defineConfig } from "cypress";

export default defineConfig({
  e2e: nxE2EPreset(__filename, { cypressDir: "cypress" }),
  component: nxComponentTestingPreset(__filename),
});
