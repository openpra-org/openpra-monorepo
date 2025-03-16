# PRA Technical Elements Documentation

OpenPRA technical schema is based on the latest standards for Advanced Non-Light Water Reactor Nuclear Power Plants. This directory provides the formal definitions, examples, and documentation of the OpenPRA schema, enabling its use in both OpenPRA applications and other related applications in the nuclear domain.

To download the JSON Schema for technical elements, visit `/schema-download.html` when running the documentation server. The schema can be used to validate your PRA data structures and ensure compliance with the OpenPRA technical elements specification.

## Understanding TypeScript Types and Interfaces

The documentation uses several TypeScript concepts to define and organize the PRA technical elements:

### Namespace
A way to logically group related code elements. These namespaces reflect the PRA Elements in the standard.
```typescript
namespace EventSequenceAnalysis {
    // Contains all event sequence related types
}
```

### Interface
A contract that defines the structure of an object, specifying what properties and methods it must have.
```typescript
interface EventSequence {
    sequenceId: string;
    description: string;
    initiatingEventId: string;
    // ... other properties
}
```

### Properties
Individual fields within an interface or type that define what data can be stored.
```typescript
interface DesignInformation {
    sourceId: string;  // A property of type string
}
```

### Variable
A named storage location for data that can hold values of specific types.
```typescript
const EventSequenceAnalysisSchema = typia.json.application<[EventSequenceAnalysis]>();
// Stores the JSON validation schema for event sequences
```

### Type Alias
A name given to a specific type or combination of types, making complex types more readable and reusable.
```typescript
interface EndState {
    name: "Controlled Release";
    category: string;
    releaseType: string;
    classification: string;
}
```

### Enumeration
A set of named constants that represent distinct values.
```typescript
enum PreventionMitigationLevel {
    FULL = "FULL",
    PARTIAL = "PARTIAL",
    NONE = "NONE"
}
```
### Function
A reusable block of code that performs a specific task, can accept parameters and return values.
```typescript
function validateTemporalPhase(phase: TemporalPhase): boolean {
    // Validates the timing and sequence of component states
    return true;
}
```

Each of these concepts is used throughout the documentation to create a type-safe representation of PRA technical elements.

## Running the Documentation

### Prerequisites
- Node.js (v14 or higher)
- npm (v6 or higher)

### Installation
```bash
# Install dependencies
npm install
# Install Typedoc for documentation generation
npm install typedoc --save-dev

```

### Serving Documentation
```bash
# Generate and serve documentation
npm run docs   # Generates documentation
npm run serve  # Serves documentation at http://localhost:8080
```

The documentation will be available at `http://localhost:8080`.

## Troubleshooting

### Common Issues

1. **404 Errors**: If you see 404 errors for module pages, try:
   - Clearing the docs directory: `rm -rf docs`
   - Regenerating documentation: `npm run docs`

2. **TypeDoc Warnings**: Some warnings about undefined types are expected and won't affect the documentation generation.

3. **Port Conflict Resolution**: If you encounter a port conflict while serving documentation, you can specify a different port using the `--port` option with `npm run serve`. For example, to serve on port 8081 instead of the default 8080:
```bash
npm run serve -- --port 8081
```


### Reset Environment
If you encounter any issues with the documentation generation or serving:

1. Clean the environment:
```bash
# Remove generated documentation
rm -rf docs

# Remove dependencies and lock file
rm -rf node_modules
rm -f package-lock.json

# Reinstall dependencies
npm install
```

2. Regenerate documentation:
```bash
npm run docs
npm run serve
```


## Contributing

### Reporting Issues
1. Visit our [GitHub Issues](https://github.com/OpenPRA/OpenPRA/issues)
2. Create a new issue with:
   - Clear description of the problem
   - Steps to reproduce
   - Expected vs actual behavior
   - TypeScript/TypeDoc version information

### Making Changes
1. Fork the repository
2. Create a new branch:
   ```bash
   git checkout -b feature/your-feature-name
   ```
3. Make your changes
4. Test locally:
   ```bash
   npm run docs
   npm run serve
   ```
5. Commit your changes:
   ```bash
   git add .
   git commit -m "Description of changes"
   ```
6. Push to your fork:
   ```bash
   git push origin feature/your-feature-name
   ```
7. Create a Pull Request:
   - Provide clear description of changes
   - Reference any related issues
   - Include before/after documentation examples if applicable

### Ensuring New Files are Documented
1. **File Visibility**
   - Ensure your TypeScript file has proper export statements
   - Add an `index.ts` in the directory if not present:
     ```typescript
     export * from './risk-integration/risk-integration';
     ```
   - Check that the file is included in `tsconfig.json`'s `include` paths

2. **Documentation Comments**
   - Add TSDoc comments to all exports using `/** */` syntax
   - Include a brief description for each interface, type, and function
   - Example:
     ```typescript
     /** 
      * Represents the risk integration configuration
      * @interface RiskIntegration
      */
     export interface RiskIntegration {
       // ... properties
     }
     ```

3. **Verify Documentation**
   - After adding new files, run:
     ```bash
     npm run docs
     ```
   - Check the generated documentation to confirm your new content appears
   - If missing, verify the export paths and TSDoc comments

### Schema Update Guidelines
1. Follow TypeScript best practices
2. Maintain backward compatibility when possible
3. Document all interfaces and types thoroughly
4. Include examples in JSDoc comments
5. Test documentation generation locally before submitting