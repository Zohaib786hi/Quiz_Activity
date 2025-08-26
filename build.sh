#!/bin/bash

echo "Starting build process..."

# Install root dependencies
echo "Installing root dependencies..."
npm install

# Install and build client
echo "Installing client dependencies..."
cd client
npm install

echo "Building client..."
npm run build

echo "Build completed successfully!"
