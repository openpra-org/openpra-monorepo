# Linter Overview

- We have added eslint rules as warnings for now. The rules can be reviewed in
  the root `.eslintrc.json` file. They extend the recommended rules so to get
  the exhaustive list you need to go dig.


- `model-generator` is the only pristine package right now, please visually
  verify that your code follows the same style as it. Of course, eslint enforces
  the same rules everywhere, so once you fix all the linting errors, all
  packages will have the same syntax style.


- One of the rules makes TSDoc mandatory, as I mentioned, please read
  the `model-generator` code and the TSDoc documentation to review how to write
  your comments in this format.


- Going forward, we will be converting warnings to errors.


- Linting errors can often be fixed using the `--fix` flag. But for it to work,
  you need to research how to direct eslint to fix it. GPT is your friend here.


- In addition to linting, we are also using prettier, which is an opinionated
  code formatting package. It is configured along with eslint such that poorly
  formatted code shows up as a linting error. This also means that it can be
  fixed using eslint.

## WebStorm ESLint Config
- "Settings > Languages & Frameworks > JavaScript > Code Quality Tools > ESLint"
  - Enable/Check `Automatic ESLint configuration`
  -
## WebStorm Prettier Config
- "Settings > Languages & Frameworks > JavaScript > Prettier"
  - Enable/Check `Automatic Prettier configuration`
  - eslint and prettier should now automatically connect to Webstorm's code
    inspector, throwing warnings and errors as per our eslint settings as you edit
    a file.
