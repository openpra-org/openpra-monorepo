A skeleton for building a C++ addon for Node.js. This is a small, helper repository that generates simple `HelloWorld` Javascript example constructors. The examples have a number of methods to demonstrate different ways to use the Node C+ API for building particular types of functionality (i.e. asynchronous functions). Use this repo as both a template for your own code as well as a learning tool if you're just starting to develop Node/C++ Addons.


More examples of how to port C++ libraries to node can be found at [nodejs.org/api/addons.html](https://nodejs.org/api/addons.html).

# What's in the box? :package:

This repository itself can be cloned and edited to your needs. The skeleton prepares a C++ port to Node.js and provides the following for quick development:

* **Tests**: created with [Tape](https://github.com/substack/tape) in the `test/` directory. Travis CI file is prepared to build and test your project on every push.
* **Documentation**: use this README as a template and customize for your own project. Also, this skeleton uses [documentation.js](http://documentation.js.org/) to generate API documentation from JSDOC comments in the `.cpp` files. Docs are located in `API.md`.
* **[Benchmarking](./docs/benchmarking.md)**: Easily test the performance of your code using the built-in benchmark tests provided in this skeleton.
* **Build system**: [node-pre-gyp](https://github.com/mapbox/node-pre-gyp) generates binaries with the proper system architecture flags
* **[Publishing](./docs/publishing-binaries.md)**: Structured as a node module with a `package.json` that can be deployed to NPM's registry.
* **Learning resources**: Read the detailed inline comments within the example code to learn exactly what is happening behind the scenes. Also, check out the [extended tour](./docs/extended-tour.md) to learn more about Node/C++ Addon development, builds, Xcode, and more details about the configuration of this skeleton.

# Installation
```shell
nx build engine-scram-node
```

# Run Commands
Checkout [`package.json`](./package.json), to see what kind of commands you can run. Here is an example:

```bash
nx run engine-scram-node:test
nx run 
```



NOTE: we are pinned to `documentation@4.0.0` because 5.x removed C++ support: https://github.com/documentationjs/documentation/blob/master/CHANGELOG.md#500-2017-07-27

# Customizing the compiler toolchain
The compiler toolchain options can be set in the [`.env`](./.env) file. They can be:

```bash
export CXX="g++"
export CC="gcc"
export LINK="g++"
export AR="ar"
export NM="nm"
```



By default, we use `clang++` via [mason](https://github.com/mapbox/mason). The reason we do this is:

- We want to run the latest and greatest compiler version, to catch the most bugs, provide the best developer experience, and trigger the most helpful warnings
- We use clang-format to format the code and each version of clang-format formats code slightly differently. To avoid friction around this (and ensure all devs format the code the same) we default to using the same version of clang++ via mason.
- We want to support [LTO](https://github.com/mapbox/cpp/blob/master/glossary.md#link-time-optimization) in the builds, which is difficult to do on linux unless you control the toolchain tightly.


All that said, it is still absolutely possible and encouraged to compile your module with another compiler toolchain. In fact we hope that modules based on node-cpp-skel do this!

To customize the toolchain you can override the defaults by setting these environment variables: CXX, CC, LINK, AR, NM. For example to use g++-6 you could do:




These environment variables will override the compiler toolchain defaults in `make_global_settings` in the [`binding.gyp`](./binding.gyp).


# Add Custom Code

Depending on your use case, there are a variety of ways to start using this skeleton for your project.


### Add your code
Once your project has ported node-cpp-skel, follow these steps to integrate your own code:

- Create a dir in `./src` to hold your custom code. See the example code within `/src` for reference.
- Add your new method or class to `./src/module.cpp`, and `#include` it at the top
- Add your new file-to-be-compiled to the list of target sources in `./binding.gyp`
- Run `make` and see what surprises await on your new journey :boat:

### Adding dependencies
With updated versions of npm, a `package-lock.json` file is created, which is now included in node-cpp-skel. See [`npm-and-package-lock.md`](./docs/npm-and-package-lock.md) for more info on how to interact with this file and how to add new dependencies.

### Interactive Debugging

* [Debugging with VS Code](./docs/debugging-with-vs-code.md)

# Code coverage

Code coverage is critical for knowing how well your tests actually test all your code. To see code coverage you can view current results online at [![codecov](https://codecov.io/gh/mapbox/node-cpp-skel/branch/master/graph/badge.svg)](https://codecov.io/gh/mapbox/node-cpp-skel) or you can build in a customized way and display coverage locally like:

```
make coverage
```

**Note**

Use [`// LCOV_EXCL_START` and `// LCOV_EXCL_STOP`](https://github.com/mapbox/vtvalidate/blob/master/src/vtvalidate.cpp#L70-L73) to ignore from [codecov](https://codecov.io/gh/mapbox/node-cpp-skel) _remotely_. However, this won't ignore when running coverage _locally_.

For more details about what `make coverage` is doing under the hood see https://github.com/mapbox/cpp#code-coverage.

# Contributing and License

Contributors are welcome! :sparkles: This repo exists as a place to gather C++/Node Addon knowledge that will benefit the larger community. Please contribute your knowledge if you'd like.

Node-cpp-skel is licensed under [CC0](https://creativecommons.org/share-your-work/public-domain/cc0/). Attribution is not required, but definitely welcome! If your project uses this skeleton, please add the node-cpp-skel badge to your readme so that others can learn about the resource.

[![badge](https://mapbox.s3.amazonaws.com/cpp-assets/node-cpp-skel-badge_blue.svg)](https://github.com/mapbox/node-cpp-skel)

To include the badge, paste this into your README.md file:
```
[![badge](https://mapbox.s3.amazonaws.com/cpp-assets/node-cpp-skel-badge_blue.svg)](https://github.com/mapbox/node-cpp-skel)
```

See [CONTRIBUTING](CONTRIBUTING.md) and [LICENSE](LICENSE.md) for more info.
