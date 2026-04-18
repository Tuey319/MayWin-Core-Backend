# Contributing to MayWin Core Backend

Thank you for contributing! Please take a few minutes to read this before opening a pull request.

## Table of Contents

- [Getting Help](#getting-help)
- [Reporting Bugs](#reporting-bugs)
- [Suggesting Features](#suggesting-features)
- [Development Setup](#development-setup)
- [Branch & Commit Conventions](#branch--commit-conventions)
- [Coding Standards](#coding-standards)
- [Testing](#testing)
- [Database Migrations](#database-migrations)
- [Pull Request Process](#pull-request-process)

---

## Getting Help

If something is unclear or you are blocked, reach out before guessing:

| Person | Contact |
|--------|---------|
| **Tuey** (lead) | tueychirayu@gmail.com |
| **Ken** | *(ask Tuey for Ken's contact)* |

---

## Reporting Bugs

Open an issue and include:

- A clear description of the problem and the expected behavior
- Steps to reproduce (curl command, request payload, etc.)
- Relevant logs or error messages
- Environment (local / staging / production)

---

## Suggesting Features

Open an issue describing:

- The problem you are trying to solve
- Your proposed solution
- Any alternatives you considered

For anything non-trivial, discuss it in an issue before opening a PR.

---

## Development Setup

**Prerequisites**

- Node.js v18+
- npm v9+
- Docker & Docker Compose
- Python 3.10+ with `or-tools` (for the solver subsystem)
- NestJS CLI: `npm install -g @nestjs/cli`

**Steps**

```bash
# 1. Clone and install
git clone https://github.com/WinterJet2021/May-Win-NSP-Project.git
cd May-Win-NSP-Project
npm install

# 2. Configure environment
cp .env.example .env
# Edit .env — minimum required: DB_*, JWT_SECRET, AUTH_DISABLE_OTP=true

# 3. Start the database
docker-compose up -d db

# 4. Run migrations
npm run migration:run

# 5. Start the dev server
npm run dev
# API available at http://localhost:3000/api/v1/core/
```

See [docs/official/BACKEND_DEVELOPER_GUIDE.md](docs/official/BACKEND_DEVELOPER_GUIDE.md) for the full environment variable reference and architecture overview.

---

## Branch & Commit Conventions

**Branch naming**

| Prefix | Use |
|--------|-----|
| `feat/` | New feature |
| `fix/` | Bug fix |
| `refactor/` | Refactoring with no behavior change |
| `chore/` | Tooling, config, dependency updates |

```bash
git checkout -b feat/your-feature-name
git checkout -b fix/short-bug-description
```

**Commit messages** — follow [Conventional Commits](https://www.conventionalcommits.org/):

```
feat: add schedule export endpoint
fix: resolve JWT expiry edge case in auth guard
refactor: extract solver logic into dedicated service
chore: upgrade NestJS to v11
```

---

## Coding Standards

- **TypeScript only** — avoid `any` unless absolutely necessary, and comment why.
- **Use framework conventions** — NestJS decorators, guards, pipes, and interceptors as intended.
- **Validate all input** — use `class-validator` DTOs on every request body.
- **Throw the right exception** — `NotFoundException`, `BadRequestException`, `ForbiddenException`, etc. from the service layer; never return raw error strings from controllers.
- **Keep comments minimal** — only comment the *why* when it is non-obvious. Do not describe what the code does.

For project-specific patterns (auth, database access, multi-tenancy), refer to [docs/official/BACKEND_DEVELOPER_GUIDE.md](docs/official/BACKEND_DEVELOPER_GUIDE.md).

---

## Testing

```bash
npm test                                              # run all tests
npx jest --testPathPattern="module-name" --no-coverage  # single file
npx jest --watch                                      # watch mode
```

- Unit tests live alongside source files as `*.spec.ts`.
- Integration tests live in `test/`.
- When adding a feature, include at minimum a unit test for the service layer.
- When fixing a bug, add a test that would have caught the regression.

See [docs/official/TESTING.md](docs/official/TESTING.md) for patterns and examples.

---

## Database Migrations

Never edit the schema directly. All changes go through TypeORM migrations.

```bash
npm run migration:generate   # generate after editing an entity
npm run migration:run        # apply locally
npm run migration:revert     # roll back the last migration
```

Review the generated SQL in `src/database/migrations/` before committing.

---

## Pull Request Process

**Before opening a PR, make sure:**

- [ ] `npx tsc --noEmit` passes with no errors
- [ ] `npm test` passes — all tests green
- [ ] New behavior has a corresponding test
- [ ] A migration has been generated and reviewed if the schema changed

**Opening the PR**

1. Push your branch and open a pull request against `main`.
2. Write a clear description — what changed, why, and how to test it manually.
3. Link any related issues.
4. Assign **Tuey** and **Ken** as reviewers.

**Review requirement**

> Do not merge your own pull request. Wait for approval from **Tuey** or **Ken** before merging.
>
> If your PR has had no response after 2 days, ping directly:
> - **Tuey:** tueychirayu@gmail.com
> - **Ken:** *(ask Tuey for Ken's contact)*

For breaking changes, migrations, or changes to the solver/orchestrator pipeline — get approval from **both** Tuey and Ken.

**After merging**

- Delete your feature branch.
- Update [docs/official/API.md](docs/official/API.md) if the change affects the API.
- Confirm migrations are applied to staging if the schema changed.
