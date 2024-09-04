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
      // https://webpack.js.org/configuration/dev-server/#devserverhistoryapifallback
      // lets the react app render the 404-page when there is no exect URL match.
      historyApiFallback: true,
      proxy: [
        {
          context: ["/api"],
          target: "http://localhost:8000",
          secure: false,
          changeOrigin: false,
        },
      ],
    };
    return config;
  },
  // Update the webpack config as needed here.
  // e.g. `config.plugins.push(new MyPlugin())`
);
