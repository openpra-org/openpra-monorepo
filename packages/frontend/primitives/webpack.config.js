const { composePlugins, withNx } = require("@nx/webpack");
const { withReact } = require("@nx/react");

// Nx plugins for webpack.
module.exports = composePlugins(
  withNx(),
  withReact({
    // Uncomment this line if you don't want to use SVGR
    // See: https://react-svgr.com/
    // svgr: false
  }),
  (config) => {
    config.devServer = {
      port: 4200,
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
);
