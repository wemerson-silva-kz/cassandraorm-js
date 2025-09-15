#!/bin/bash

# Script to create GitHub issues from markdown files
# Usage: ./scripts/create-github-issues.sh

echo "🚀 Creating GitHub Issues for Production Readiness..."

# Check if gh CLI is installed
if ! command -v gh &> /dev/null; then
    echo "❌ GitHub CLI (gh) is not installed. Please install it first:"
    echo "   brew install gh"
    echo "   or visit: https://cli.github.com/"
    exit 1
fi

# Check if authenticated
if ! gh auth status &> /dev/null; then
    echo "❌ Not authenticated with GitHub. Please run:"
    echo "   gh auth login"
    exit 1
fi

# Create issues from markdown files
ISSUE_DIR=".github/issues"

echo "📋 Creating Production Readiness Tracker..."
gh issue create \
    --title "🚀 [RELEASE] Production Readiness Tracker v1.0.1" \
    --body-file "$ISSUE_DIR/000-production-readiness-tracker.md" \
    --label "release,tracking,milestone" \
    --milestone "v1.0.1"

echo "🔥 Creating Critical Issue #1: Cassandra Driver API..."
gh issue create \
    --title "🔥 [CRITICAL] Cassandra Driver API Compatibility Issues" \
    --body-file "$ISSUE_DIR/001-cassandra-driver-api.md" \
    --label "bug,critical,cassandra-driver" \
    --milestone "v1.0.1-alpha"

echo "🔥 Creating Critical Issue #2: Jest Mock Types..."
gh issue create \
    --title "🔥 [CRITICAL] Jest Mock Type Errors" \
    --body-file "$ISSUE_DIR/002-jest-mock-types.md" \
    --label "bug,critical,testing,typescript" \
    --milestone "v1.0.1-alpha"

echo "🔥 Creating Critical Issue #3: Module Resolution..."
gh issue create \
    --title "🔥 [CRITICAL] Module Resolution Failures" \
    --body-file "$ISSUE_DIR/003-module-resolution.md" \
    --label "bug,critical,build,modules" \
    --milestone "v1.0.1-alpha"

echo ""
echo "✅ All GitHub issues created successfully!"
echo ""
echo "📋 Next steps:"
echo "1. Visit your GitHub repository to see the issues"
echo "2. Assign issues to team members"
echo "3. Start working on critical issues first"
echo "4. Update issue status as work progresses"
echo ""
echo "🎯 Goal: Resolve 3 critical issues for v1.0.1-alpha release"
