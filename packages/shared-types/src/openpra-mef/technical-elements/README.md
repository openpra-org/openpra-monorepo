# Technical Elements Documentation

This directory contains the TypeScript type definitions and documentation for OpenPRA's technical elements.

## Running the Documentation

### Prerequisites
- Node.js (v14 or higher)
- npm (v6 or higher)

### Installation
```bash
# Install dependencies
npm install
```

### Serving Documentation
```bash
# Generate and serve documentation
npm run docs   # Generates documentation
npm run serve  # Serves documentation at http://localhost:8080
```

The documentation will be available at `http://localhost:8080`.

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

## Troubleshooting

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

### Common Issues

1. **404 Errors**: If you see 404 errors for module pages, try:
   - Clearing the docs directory: `rm -rf docs`
   - Regenerating documentation: `npm run docs`

2. **TypeDoc Warnings**: Some warnings about undefined types are expected and won't affect the documentation generation.

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

### Schema Update Guidelines
1. Follow TypeScript best practices
2. Maintain backward compatibility when possible
3. Document all interfaces and types thoroughly
4. Include examples in JSDoc comments
5. Test documentation generation locally before submitting