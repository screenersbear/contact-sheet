#!/bin/bash
cd "/Users/starkyproductions/Library/CloudStorage/OneDrive-SharedLibraries-Onedrive/Documents/Claude/Contact Sheet"
git add .
echo "What did you change?"
read message
git commit -m "$message"
git push
