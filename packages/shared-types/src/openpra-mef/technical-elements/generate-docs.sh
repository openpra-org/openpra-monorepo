#!/bin/bash

# Generate documentation with TypeDoc
echo "Generating documentation with TypeDoc..."
npx typedoc --options typedoc.json > typedoc-output.log 2>&1
TYPEDOC_EXIT_CODE=$?

# Check for errors and warnings
if [ $TYPEDOC_EXIT_CODE -ne 0 ]; then
  echo "Error: TypeDoc failed with exit code $TYPEDOC_EXIT_CODE"
  cat typedoc-output.log
  exit 1
fi

# Count warnings
WARNING_COUNT=$(grep -c "\[warning\]" typedoc-output.log || true)
ERROR_COUNT=$(grep -c "\[error\]" typedoc-output.log || true)

if [ $ERROR_COUNT -gt 0 ]; then
  echo "Documentation generated with $ERROR_COUNT errors."
  grep "\[error\]" typedoc-output.log
  exit 1
elif [ $WARNING_COUNT -gt 0 ]; then
  echo "Documentation generated with $WARNING_COUNT warnings."
  echo "See typedoc-output.log for details."
else
  echo "Documentation generated successfully with no warnings or errors!"
fi

echo "Documentation is available in the ./docs directory." 