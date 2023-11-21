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


- Going forward, we will be converting warnings to errors, so this is our chance
  to clean up as much code as possible while still working on features.


- Linting errors can often be fixed using the `--fix` flag. But for it to work,
  you need to research how to direct eslint to fix it. GPT is your friend here.
  I cleaned up ~7000 errors today so when it works it's a lifesaver.


- In addition to linting, we are also using prettier, which is an opinionated
  code formatting package. It is configured along with eslint such that poorly
  formatted code shows up as a linting error. This also means that it can be
  fixed using eslint. I have tested this and it works.

- eslint and prettier should now automatically connect to Webstorm's code
  inspector, throwing warnings and errors as per our eslint settings as you edit
  a file. Please use these, and let me know if linting/formatting issues are not
  always picked up by Webstorm.
