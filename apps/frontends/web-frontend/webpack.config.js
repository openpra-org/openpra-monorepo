const { composePlugins, withNx } = require("@nx/webpack");
const { withReact } = require("@nx/react");
const path = require("path");

const allowedHost = process.env.ALLOWED_HOST || "localhost";
const backendUrl = process.env.BACKEND_URL || "http://localhost:8000";

class SuppressCasingWarningsPlugin {
  apply(compiler) {
    compiler.hooks.done.tap("SuppressCasingWarnings", (stats) => {
      stats.compilation.warnings = stats.compilation.warnings.filter(
        (w) => !String(w?.message ?? "").includes("only differ in casing"),
      );
    });
  }
}

module.exports = composePlugins(withNx(), withReact(), (config) => {
  config.resolve = {
    ...config.resolve,
    alias: {
      ...config.resolve?.alias,
      react: path.resolve(__dirname, "node_modules/react"),
      "react-dom": path.resolve(__dirname, "node_modules/react-dom"),
    },
  };
  config.plugins = [...(config.plugins ?? []), new SuppressCasingWarningsPlugin()];
  config.ignoreWarnings = [/only differ in casing/];
  config.devServer = {
    port: 4201,
    allowedHosts: [allowedHost],
    historyApiFallback: true,
    client: { overlay: { errors: true, warnings: false } },
    proxy: [{ context: ["/api"], target: backendUrl, secure: true, changeOrigin: true }],
  };
  return config;
});
