const { composePlugins, withNx } = require('@nx/webpack');
const webpack = require("webpack");

// Nx plugins for webpack.
module.exports = composePlugins(withNx(), (config) => {
  // Set target to node
  config.target = "node";

  /**
   * Ensure __dirname is not mocked.
   * This allows the use of __dirname in the bundled code.
   */
  config.node = {
    __dirname: false,
  };

  /**
   * Add rule for .node files.
   * This allows webpack to properly handle native Node.js addons.
   */
  config.module.rules.push({
    test: /\.node$/,
    loader: "node-loader",
  });
  
  // Update the webpack config as needed here.
  // e.g. `config.plugins.push(new MyPlugin())`
  return config;
});
