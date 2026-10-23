# Threat model

## What this project does and where untrusted input enters
- The main HTTP API of Internxt Drive, an end-to-end encrypted cloud storage service. It is a NestJS app (`src/main.ts`) backed by PostgreSQL (Sequelize) and Redis.
- Every HTTP request is untrusted: route params, query strings, JSON bodies, multipart uploads (`src/externals/multer`) and headers, including JWTs.
- File contents and names are encrypted client-side; the server stores ciphertext, encrypted keys and metadata. A flaw that lets one user read or modify another user's metadata, keys or sharing state is as serious as reading plaintext.

## Components that matter most / least
- Most important: authentication and session handling (`src/modules/auth`, `src/modules/security`), access control on files, folders and trash (`src/modules/file`, `src/modules/folder`, `src/modules/trash`), sharing and public links (`src/modules/sharing`, `src/modules/share`, `src/modules/send`), workspaces and their roles (`src/modules/workspaces`, `src/shared-workspace`), and key handling (`src/modules/keyserver`, `src/externals/crypto`, `src/externals/asymmetric-encryption`).
- Also in scope: `src/modules/gateway` (endpoints for other Internxt services, protected by `GatewayGuard` in `src/modules/auth/gateway.guard.ts`), user account management (`src/modules/user`), and raw SQL in repositories.
- Lower priority: marketing integrations (`src/externals/klaviyo`, `src/externals/newsletter`), `src/modules/app-sumo` and `src/modules/referral`.
- Out of scope: `migrations/`, `seeders/`, `test/`, `*.spec.ts`, `*.e2e-spec.ts` and `infrastructure/` (tests and local development only).

## How to exercise it
- `npm test` runs the unit tests (Jest), co-located with the code as `*.spec.ts`.
- End-to-end tests (`src/**/*.e2e-spec.ts`, helpers in `test/`) need PostgreSQL and Redis from `infrastructure/docker-compose.yml`, which are not available in this image.

## How you rate severity
- Critical: authentication bypass, reading or modifying another user's files, folders, keys or sharing state (IDOR), SQL injection, or remote code execution.
- High: privilege escalation inside a workspace, accessing a shared item after access was revoked, or leaking another user's personal data.
- Medium: denial of service from a single request, or bypassing usage and plan limits.
- Low: information disclosure without user data, such as stack traces or internal identifiers.

## Anything to leave alone
- Do not report vulnerabilities in third-party dependencies unless this code uses them in an exploitable way.
