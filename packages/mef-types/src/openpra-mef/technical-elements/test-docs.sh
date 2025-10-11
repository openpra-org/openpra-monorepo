#!/bin/bash

# Test script for verifying documentation consistency

echo "Cleaning docs directory..."
npm run clean

echo "Generating documentation with updated namespaces..."
npm run generate-typedoc

echo "Creating schema directories..."
npm run create-dirs

echo "Generating schema..."
npm run generate-schema

echo "Copying schema assets..."
npm run copy-schema

echo "Copying download page..."
npm run copy-download-page

echo "Starting local server..."
npm run serve

# Documentation will be available at http://localhost:8080 