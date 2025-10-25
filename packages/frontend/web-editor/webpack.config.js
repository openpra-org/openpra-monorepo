const { composePlugins, withNx } = require("@nx/webpack");
const { withReact } = require("@nx/react");

// todo:: parse `process.env.ALLOWED_HOST` as a valid URL
const allowedHost = process.env.ALLOWED_HOST || "localhost";
const backendUrl = process.env.BACKEND_URL || "http://localhost:8000";

// Nx plugins for webpack.
// TODO:: Review https://nx.dev/recipes/webpack/webpack-config-setup#basic-configuration-for-nx
module.exports = composePlugins(
  withNx(),
  withReact(),
  (config) => {
    config.devServer = {
      port: 4200,
      allowedHosts: [allowedHost],
      historyApiFallback: true, // enable history API fallback for SPA routing.
      proxy: [
        {
          context: ["/api"],
          target: backendUrl,
          secure: true,
          changeOrigin: true,
        },
      ],
    };
    return config;
  },
  // e.g. `config.plugins.push(new MyPlugin())`   // Update the webpack config as needed here.
);
