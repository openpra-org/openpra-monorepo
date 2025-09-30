/**
 * @fileoverview Webpack configuration this Node.js project using Nx.
 * @requires @nx/webpack
 */

const { composePlugins, withNx } = require("@nx/webpack");
const CopyWebpackPlugin = require("copy-webpack-plugin");
const webpack = require("webpack");

// Tell webpack to ignore specific imports that aren't
// used by this package, but imported by NestJS (can cause packing errors).
const lazyImports = [
  "class-transformer",
  "class-transformer/storage", // https://github.com/nestjs/mapped-types/issues/486#issuecomment-932715880
  "class-transformer/cjs/storage",
];

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

  // Add CopyWebpackPlugin to the plugins array
  config.plugins.push(
    new CopyWebpackPlugin({
      patterns: [
        { from: "./node_modules/swagger-ui-dist/swagger-ui.css", to: "." },
        { from: "./node_modules/swagger-ui-dist/swagger-ui-bundle.js", to: "." },
        { from: "./node_modules/swagger-ui-dist/swagger-ui-standalone-preset.js", to: "." },
        { from: "./node_modules/swagger-ui-dist/favicon-16x16.png", to: "." },
        { from: "./node_modules/swagger-ui-dist/favicon-32x32.png", to: "." },
      ],
    }),
  );

  config.plugins.push(
    new webpack.IgnorePlugin({
      checkResource(resource) {
        if (lazyImports.includes(resource)) {
          try {
            require.resolve(resource);
          } catch (err) {
            return true;
          }
        }
        return false;
      },
    }),
  );

  return config;
});
