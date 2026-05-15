const { composePlugins, withNx } = require("@nx/webpack");
module.exports = composePlugins(withNx(), (config) => {
  config.module.rules.push({
    test: /\.node$/,
    loader: "node-loader",
  });
  return config;
});
