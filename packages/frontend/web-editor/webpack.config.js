const { composePlugins, withNx } = require("@nx/webpack");
const { withReact } = require("@nx/react");
const allowedHost = process.env.ALLOWED_HOST || "localhost";
const backendUrl = process.env.BACKEND_URL || "http://localhost:8000";
module.exports = composePlugins(withNx(), withReact(), (config) => {
  config.devServer = {
    port: 4200,
    allowedHosts: [allowedHost],
    historyApiFallback: true,
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
});
