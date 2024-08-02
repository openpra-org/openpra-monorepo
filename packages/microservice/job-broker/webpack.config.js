const { composePlugins, withNx } = require("@nx/webpack");

// Nx plugins for webpack.
module.exports = composePlugins(withNx(), (config) => {
  // Update the webpack config as needed here.
  // e.g. `config.plugins.push(new MyPlugin())`
  // config.ignoreWarnings.push(/Failed to parse source map/)
  // Set target to node
  config.target = "node";

  // Ensure __dirname is not mocked
  config.node = {
    __dirname: false,
  };

  // Add rule for .node files
  config.module.rules.push({
    test: /\.node$/,
    loader: "node-loader",
  });
  return config;
});
