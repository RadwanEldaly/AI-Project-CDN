# DevSpace — Technology Selection & Architecture Decision Records (ADR)

This document details the systematic evaluation and evidence-based technology selection for DevSpace across all system layers.

---

## Decision 1: Programming Language & Runtime Environment

### 1. Requirement
High-performance asynchronous I/O handling, strong static type safety across data contracts, rich ecosystem for media handling and web standards, and developer productivity for a unified modular monolith.

### 2. Candidate Technologies
* **Node.js (TypeScript)**
* **Go (Golang)**
* **Python (FastAPI / asyncio)**
* **Rust (Actix-web / Axum)**

### 3. Advantages & Disadvantages
* **Node.js (TypeScript)**:
  * *Advantages*: End-to-end type sharing between backend and frontend contracts; battle-tested asynchronous non-blocking event loop ideally suited for concurrent I/O (database, S3, streams); mature ecosystem for image/media processing bindings (`sharp`, `ffmpeg`); vast community and package availability.
  * *Disadvantages*: Single-threaded event loop requires offloading CPU-intensive video tasks to worker processes; moderate memory footprint compared to compiled binaries.
* **Go**:
  * *Advantages*: Exceptional raw concurrency (goroutines); minimal memory footprint; single static binary deployments.
  * *Disadvantages*: Lacks end-to-end type sharing with TypeScript frontend; boilerplate for complex data modeling; less mature native image manipulation libraries compared to Libvips/Sharp.
* **Python**:
  * *Advantages*: Rapid scripting and readable syntax.
  * *Disadvantages*: Substantially lower raw HTTP throughput; GIL constraints; higher latency under high concurrent load; runtime type checking overhead.
* **Rust**:
  * *Advantages*: Maximum performance, zero runtime overhead, memory safety.
  * *Disadvantages*: Steep learning curve; slow iteration speed; disproportionate development complexity for an MVP/early-stage developer platform.

### 4. Evaluation Matrix
* **Expected Scale**: Node.js event-driven architecture is well-suited for high-concurrency non-blocking I/O (database calls, file streams, cache lookups). Actual throughput per core depends on handler logic, payload size, and DB query latency and must be measured through systematic load testing.
* **Cost**: Zero licensing cost; low memory footprint (120-250MB per process).
* **Operational Complexity**: Low; runs anywhere via standard Node.js runtime or container.
* **Security Implications**: TypeScript catches structural type bugs at compile time. Strict dependency auditing (`npm audit`) required.
* **Future Scalability**: Seamless multi-process clustering or container replica scaling.

### 5. Final Recommendation
**Node.js (Active LTS version supported at implementation time) with TypeScript**. It delivers the optimal balance of developer velocity, shared type safety across API boundaries, robust I/O handling, and mature ecosystem bindings for media processing.

---

## Decision 2: Backend Framework

### 1. Requirement
Low-latency HTTP routing, robust request validation, built-in support for structured logging, plugin-based encapsulation, and high throughput.

### 2. Candidate Technologies
* **Fastify (Node.js)**
* **Express.js (Node.js)**
* **NestJS (Node.js)**
* **Next.js Route Handlers (Fullstack API)**

### 3. Advantages & Disadvantages
* **Fastify**:
  * *Advantages*: Low internal routing overhead; pre-compiled JSON schema validation using Ajv (compiles schemas to high-speed validator functions); first-class structured logging powered by Pino; robust encapsulation model via plugins for modular monolith architecture.
  * *Disadvantages*: Smaller middleware ecosystem than legacy Express (though fastify-express provides backward compatibility when needed).
* **Express.js**:
  * *Advantages*: Ubiquitous, massive ecosystem.
  * *Disadvantages*: Legacy architecture (callback/promise hybrid); lacking built-in validation or schema compilation; significantly slower JSON serialization.
* **NestJS**:
  * *Advantages*: Enforced architectural patterns using Angular-like decorators and dependency injection.
  * *Disadvantages*: Heavy boilerplate, heavy abstraction layers, higher startup latency, opaque magic that complicates debugging.
* **Next.js Route Handlers**:
  * *Advantages*: Unified in one framework directory.
  * *Disadvantages*: Tied to serverless/edge paradigms; lacks persistent connection pooling semantics; awkward for long-lived background jobs and WebSocket/SSE streams.

### 4. Final Recommendation
**Fastify**. It aligns directly with modular monolith design via scoped plugins, provides pre-compiled Ajv schema validation on all inputs, and includes native Pino structured logging out of the box.

---

## Decision 3: Primary Relational Database

### 1. Requirement
ACID transactional consistency for social interactions (posts, comments, likes, follower graphs), rich relational indexing (B-Tree, GIN), high-performance Full-Text Search, JSONB support for dynamic metadata, and proven enterprise reliability.

### 2. Candidate Technologies
* **PostgreSQL (v16+)**
* **MySQL / MariaDB**
* **MongoDB**
* **SQLite (with Litestream)**

### 3. Advantages & Disadvantages
* **PostgreSQL**:
  * *Advantages*: Superb relational engine with advanced indexing (B-Tree, GIN, GiST, BRIN); built-in Full-Text Search (`tsvector`, `tsquery`) eliminating the immediate need for a separate search cluster; native `JSONB` for flexible profile metadata; powerful CTEs and window functions; robust connection pooling with PgBouncer.
  * *Disadvantages*: Requires disciplined connection pool management (process-per-connection architecture).
* **MySQL**:
  * *Advantages*: Proven web scale, simpler thread-per-connection model.
  * *Disadvantages*: Full-Text search and JSON handling are historically less powerful and flexible than Postgres; stricter schema migration nuances.
* **MongoDB**:
  * *Advantages*: Flexible schema for documents.
  * *Disadvantages*: Relational queries (e.g. joins across posts, users, likes, and follows) require complex aggregation pipelines and suffer from lack of foreign key constraints, risking orphaned or inconsistent social graph data.
* **SQLite**:
  * *Advantages*: Zero configuration, ultra-fast local reads.
  * *Disadvantages*: Single-writer lock bottleneck; unsuitable for high concurrent write bursts (likes, comments, media notifications) across distributed API replicas.

### 4. Final Recommendation
**PostgreSQL (v16+)**. It is the gold standard for social and relational applications, fulfilling data integrity, complex relational querying, full-text search, and extensibility without premature additions to the infrastructure stack.

---

## Decision 4: Database Access Layer (ORM vs Query Builder)

### 1. Requirement
Type-safe SQL queries, zero hidden N+1 performance traps, predictable generated SQL, automatic migration management, and low runtime overhead.

### 2. Candidate Technologies
* **Kysely (Type-safe SQL Query Builder)**
* **Drizzle ORM**
* **Prisma ORM**
* **TypeORM**

### 3. Advantages & Disadvantages
* **Kysely**:
  * *Advantages*: Zero-overhead pure TypeScript SQL query builder; 100% type safety inferred directly from database schema; compiles down directly to clean parameterized SQL without hidden memory allocations; zero "magic" queries—developers write explicit SQL joins, preventing accidental N+1 queries.
  * *Disadvantages*: Does not generate automated migrations on its own (typically paired with a migration runner like `umzug` or `kysely-migration-cli`).
* **Drizzle ORM**:
  * *Advantages*: Lightweight, fast, supports both relational and SQL-like syntax, built-in migration tool (`drizzle-kit`).
  * *Disadvantages*: API surface has evolved rapidly with breaking changes across minor releases.
* **Prisma ORM**:
  * *Advantages*: Great developer experience and auto-generated client.
  * *Disadvantages*: Employs an external Rust binary engine that introduces significant memory overhead (~60-120MB per container); generated SQL for relations frequently produces multiple round-trip queries; sluggish performance on bulk operations.
* **TypeORM**:
  * *Advantages*: Traditional Active Record / Data Mapper pattern.
  * *Disadvantages*: Outdated TypeScript decorator model, complex relationship bugs, stagnant maintenance.

### 4. Final Recommendation
**Kysely with pg (node-postgres) connection pooling**. Kysely gives software engineers complete control over the exact SQL being executed, prevents N+1 queries by design, has virtually zero runtime overhead, and guarantees end-to-end type safety.

---

## Decision 5: Object Storage

### 1. Requirement
Secure, durable, and cost-effective storage for user avatars, post screenshots, and raw/transcoded video files. Must support pre-signed direct uploads to bypass the API server.

### 2. Candidate Technologies
* **S3-Compatible Object Storage (AWS S3 / Cloudflare R2 / MinIO)**
* **Local Server File System (`/uploads`)**
* **Database BLOB / MongoDB GridFS**

### 3. Advantages & Disadvantages
* **S3-Compatible Object Storage**:
  * *Advantages*: Standard S3 API supported across providers; infinite horizontal scalability; decoupled from application servers; native Pre-Signed URLs allow direct browser uploads with zero API bandwidth consumption; built-in lifecycle policies.
  * *Disadvantages*: Requires S3 SDK integration and mock/MinIO instance for local offline development.
* **Local File System**:
  * *Advantages*: Simple file writes locally.
  * *Disadvantages*: Fails immediately when scaling to multiple backend instances (files written on server A are inaccessible on server B); risks filling local OS disk and crashing the server.
* **Database BLOBs**:
  * *Advantages*: Single backup destination.
  * *Disadvantages*: Bloats database size, degrades database caching and backup performance, wastefully consumes expensive DB RAM.

### 4. Final Recommendation
**Private S3-Compatible Storage Architecture with Controlled CDN Delivery**. In production, use **AWS S3** or **Cloudflare R2** with private bucket policies. Media objects are delivered strictly via CDN configured with Origin Access Control (OAC), and client uploads are conducted strictly via time-limited, cryptographically pre-signed PUT URLs. Neither the raw nor the processed buckets are directly exposed to unauthenticated public writes. For local development and automated testing, use a local S3-compatible service or an abstracted S3 adapter that can store to disk locally while exposing the identical Pre-signed URL workflow.

---

## Decision 6: Asynchronous Job Queue & Background Worker

### 1. Requirement
Offload long-running, CPU-intensive tasks (image resizing/optimization, video transcoding via FFmpeg, notification fan-out, email dispatch) from the main HTTP event loop, with retries, exponential backoff, and dead-letter queue (DLQ) support.

### 2. Candidate Technologies
* **BullMQ (Redis-backed)**
* **PostgreSQL Queue (`pg-boss` or native `FOR UPDATE SKIP LOCKED`)**
* **RabbitMQ / Celery**
* **Kafka**

### 3. Advantages & Disadvantages
* **BullMQ (Redis-backed)**:
  * *Advantages*: High throughput; built-in delayed jobs, exponential backoff, rate limiting, and parent-child job workflows; isolated from database load; rock-solid worker concurrency management.
  * *Disadvantages*: Requires a running Redis/Valkey instance.
* **PostgreSQL Queue (`pg-boss` / `SKIP LOCKED`)**:
  * *Advantages*: Zero additional infrastructure; jobs participate in relational database transactions.
  * *Disadvantages*: Poll-heavy queues generate table bloat (VACUUM pressure) and compete with user-facing queries for DB I/O and connection pool slots under heavy load.
* **RabbitMQ / Celery**:
  * *Advantages*: Advanced routing keys.
  * *Disadvantages*: Complex Erlang cluster maintenance; multi-language glue if paired with Python Celery.
* **Kafka**:
  * *Advantages*: Massive event streaming.
  * *Disadvantages*: Colossal operational overhead for task-based job processing.

### 4. Final Recommendation
**BullMQ with Redis (or Redis-compatible Valkey)** for production queue reliability, with an internal in-memory/Postgres fall-through abstraction for lightweight single-node development environments.

---

## Decision 7: Full-Text Search Strategy

### 1. Requirement
Search posts by title, body, and tags; search developers by username, bio, and skills. Must handle stemming, typo tolerance, and fast response times.

### 2. Candidate Technologies
* **PostgreSQL Full-Text Search (`tsvector`, `tsquery`, GIN indexes)**
* **Meilisearch**
* **Elasticsearch / OpenSearch**
* **Algolia**

### 3. Advantages & Disadvantages
* **PostgreSQL FTS**:
  * *Advantages*: Built into our existing database; zero extra servers to manage; instantaneous consistency (no sync lag or indexing pipeline delays); native support for ranking (`ts_rank_cd`), stemming, and GIN indexes; avoids deploying a second database cluster during initial milestones.
  * *Disadvantages*: Lacks advanced typo-tolerance (levenshtein distance requires `pg_trgm` extension); heavier on DB CPU if search query concurrency spikes significantly.
* **Meilisearch**:
  * *Advantages*: Typo tolerance, instant search as-you-type, lightweight compared to Elasticsearch.
  * *Disadvantages*: Requires running a secondary database; must maintain an ingestion sync pipeline (CDC or webhook updates); eventual consistency lag.
* **Elasticsearch**:
  * *Advantages*: Unlimited horizontal scalability.
  * *Disadvantages*: Enormous memory requirement (minimum 2GB-4GB RAM dedicated to JVM); extreme operational complexity for an early/medium-stage platform.
* **Algolia**:
  * *Advantages*: Fully managed SaaS.
  * *Disadvantages*: Expensive pay-per-search pricing model; vendor lock-in.

### 4. Final Recommendation
**PostgreSQL Full-Text Search (`tsvector` + GIN Index) combined with `pg_trgm` for trigram similarity**. This provides developer-friendly technical search with zero extra infrastructure cost and guaranteed transaction-time data consistency. Search query latency under concurrent load will be benchmarked as part of milestone validation.

---

## Decision 8: Frontend Architecture & UI Framework

### 1. Requirement
Fast initial render, responsive UI, rich interactive components (Markdown editor with live preview, syntax-highlighted code blocks, video player, infinite scroll feed), clean component modularity, and high Core Web Vitals scores.

### 2. Candidate Technologies
* **Single-Page Application (React with Vite & TypeScript)**
* **Fullstack SSR (Next.js App Router)**
* **Svelte / SvelteKit**
* **Vue 3 / Nuxt**

### 3. Advantages & Disadvantages
* **React + Vite**:
  * *Advantages*: Decoupled cleanly from backend API (API can be deployed, scaled, or debugged independently); lightning-fast development build times via Vite; massive ecosystem of developer tools, syntax highlighters (Prism/Shiki), and markdown parsers; static assets can be deployed to any CDN edge for minimal cost.
  * *Disadvantages*: Client-rendered pages require client-side data fetching for dynamic routes (managed via TanStack Query and lightweight SSR/prerender for public SEO landing routes if needed).
* **Next.js App Router**:
  * *Advantages*: Built-in SSR and server components.
  * *Disadvantages*: High complexity, blurred client/server boundaries, server component caching bugs, vendor lock-in incentives towards Vercel, heavy Node.js server overhead compared to static CDN delivery of frontend bundles.
* **Vue / Svelte**:
  * *Advantages*: Great reactivity, smaller bundle size.
  * *Disadvantages*: Smaller ecosystem of specialized syntax-highlighting and developer-tooling libraries compared to React.

### 4. Final Recommendation
**React (Current stable/LTS version supported at implementation time) with Vite, TypeScript, and TanStack Query**. Delivering the frontend as a high-speed, CDN-cached client application interacting with a versioned, secure REST API provides complete architectural separation, eliminates server-side UI rendering bottlenecks, and guarantees fast navigation.

---

## Decision 9: Media Processing Pipeline

### 1. Requirement
Automated image optimization (stripping EXIF metadata, dimension bounds, converting to WebP) and short video transcoding (H.264 MP4 with faststart, poster thumbnail extraction).

### 2. Candidate Technologies
* **Worker-Hosted Sharp (Libvips) + FFmpeg**
* **Cloudinary / Mux SaaS**
* **AWS Elemental MediaConvert**

### 3. Trade-off Analysis: MP4 vs Adaptive Streaming (HLS/DASH)
* **MP4 with `-movflags +faststart`**:
  * *Justification*: DevSpace videos are strictly short technical clips (<60 seconds, <20 MB). Generating an optimized MP4 with HTTP Range Request support avoids the extreme overhead of segmenting hundreds of chunks, generating `.m3u8`/`.mpd` manifests, and managing multi-file object lifecycles.
  * *Trade-offs & Limitations*: Does not support adaptive bitrate switching mid-stream if client bandwidth degrades. On high-latency mobile networks, initial buffer times may be higher than with 360p HLS chunks. This is an explicit, deliberate design trade-off prioritizing system simplicity.

### 4. Final Recommendation
**Sharp + FFmpeg in the Background Worker**. Sharp uses the C-based Libvips library to process images rapidly with minimal memory. FFmpeg provides exact control over video codecs, bitrates, audio channels, and poster frame extraction without paying SaaS fees.

---

## Decision 10: Authentication & Session Strategy

### 1. Requirement
Protection against credential theft, CSRF, and XSS; ability to revoke sessions server-side; persistent login across browser restarts.

### 2. Candidate Technologies
* **Stateful Database/Cache Sessions with HttpOnly Secure Cookies**
* **Stateless JWTs in LocalStorage**
* **Third-Party Auth SaaS (Auth0 / Supabase Auth)**

### 3. Advantages & Disadvantages
* **Stateful HttpOnly Cookies**:
  * *Advantages*: Mitigates token exfiltration through client-side script inspection (`document.cookie`); allows instant server-side revocation on logout, password change, or admin account suspension.
  * *Security Nuances & Remaining Risks*: While `HttpOnly` prevents an attacker from reading the raw session token via JavaScript, **it does not prevent an attacker who achieves arbitrary XSS execution from issuing authenticated API requests (`fetch`/`XMLHttpRequest`)**, because the browser automatically attaches cookies to same-origin requests. Full protection requires a defense-in-depth model: strict HTML sanitization (DOMPurify), robust Content-Security-Policy (CSP), and `SameSite` cookie controls.
* **LocalStorage JWTs**:
  * *Disadvantages*: Directly accessible to any malicious script via `window.localStorage.getItem()`; once stolen, stateless tokens cannot be revoked until expiration without maintaining a distributed revocation blocklist.

### 4. Final Recommendation
**Stateful Sessions with cryptographically secure session IDs stored in `HttpOnly`, `SameSite=Lax`, `Secure` cookies**. Paired with DOMPurify sanitization and CSP headers for defense-in-depth protection.

---

## Summary Matrix of Selected Stack

| System Layer | Selected Technology | Primary Rationale |
|---|---|---|
| **Runtime & Language** | Node.js (Active LTS) + TypeScript | High I/O performance, end-to-end type safety, unified language |
| **HTTP API Framework** | Fastify | Plugin modularity, pre-compiled Ajv schema validation, native Pino logging |
| **Primary Database** | PostgreSQL 16+ (PGlite WASM locally / pg.Pool prod) | ACID reliability, GIN full-text search, JSONB, relational integrity |
| **Data Access / ORM** | Kysely + node-postgres / PGlite | Zero runtime overhead, explicit SQL, type-safe query building, no hidden N+1 |
| **Object Storage** | Private S3-Compatible (MinIO / S3 / R2) | Private origin buckets with OAC, pre-signed upload URLs, zero public write exposure |
| **Async Queue / Worker** | BullMQ + Redis (Worker Process) | Reliable offloading of video/image transcoding, retries & backoff |
| **Search Engine** | Postgres FTS + `pg_trgm` | Zero extra infrastructure, instant consistency; performance subject to benchmarking |
| **Frontend Web App** | React (Current Stable) + Vite + TS | Decoupled client, fast UI, rich markdown/code tools, CDN deliverable |
| **Media Processing** | Sharp + FFmpeg | Low cost, high speed, complete control over dimensions and codecs |
| **Auth / Sessions** | HttpOnly Secure Session Cookies | Mitigates token exfiltration; instant server-side revocation; paired with CSP |

---

## Decision 11: Database Runtime & Local Development Dialect Strategy (ADR-011)

### 1. Requirement
Execute genuine PostgreSQL SQL DDL, schemas, UUIDs, constraints, and transactions seamlessly across all developer machines and automated CI test environments without mandating external Docker daemons or host OS service installations, while retaining standard high-performance `pg.Pool` connection pooling in production.

### 2. Context & Discovery
During Phase 12 initialization on developer Windows environments, neither Docker nor native `psql` daemon was installed in PATH. Requiring Docker would impose external system prerequisites and impede rapid local verification.

### 3. Evaluated Candidates
* **Option A: PGlite (`@electric-sql/pglite`) Dual Dialect (Approved)**: Real PostgreSQL 16 compiled to WebAssembly running inside Node.js. Shares exact SQL dialect, data types, and transactions with production PostgreSQL. Swapping to standard `PostgresDialect` with `pg.Pool` requires only setting `DATABASE_URL`.
* **Option B: Dual-Engine SQLite / Postgres**: Introduces dialect divergence (`tsvector`, UUID generators, JSONB operators behave differently).
* **Option C: Mandatory External Postgres Setup**: Enforces manual environment setup before code execution can occur.

### 4. Final Recommendation & Implementation Rule
Implement an abstract database factory in `backend/src/db/`:
* If `DATABASE_URL` is set: instantiate Kysely with `PostgresDialect` and `pg.Pool`.
* If `DATABASE_URL` is unset (local development/testing): instantiate Kysely with `PGlite` storing persisted data in `.data/pglite`.
* All migrations, queries, and constraints remain 100% native PostgreSQL.
