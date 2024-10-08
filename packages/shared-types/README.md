# shared-types

This library was generated with [Nx](https://nx.dev).

## Building

Run `nx build shared-types` to build the library.

## Testing
We are using Jest and Cypress for testing.

### Running unit tests

Run `nx test shared-types` to execute the unit tests via [Jest](https://jestjs.io).


### Jest
Jest Test Suites and Jest Tests are used together to structure your tests in a way that makes them easy to understand and manage. Here are some use cases for choosing to write a Jest Test Suite vs just Jest Tests:

1. **Grouping related tests**: Jest Test Suites (describe blocks) are used to group related tests together. This makes
   it easier to understand which parts of your code the tests are covering. If you're testing a single function or a small
   piece of functionality, you might only need individual Jest Tests (it blocks). But if you're testing a larger feature or a whole module, it's helpful to group the tests into a suite.

2. **Shared setup and teardown**: If several tests need to run the same setup or teardown code, you can put that code in
   beforeAll, beforeEach, afterEach, or afterAll blocks inside a test suite. This avoids repetition and keeps your tests
   DRY (Don't Repeat Yourself).

3. **Scoped variables**: Variables declared in a describe block are available to all the tests and nested describe
   blocks inside it. This can be useful for sharing values between tests, like instances of the objects you're testing.

4. **Nested suites**: You can nest describe blocks to create sub-groups of tests. This can be useful for testing
   different aspects or sub-features of the code covered by the parent suite.

5. **Readability and organization**: Using test suites can make your test output easier to read, because Jest will print
   the suite and test names in a hierarchical format. This can make it easier to see at a glance what's being tested and what the results are.

6. **Selective test running**: You can use Jest's CLI options to run only the tests in a specific suite, which can be
   useful if you're working on a particular feature or if you want to isolate a failing test for debugging.
