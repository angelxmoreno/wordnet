# WordNet Module Modernization Review

This document outlines a comprehensive plan to modernize the `wordnet` npm module. The current codebase, while functional, is over 12 years old and can benefit significantly from modern tools and practices. This modernization will improve performance, maintainability, and the overall developer experience.

## 1. Core Technology Migration

### 1.1. Runtime and Package Manager: Bun

- **Objective:** Replace Node.js and npm with Bun.
- **Rationale:** Bun offers a faster runtime, a built-in package manager, and a native test runner, simplifying the development environment.
- **Action Items:**
    - Run `bun init` to initialize a Bun project. This will update your `package.json` file.
    - **Update `package.json`**: Add `\"packageManager\": \"bun@~1.1.0\"` and update the `engines` field to include `\"bun\": \">=1.3.0\"`.
    - Remove `node_modules` and `package-lock.json` (if present) and run `bun install` to regenerate the lockfile (`bun.lockb`).

### 1.2. Language: TypeScript

- **Objective:** Convert the entire codebase from JavaScript to TypeScript.
- **Rationale:** TypeScript provides static typing, improving code quality, and developer productivity.
- **Action Items:**
    - After running `bun init`, a `jsconfig.json` will be created. This file is for JavaScript projects.
    - Rename `jsconfig.json` to `tsconfig.json` and add the necessary TypeScript-specific compiler options.
    - Rename all `.js` files in `lib/`, `test/`, and `examples/` to `.ts`.
    - Add type definitions for the WordNet data structures.
    - Refactor the code to leverage TypeScript features like interfaces and async/await.

## 2. Tooling and Automation

### 2.1. Testing: bun:test

- **Objective:** Replace the `tape` testing framework with `bun:test`.
- **Rationale:** `bun:test` is a fast, Jest-compatible test runner built into Bun.
- **Action Items:**
    - Uninstall `tape` and `nyc`.
    - Rewrite the tests in `test/wordnet.ts` using the `bun:test` API (e.g., `test`, `expect`).
    - Expand test coverage to include the TODOs mentioned in the original `test/wordnet.js`.

### 2.2. Linting and Formatting: BiomeJS

- **Objective:** Replace `xo` with BiomeJS for linting and formatting.
- **Rationale:** BiomeJS is a fast, all-in-one toolchain for web development, providing a consistent code style.
- **Action Items:**
    - Uninstall `xo`.
    - Install `@biomejs/biome`.
    - Create a `biome.json` configuration file.
    - Update the `package.json` scripts to use `biome` for linting and formatting.

### 2.3. Pre-commit Hooks: Lefthook

- **Objective:** Implement pre-commit hooks with Lefthook.
- **Rationale:** Lefthook ensures that code is linted, formatted, and tested before being committed.
- **Action Items:**
    - Install `lefthook`.
    - Create a `lefthook.yml` configuration file.
    - Configure Lefthook to run Biome and `bun:test` on pre-commit.

### 2.4. Commit Conventions: Conventional Commits

- **Objective:** Adopt the Conventional Commits specification.
- **Rationale:** Conventional Commits provide a standardized way to write commit messages, which can be used to automate versioning and changelog generation.
- **Action Items:**
    - Enforce the Conventional Commits format for all new commits.
    - Consider using a tool like `commitizen` to assist with formatting commit messages.

## 3. Code Refactoring

### 3.1. API Modernization

- **Objective:** Modernize the file reading and data parsing logic.
- **Rationale:** The current `lib/reader.js` is a legacy implementation that can be replaced with modern, more efficient APIs.
- **Action Items:**
    - Remove `lib/reader.js`.
    - In `lib/wordnet.ts`, replace the custom reader with `Bun.file(path).text()` for reading index files and `Bun.file(path).stream()` for data files.
    - Refactor the promise-based code to use `async/await` for better readability.

### 3.2. Project Structure

- **Objective:** Organize the codebase for better clarity.
- **Rationale:** A well-organized project is easier to navigate and maintain.
- **Action Items:**
    - Consider creating a `src/` directory to house the `lib/` and `db/` directories.
    - Update the `tsconfig.json` to reflect the new structure.

## 4. Documentation

- **Objective:** Update the documentation to reflect the modernized codebase.
- **Rationale:** The `README.md` and examples should be updated to reflect the new API and usage.
- **Action Items:**
    - Update `README.md` with instructions on how to use the module with Bun and TypeScript.
    - Update the examples in `examples/` to use the new TypeScript-based API.

By following this plan, we can transform the `wordnet` module into a modern, performant, and maintainable library that is well-positioned for the future.
