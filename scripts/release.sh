#!/bin/bash

#===============================================================================
# @struktos/core - Manual Release Script
# 
# This script automates the manual release process with comprehensive checks:
# 1. Pre-flight validation (git status, npm login, test coverage)
# 2. Version management (patch/minor/major)
# 3. Automated testing and building
# 4. Git tagging and pushing
# 5. GitHub Release creation
# 6. npm publishing with provenance
#
# Usage:
#   ./scripts/release.sh                    # Interactive mode
#   ./scripts/release.sh patch              # Bump patch version (1.0.0 -> 1.0.1)
#   ./scripts/release.sh minor              # Bump minor version (1.0.0 -> 1.1.0)
#   ./scripts/release.sh major              # Bump major version (1.0.0 -> 2.0.0)
#   ./scripts/release.sh --dry-run patch    # Test without publishing
#
# Requirements:
#   - git (clean working directory)
#   - npm (logged in with publishing rights)
#   - gh (GitHub CLI, logged in)
#   - Node.js 18+
#===============================================================================

set -e  # Exit immediately on error
set -u  # Treat unset variables as errors
set -o pipefail  # Pipe failures propagate

# ============================================================================
# ANSI Color Codes
# ============================================================================

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
MAGENTA='\033[0;35m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'  # No Color

# ============================================================================
# Logging Functions
# ============================================================================

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1" >&2
}

log_step() {
    echo -e "\n${CYAN}${BOLD}▶ $1${NC}\n"
}

log_fatal() {
    log_error "$1"
    exit 1
}

# ============================================================================
# Configuration
# ============================================================================

PACKAGE_NAME="@struktos/core"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
CHANGELOG_FILE="$PROJECT_DIR/CHANGELOG.md"
PACKAGE_JSON="$PROJECT_DIR/package.json"

DRY_RUN=false
VERSION_BUMP=""

# ============================================================================
# Parse Arguments
# ============================================================================

parse_arguments() {
    while [[ $# -gt 0 ]]; do
        case $1 in
            --dry-run)
                DRY_RUN=true
                log_warn "Running in DRY-RUN mode (no actual publishing)"
                shift
                ;;
            patch|minor|major)
                VERSION_BUMP=$1
                shift
                ;;
            --help|-h)
                cat << EOF
Usage: $0 [OPTIONS] [VERSION_BUMP]

Options:
    --dry-run       Run without actually publishing
    --help, -h      Show this help message

Version Bump:
    patch           Bump patch version (1.0.0 -> 1.0.1)
    minor           Bump minor version (1.0.0 -> 1.1.0)
    major           Bump major version (1.0.0 -> 2.0.0)
    (none)          Interactive selection

Examples:
    $0                    # Interactive mode
    $0 patch              # Release patch version
    $0 --dry-run major    # Test major release without publishing
EOF
                exit 0
                ;;
            *)
                log_fatal "Unknown argument: $1. Use --help for usage."
                ;;
        esac
    done
}

# ============================================================================
# Pre-flight Checks
# ============================================================================

check_git_repository() {
    log_step "1/10: Checking Git Repository"
    
    if ! git rev-parse --is-inside-work-tree > /dev/null 2>&1; then
        log_fatal "Not a git repository"
    fi
    
    log_success "Git repository confirmed"
}

check_uncommitted_changes() {
    if ! git diff-index --quiet HEAD -- 2>/dev/null; then
        log_fatal "You have uncommitted changes. Please commit or stash them first."
    fi
    
    log_success "Working directory is clean"
}

check_current_branch() {
    local current_branch=$(git rev-parse --abbrev-ref HEAD)
    
    if [[ "$current_branch" != "main" && "$current_branch" != "master" ]]; then
        log_warn "You are on branch '$current_branch', not main/master."
        
        if [ "$DRY_RUN" = false ]; then
            read -p "Continue anyway? (y/N) " -n 1 -r
            echo
            if [[ ! $REPLY =~ ^[Yy]$ ]]; then
                log_fatal "Release cancelled by user"
            fi
        fi
    else
        log_success "On main/master branch"
    fi
}

check_npm_login() {
    log_step "2/10: Checking npm Authentication"
    
    if ! npm whoami > /dev/null 2>&1; then
        log_fatal "Not logged in to npm. Run 'npm login' first."
    fi
    
    local npm_user=$(npm whoami)
    log_success "Logged in to npm as: $npm_user"
}

check_github_cli() {
    log_step "3/10: Checking GitHub CLI"
    
    if ! command -v gh &> /dev/null; then
        log_fatal "GitHub CLI (gh) is not installed. Install from https://cli.github.com/"
    fi
    
    if ! gh auth status > /dev/null 2>&1; then
        log_fatal "Not logged in to GitHub CLI. Run 'gh auth login' first."
    fi
    
    local gh_user=$(gh api user --jq '.login')
    log_success "Logged in to GitHub as: $gh_user"
}

check_node_version() {
    local node_version=$(node --version | cut -d'v' -f2)
    local major_version=$(echo "$node_version" | cut -d'.' -f1)
    
    if [ "$major_version" -lt 18 ]; then
        log_fatal "Node.js 18+ required. Current version: $node_version"
    fi
    
    log_success "Node.js version: $node_version"
}

# ============================================================================
# Version Management
# ============================================================================

get_current_version() {
    node -p "require('$PACKAGE_JSON').version"
}

select_version_bump() {
    log_step "4/10: Select Version Bump"
    
    if [ -z "$VERSION_BUMP" ]; then
        local current_version=$(get_current_version)
        
        echo "Current version: $current_version"
        echo ""
        echo "Select version bump:"
        echo "  1) patch  (${current_version} → $(npm version patch --no-git-tag-version --allow-same-version 2>/dev/null && get_current_version; git checkout -- package.json package-lock.json))"
        echo "  2) minor  (${current_version} → $(npm version minor --no-git-tag-version --allow-same-version 2>/dev/null && get_current_version; git checkout -- package.json package-lock.json))"
        echo "  3) major  (${current_version} → $(npm version major --no-git-tag-version --allow-same-version 2>/dev/null && get_current_version; git checkout -- package.json package-lock.json))"
        echo ""
        
        read -p "Enter choice (1-3): " choice
        
        case $choice in
            1) VERSION_BUMP="patch" ;;
            2) VERSION_BUMP="minor" ;;
            3) VERSION_BUMP="major" ;;
            *) log_fatal "Invalid choice: $choice" ;;
        esac
    fi
    
    log_success "Selected version bump: $VERSION_BUMP"
}

bump_version() {
    local old_version=$(get_current_version)
    
    if [ "$DRY_RUN" = false ]; then
        npm version "$VERSION_BUMP" --no-git-tag-version
    else
        npm version "$VERSION_BUMP" --no-git-tag-version
        # Revert changes in dry-run
        git checkout -- package.json package-lock.json
    fi
    
    local new_version=$(get_current_version)
    
    log_success "Version: $old_version → $new_version"
    
    echo "$new_version"
}

# ============================================================================
# Testing & Building
# ============================================================================

run_tests() {
    log_step "5/10: Running Test Suite"
    
    log_info "Installing dependencies..."
    npm ci > /dev/null
    
    log_info "Running linter..."
    npm run lint
    
    log_info "Running type check..."
    npm run build
    
    log_info "Running unit tests..."
    npm run test:unit
    
    log_info "Running integration tests..."
    npm run test:integration
    
    log_info "Checking coverage threshold..."
    npm run test:coverage
    
    log_success "All tests passed"
}

build_package() {
    log_step "6/10: Building Package"
    
    log_info "Compiling TypeScript..."
    npm run build
    
    log_info "Verifying build output..."
    
    if [ ! -f "dist/index.js" ]; then
        log_fatal "Build failed: dist/index.js not found"
    fi
    
    if [ ! -f "dist/index.d.ts" ]; then
        log_fatal "Build failed: dist/index.d.ts not found"
    fi
    
    log_success "Package built successfully"
}

# ============================================================================
# Git Operations
# ============================================================================

commit_version_bump() {
    log_step "7/10: Committing Version Bump"
    
    local new_version="$1"
    
    if [ "$DRY_RUN" = false ]; then
        git add package.json package-lock.json
        git commit -m "chore(release): bump version to $new_version"
        
        log_success "Committed version bump"
    else
        log_warn "[DRY-RUN] Would commit: chore(release): bump version to $new_version"
    fi
}

create_git_tag() {
    log_step "8/10: Creating Git Tag"
    
    local version="$1"
    local tag="v$version"
    
    if [ "$DRY_RUN" = false ]; then
        git tag -a "$tag" -m "Release $tag"
        log_success "Created tag: $tag"
    else
        log_warn "[DRY-RUN] Would create tag: $tag"
    fi
}

push_to_remote() {
    log_step "9/10: Pushing to Remote"
    
    local version="$1"
    local tag="v$version"
    
    if [ "$DRY_RUN" = false ]; then
        git push origin main
        git push origin "$tag"
        
        log_success "Pushed commits and tag to remote"
    else
        log_warn "[DRY-RUN] Would push: commits and tag $tag"
    fi
}

# ============================================================================
# GitHub Release
# ============================================================================

extract_changelog() {
    local version="$1"
    
    if [ ! -f "$CHANGELOG_FILE" ]; then
        echo "Release v$version"
        return
    fi
    
    # Extract changelog section for this version
    awk "/## \[$version\]/,/## \[/" "$CHANGELOG_FILE" | head -n -1 | tail -n +2
}

create_github_release() {
    log_step "10/10: Creating GitHub Release"
    
    local version="$1"
    local tag="v$version"
    
    local changelog=$(extract_changelog "$version")
    
    if [ -z "$changelog" ]; then
        changelog="Release $tag

See https://github.com/struktos/core/compare/...v${tag} for full changelog."
    fi
    
    if [ "$DRY_RUN" = false ]; then
        echo "$changelog" | gh release create "$tag" \
            --title "$tag" \
            --notes-file - \
            --latest
        
        log_success "Created GitHub Release: $tag"
    else
        log_warn "[DRY-RUN] Would create GitHub Release: $tag"
    fi
}

# ============================================================================
# npm Publishing
# ============================================================================

publish_to_npm() {
    local version="$1"
    
    if [ "$DRY_RUN" = false ]; then
        log_info "Publishing to npm with provenance..."
        npm publish --provenance --access public
        
        # Wait for propagation
        sleep 10
        
        # Verify
        local published_version=$(npm view "$PACKAGE_NAME" version)
        
        if [ "$published_version" = "$version" ]; then
            log_success "Successfully published $PACKAGE_NAME@$version to npm"
        else
            log_fatal "Failed to verify npm publication. Expected: $version, Got: $published_version"
        fi
    else
        log_warn "[DRY-RUN] Would publish to npm: $PACKAGE_NAME@$version"
    fi
}

# ============================================================================
# Rollback
# ============================================================================

rollback_on_error() {
    local version="$1"
    local tag="v$version"
    
    log_error "Release failed! Rolling back..."
    
    # Delete tag if created
    if git tag -l | grep -q "^$tag$"; then
        git tag -d "$tag" 2>/dev/null || true
        git push origin ":refs/tags/$tag" 2>/dev/null || true
        log_warn "Deleted tag: $tag"
    fi
    
    # Reset version in package.json
    git reset --hard HEAD~1 2>/dev/null || true
    
    log_error "Rollback completed. Please investigate the error and try again."
}

# ============================================================================
# Main Release Flow
# ============================================================================

main() {
    echo -e "${BOLD}${MAGENTA}"
    echo "╔═══════════════════════════════════════════════════════════╗"
    echo "║         @struktos/core - Release Script                  ║"
    echo "╚═══════════════════════════════════════════════════════════╝"
    echo -e "${NC}"
    
    # Parse arguments
    parse_arguments "$@"
    
    # Pre-flight checks
    check_git_repository
    check_uncommitted_changes
    check_current_branch
    check_npm_login
    check_github_cli
    check_node_version
    
    # Version management
    select_version_bump
    local new_version=$(bump_version)
    
    # Testing & building
    run_tests
    build_package
    
    # Git operations
    commit_version_bump "$new_version"
    create_git_tag "$new_version"
    push_to_remote "$new_version"
    
    # GitHub & npm publishing
    create_github_release "$new_version" || {
        rollback_on_error "$new_version"
        exit 1
    }
    
    publish_to_npm "$new_version" || {
        rollback_on_error "$new_version"
        exit 1
    }
    
    # Success summary
    echo ""
    echo -e "${GREEN}${BOLD}╔═══════════════════════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}${BOLD}║              🎉 Release Successful! 🎉                    ║${NC}"
    echo -e "${GREEN}${BOLD}╚═══════════════════════════════════════════════════════════╝${NC}"
    echo ""
    echo -e "${BOLD}Version:${NC} $new_version"
    echo -e "${BOLD}Package:${NC} https://www.npmjs.com/package/$PACKAGE_NAME/v/$new_version"
    echo -e "${BOLD}Release:${NC} https://github.com/struktos/core/releases/tag/v$new_version"
    echo ""
    echo -e "${CYAN}Installation:${NC}"
    echo -e "  npm install $PACKAGE_NAME@$new_version"
    echo ""
    
    if [ "$DRY_RUN" = true ]; then
        log_warn "This was a DRY-RUN. No actual publishing occurred."
    fi
}

# ============================================================================
# Entry Point
# ============================================================================

main "$@"