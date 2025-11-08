# ESLint + Prettier Setup for Frontend (Svelte)

## What Was Configured

The frontend linting and formatting setup now mirrors the anchor_project setup, with additional Svelte-specific support.

### Files Created/Updated

1. **`eslint.config.mjs`** - Modern ESLint flat config (ESLint 9.x) with:
   - Strict TypeScript rules for `.ts` files
   - Svelte-specific rules for `.svelte` files
   - Prettier integration
   - Browser globals (window, document, etc.)
   - Shared rules across both file types

2. **`.prettierrc.json`** - Updated with:
   - Same base settings as anchor_project (semi, quotes, line width, etc.)
   - Svelte plugin integration
   - Svelte parser override for `.svelte` files

3. **`.prettierignore`** - Simplified to match anchor_project pattern

4. **`package.json`** - Updated scripts to match anchor_project:
   - `yarn lint` - Check for linting issues
   - `yarn lint:fix` - Auto-fix linting issues
   - `yarn format` - Check formatting
   - `yarn format:fix` - Auto-fix formatting
   - `yarn fix` - Auto-fix both linting AND formatting

5. **`tsconfig.json`** - Added strict compiler options:
   - `strict: true`
   - `noImplicitAny: true`
   - `strictNullChecks: true`
   - `noUnusedLocals: true`
   - `noUnusedParameters: true`

## Key Linting Rules (TypeScript & Svelte)

### Errors

- `@typescript-eslint/no-unused-vars` - Catch unused variables
- `@typescript-eslint/no-explicit-any` - Ban `any` type
- `@typescript-eslint/no-floating-promises` - Require promise handling
- `prefer-const` - Use const when variables aren't reassigned
- `no-var` - Ban var keyword
- `eqeqeq` - Require === instead of ==
- `curly` - Require curly braces for all control statements
- `svelte/valid-compile` - Ensure Svelte components compile correctly

### Warnings

- `@typescript-eslint/explicit-function-return-type` - Encourage return types
- `svelte/no-at-html-tags` - Warn about `@html` usage
- `prettier/prettier` - Formatting issues

## Svelte-Specific Features

The setup includes:

- **eslint-plugin-svelte** - Svelte component linting
- **svelte-eslint-parser** - Parse `.svelte` files correctly
- **prettier-plugin-svelte** - Format Svelte components
- Special handling for Svelte reactive variables (`$$` prefix ignored in unused vars)

## Available Commands

```bash
# Lint TypeScript and Svelte files
yarn lint

# Auto-fix linting issues
yarn lint:fix

# Check Prettier formatting
yarn format

# Auto-fix Prettier formatting
yarn format:fix

# Auto-fix both linting AND formatting (recommended!)
yarn fix

# Type-check with svelte-check
yarn check

# Sync IDL from anchor_project
yarn idl:sync

# Run dev server
yarn dev

# Build for production
yarn build
```

## Consistency with anchor_project

Both projects now share:

- ✅ Same ESLint rules (with Svelte additions for frontend)
- ✅ Same Prettier configuration
- ✅ Same script naming convention (lint, lint:fix, format, format:fix, fix)
- ✅ Same strict TypeScript compiler options
- ✅ Same modern ESLint flat config format (ESLint 9.x)

## Differences (Frontend-Specific)

The frontend has additional support for:

- 📦 Svelte component linting and formatting
- 🌐 Browser globals (window, document, etc.)
- 🎨 Svelte reactive syntax (`$:`, `$$`)
- 📝 `.svelte` file type support

This provides a consistent development experience across both the Solana program tests and the frontend application!
