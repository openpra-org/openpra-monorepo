/* eslint-disable */
const { composePlugins, withNx } = require("@nx/webpack");
const { withReact } = require("@nx/react");

// Nx plugins for webpack.
// TODO:: Review https://nx.dev/recipes/webpack/webpack-config-setup#basic-configuration-for-nx
module.exports = composePlugins(
  withNx(),
  withReact(),
  (config) => {
    config.devServer = {
      port: 4200,
      allowedHosts: [".app.openpra.org"],
      proxy: [
        {
          context: ["/api"],
          target: "http://localhost:8000",
          secure: true,
          changeOrigin: true,
        },
      ],
    };
    return config;
  },
  // e.g. `config.plugins.push(new MyPlugin())`   // Update the webpack config as needed here.
);
