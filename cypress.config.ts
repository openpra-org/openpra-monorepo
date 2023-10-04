import { defineConfig } from "cypress";

export default defineConfig({
  e2e: {
    baseUrl:'http://localhost:8000',
const { defineConfig } = require("cypress");

module.exports = defineConfig({
  e2e: {
    baseUrl: "http://localhost:4200",
  },

  component: {
    devServer: {
      baseUrl: "http://localhost:4200",
      framework: "react",
      bundler: "webpack",
    },
  },

  options: {
    // Your options here...
  },
});
