# ESLint + Prettier Setup for Raffle Project

## What Was Installed

### Dependencies (via yarn)
- `eslint` - Core linting engine
- `@typescript-eslint/parser` - TypeScript parser for ESLint
- `@typescript-eslint/eslint-plugin` - TypeScript-specific linting rules
- `eslint-config-prettier` - Disables ESLint rules that conflict with Prettier
- `eslint-plugin-prettier` - Runs Prettier as an ESLint rule

## Configuration Files Created

### 1. `eslint.config.mjs`
Modern ESLint flat config (ESLint 9.x) with:
- Strict TypeScript rules enabled
- Prettier integration
- Mocha test globals (describe, it, before, after, etc.)
- Node.js globals (console, Buffer, setTimeout, etc.)

### 2. `.prettierrc.json`
Prettier formatting rules:
- Semicolons enabled
- Double quotes
- 100 character line width
- 2 space indentation

### 3. `.prettierignore`
Excludes generated files from formatting

### 4. Updated `tsconfig.json`
Added strict compiler options:
- `strict: true`
- `noImplicitAny: true`
- `strictNullChecks: true`
- `noUnusedLocals: true`
- `noUnusedParameters: true`

## Available Scripts

```bash
# Lint TypeScript files
yarn lint

# Auto-fix linting issues
yarn lint:fix

# Check Prettier formatting
yarn format

# Auto-fix Prettier formatting
yarn format:fix
```

## Key Linting Rules Enabled

### Errors
- `@typescript-eslint/no-unused-vars` - Catch unused variables
- `@typescript-eslint/no-explicit-any` - Ban `any` type
- `@typescript-eslint/no-floating-promises` - Require promise handling
- `@typescript-eslint/no-misused-promises` - Prevent promise misuse
- `prefer-const` - Use const when variables aren't reassigned
- `no-var` - Ban var keyword
- `eqeqeq` - Require === instead of ==
- `curly` - Require curly braces for all control statements

### Warnings
- `@typescript-eslint/explicit-function-return-type` - Encourage return types
- `@typescript-eslint/prefer-nullish-coalescing` - Use ?? operator
- `@typescript-eslint/prefer-optional-chain` - Use ?. operator
- `no-console` - Only allow console.warn, console.error, console.log

## Testing Note

When running tests and **Rust code hasn't changed**, use:
```bash
anchor test --skip-local-validator --skip-deploy
```

This skips rebuilding the Solana program and is much faster for TypeScript-only changes.

## What Was Auto-Fixed

The `yarn lint:fix` command automatically fixed:
- Changed `let` to `const` where variables weren't reassigned
- Fixed formatting issues (spacing, line breaks)
- Removed unnecessary type assertions
- Other automatically fixable issues

## Next Steps

1. Run `yarn lint` regularly to catch issues
2. Use `yarn lint:fix` to auto-fix when possible
3. Configure your IDE to show ESLint warnings in real-time
4. Consider adding a pre-commit hook to run linting automatically
