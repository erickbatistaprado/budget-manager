# Backend architecture

## Shape

The API is a modular monolith with one deployment unit and three bounded
contexts:

- **Identity** owns users, roles, authentication, refresh tokens, and profile
  images.
- **Ledger** owns categories, transactions, and installments. Categories belong
  to a user, and names are unique per user and transaction type.
- **Savings** owns savings goals and their location rules.

The code is split by capability first and then by DDD layer:

| Package                                | DDD responsibility                        |
| -------------------------------------- | ----------------------------------------- |
| `{context}.domain`                     | Entities and domain vocabulary            |
| `{context}.application`                | Use cases and transaction orchestration   |
| `{context}.infrastructure.http`        | Controllers, DTOs, and converters         |
| `{context}.infrastructure.persistence` | Spring Data persistence adapters          |
| `{context}.infrastructure.security`    | Authentication and authorization adapters |

Dependencies point inward: controllers call application services; services use
repositories; domain objects never access application or infrastructure types.
Controllers convert DTOs to domain objects before calling a service, and back to
DTOs on the way out. Services report failures with `ApplicationException` and an
`ApplicationError` kind; the HTTP adapter maps each kind to a status code.

`ArchitectureTest` (ArchUnit) enforces these rules in every Maven verification:

- the domain depends on neither application nor infrastructure code, Spring
  Security, or Jackson;
- application services do not depend on HTTP adapters or `org.springframework.http`;
- HTTP adapters do not access persistence adapters;
- `@RestController` methods never return JPA entities.

## Authentication

- Sign-in sets two HTTP-only cookies: a 15-minute JWT `access_token` and an
  opaque `refresh_token`.
- Every sign-in creates its own refresh token, so the web and mobile apps keep
  separate sessions. Only its SHA-256 hash is stored.
- `POST /auth/refresh` swaps the refresh token for a new one in a single
  conditional `UPDATE`, so a token works once even under concurrent requests.
- Logout revokes the current device's token; a password change revokes all of them.
- Clients refresh on the first 401 and retry once (`BudgetManagerClient` and the
  web `fetchers.lib.ts`).
- Unsafe requests need the `X-CSRF-Token` header. One token from `GET /auth/csrf`
  stays valid until sign-out.
- An invalid access token never blocks public endpoints; protected endpoints
  answer 401.

## Seed data

Flyway migrations seed everything the app needs; there is no other seed step.

| Data                    | Where                                                                                                                       | When                                                                                                         |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Roles                   | `V1__create_initial_schema.sql`                                                                                             | Once                                                                                                         |
| A first user (optional) | `V2__seed_configured_user.sql`, from `APP_SEED_USER_EMAIL`, `APP_SEED_USER_NAME` and `APP_SEED_USER_PASSWORD_HASH` (BCrypt) | Once, on an empty database                                                                                   |
| Default categories      | `t_default_category`, filled by `V4__seed_default_categories.sql`                                                           | V4 gives them to existing users; registration gives them to each new user through the `UserRegistered` event |

To change the default categories, add a migration that edits
`t_default_category`. Existing users keep their categories; only new users and a
backfill you write into that migration see the change.

## Tests

API tests run against PostgreSQL in Testcontainers with the real Flyway
migrations, so Docker must be running for `make api-check`. Each migration that
rewrites existing data gets a test that loads the previous schema version, seeds
data and migrates forward (see `CategoryOwnershipMigrationTest`).

## Evolution rules

- New capability code is grouped by bounded context first, then by `domain`,
  `application`, and `infrastructure`.
- A bounded context never calls another context's repository. It calls an explicit
  application interface or publishes a domain event.
- Controllers return DTOs rather than JPA entities.
- Domain invariants are checked in domain/application code, not only by request
  validation.
- PostgreSQL is the source of truth. Replace Hibernate `update` with forward-only
  Flyway migrations before the first shared environment.
- Store timestamps in UTC and monetary amounts with an explicit currency and exact
  decimal or minor-unit representation.
- External writes must be idempotent and authenticated.

## Delivery boundaries

The web app knows the API contract but never database details. Infrastructure is
kept outside both apps. Docker images are immutable and run as non-root users.
