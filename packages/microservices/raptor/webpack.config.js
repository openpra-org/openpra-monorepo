const { composePlugins, withNx } = require("@nx/webpack");
const webpack = require("webpack");
const lazyImports = ["class-transformer", "class-transformer/storage", "class-transformer/cjs/storage"];
module.exports = composePlugins(withNx(), (config) => {
  config.target = "node";
  config.node = {
    __dirname: false,
  };
  config.module.rules.push({
    test: /\.node$/,
    loader: "node-loader",
  });
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
