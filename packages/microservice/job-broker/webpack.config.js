/**
 * @fileoverview Webpack configuration this Node.js project using Nx.
 * @requires @nx/webpack
 */

const { composePlugins, withNx } = require("@nx/webpack");

/**
 * Webpack configuration function.
 * @param {Object} config - The initial webpack configuration object.
 * @returns {Object} The modified webpack configuration object.
 */
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

  return config;
});
