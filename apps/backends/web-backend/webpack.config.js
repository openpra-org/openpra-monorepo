const { composePlugins, withNx } = require("@nx/webpack");

class SuppressCasingWarningsPlugin {
  apply(compiler) {
    compiler.hooks.done.tap("SuppressCasingWarnings", (stats) => {
      stats.compilation.warnings = stats.compilation.warnings.filter(
        (w) => !String(w?.message ?? "").includes("only differ in casing"),
      );
    });
  }
}

module.exports = composePlugins(withNx(), (config) => {
  config.module.rules.push({
    test: /\.node$/,
    loader: "node-loader",
  });
  config.plugins = [...(config.plugins ?? []), new SuppressCasingWarningsPlugin()];
  config.ignoreWarnings = [/only differ in casing/];
  return config;
});
