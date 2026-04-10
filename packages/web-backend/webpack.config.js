const { composePlugins, withNx } = require("@nx/webpack");

// Nx plugins for webpack.
module.exports = composePlugins(withNx(), (config) => {
  // Update the webpack config as needed here.
  // e.g. `config.plugins.push(new MyPlugin())`

  /**
   * Add rule for .node files.
   * This allows webpack to properly handle native Node.js addons.
   */
  config.module.rules.push({
    test: /\.node$/,
    loader: "node-loader",
  });

  return config;
});
