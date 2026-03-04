#!/bin/bash
# Check if user is logged into gh cli
if ! command -v gh &> /dev/null; then
    echo "GitHub CLI (gh) command not found."
    echo "Please consider installing it or using standard git commands."
    exit 1
fi

if ! gh auth status &> /dev/null; then
    echo "You are not logged into GitHub. Please run 'gh auth login' first."
    exit 1
fi

# Create repository
echo "Creating new public repository 'promptshift'..."
gh repo create promptshift --public --source=. --remote=origin --push

echo "Repository created and code pushed successfully!"
echo "View it at: https://github.com/$(gh api user -q .login)/promptshift"
