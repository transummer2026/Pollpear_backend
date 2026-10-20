# Pollpear_backend

The NestJS application behind the gateway: the domain model, the database, the real-time
WebSocket gateway, and the public REST API. It owns everything from authentication and
authorization to polls, rooms, messaging and the social graph.

Part of **[Pollpear](https://github.com/transummer2026/Pollpear)**, a real-time collaborative polling platform.

## Stack

NestJS 11 on Node ≥ 25 · TypeScript · Prisma 7 over PostgreSQL (`@prisma/adapter-pg`) ·
[CASL](https://casl.js.org) for authorization · Passport (local, JWT, OAuth 2.0 with
GitHub, Google and 42) · Argon2 for password hashing · Socket.IO · ioredis for presence,
pub/sub and rate-limit state · Nodemailer + Handlebars · Multer + sharp with
`@aws-sdk/client-s3` to store uploads in Garage · Swagger / Scalar for the API reference.

## How it is organized

Around 30 domain modules under `src/`: `auth`, `users`, `me`, `rooms`, `messages`,
`polls`, `options`, `votes`, `invitation`, `friendship`, `block`, `report`, `ban`,
`notification`, `presence`, `feed`, `search`, `hashtags`, plus the cross-cutting
`casl`, `vault`, `secrets`, `storage`, `file-upload`, `mail`, `health`, `revocation`
and `websocket`. The key-authenticated public surface lives under `src/api/v1/`.

Two things worth knowing:

- **Authorization is policy-driven, not role-driven.** CASL abilities are built per
  request in `src/casl/`, and guards ask the policy rather than checking a role name.
- **Validation schemas are generated, not hand-written.** Zod schemas are derived from
  the Prisma schema into [`Pollpear_shared`](https://github.com/transummer2026/Pollpear_shared),
  a nested submodule, so backend, gateway and frontend validate against one source of truth.

## Running it

Through the stack (recommended — it needs PostgreSQL, Redis, Vault and Garage):

```sh
git clone --recursive https://github.com/transummer2026/Pollpear.git
cd Pollpear && make up_prod && make seed_prod
```

Standalone: `npm install` then `npm run start:dev`. Tests with `npm test`,
`npm run test:e2e`, `npm run test:cov`; `npm run check` runs format, types and lint.
Note that `npm install` triggers `prisma generate` — without it the project will not
typecheck.

Full setup instructions live in the [superproject README](https://github.com/transummer2026/Pollpear#readme).
