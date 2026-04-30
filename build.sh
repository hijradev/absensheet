#!/bin/bash
npx vite build
mkdir -p dist
cp backend/*.gs dist/
cp appsscript.json dist/
