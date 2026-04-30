#!/bin/bash

# Exit on error
set -e

# Navigate to the frontend directory
cd frontend

# Install dependencies and build the frontend
npm install
npm run build

# Move the build output to the backend static folder
rm -rf ../backend/static
mv dist ../backend/static