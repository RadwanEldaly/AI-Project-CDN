# DevSpace — Final Architecture Review & Pre-Implementation Audit

This document records the rigorous architectural audit, corrections, verified assumptions, and testing mandates established prior to Phase 12 implementation.

---

## 1. Architectural Changes & Corrections Made

| Category | Initial Formulation | Audited & Corrected Formulation |
|---|---|---|
| **Runtime & Framework Versions** | Hard-locked to Node.js 20 LTS and React 18. | Updated to **Node.js Active LTS** and **React Current Stable/LTS** supported at implementation time, ensuring version flexibility without artificial pinning. |
| **Performance Claims** | Asserted speculative metrics ("Fastify is 2x-4x faster", "queries take <15ms", "FTS is <20ms"). | Removed all speculative claims. Replaced with **Measurable Engineering Target Objectives (SLOs)** that require formal verification via benchmark test harnesses. |
| **Scalability & Concurrency Claims** | Implicitly claimed system support for 10,000 concurrent users. | Formalized a 4-tier status classification. DevSpace is **Designed for scalability**, but capacity remains strictly unproven. **10,000 CCU** is explicitly designated as a **future stress-test target**, not an active capacity. |
| **Object Storage Topology** | Stated processed media lived in a "public bucket". | Mandated **Private Origin Storage** for both raw and processed buckets. Public writes and bucket browsing are completely blocked. Delivery is mediated strictly via **CDN Origin Access Control (OAC)**, and ingestion strictly via time-limited, signed PUT URLs. |
| **Session Security Nuances** | Stated HttpOnly cookies make sessions "immune to XSS". | Corrected to technically precise threat modeling: `HttpOnly` stops raw token exfiltration via `document.cookie`, but **does not protect against active within-origin XSS execution** (where injected scripts execute authenticated `fetch` calls). Defense-in-depth via DOMPurify and strict CSP is documented as mandatory. |
| **Video Streaming Strategy** | Claimed universal 200ms playback superiority for faststart MP4 over HLS. | Removed 200ms claim. Retained MP4 with `-movflags +faststart` for short clips (<60s) due to pipeline simplicity, but explicitly documented trade-offs: lack of dynamic adaptive bitrate switching and potential initial buffering on high-latency mobile networks. |
| **Database Schema (Likes & Counters)** | Conceptual pseudo-code for likes incrementation. | Formulated database-enforced integrity: `chk_like_target` strictly enforces XOR (post vs comment), partial unique indexes guarantee idempotency, and an atomic CTE query prevents counter race conditions. |
| **Feed Scalability Bottleneck** | Claimed unindexed fan-out-on-read was universally optimal. | Conducted a bottleneck analysis: identified that fan-out-on-read degrades when accounts follow >1,000 users or when table size exceeds memory buffer pools. Documented the transition roadmap to Redis timeline caching. |
| **Traffic Milestone Consistency** | Inconsistent concurrency definitions. | Reconciled milestones: Milestone 1 (1k users, 20–50 CCU); Milestone 2 (25k users, 250–500 CCU); Milestone 3 (100k users, 1k–2.5k CCU); 10k CCU defined strictly as a future stress-test target. |
| **Architectural Simplicity** | Evaluated complex alternative topologies. | Re-confirmed that **Modular Monolith + Asynchronous Background Worker** remains the simplest architecture satisfying all functional, media, and reliability requirements without microservice orchestration overhead. |

---

## 2. Four-Tier Scalability Classification

To avoid premature or false production readiness claims, the project strictly enforces this terminology:

1. **Designed for scalability**: Data models use keyset cursor pagination; database schemas include covering composite indexes; the application tier is completely stateless; heavy video/image tasks are decoupled into background queues. *(Current status of DevSpace architecture)*.
2. **Implemented for scalability**: Code enforces non-blocking async I/O, database connection pool limits, and rate limiters. *(Phase 12 goal)*.
3. **Tested for scalability**: System behavior, p95/p99 latencies, and error rates have been measured under simulated traffic using synthetic load tools (k6, Locust, autocannon). *(Phase 13 requirement)*.
4. **Proven under a specific workload**: Demonstrated performance under authentic, sustained production end-user traffic over extended operational periods.

---

## 3. Remaining Engineering Assumptions

1. **Authentication Core**: Direct Email/Password authentication using Argon2id with server-side stateful session cookies serves as the v1 foundation; OAuth providers (GitHub) will be integrated via clean pluggable adapter interfaces.
2. **Short-Form Video Duration**: Video clips are capped at 60 seconds and 50 MB raw upload. If business requirements expand to long-form videos (>3 minutes), the media architecture must transition to HLS/DASH adaptive multi-bitrate segmentation.
3. **PostgreSQL FTS Capacity**: Built-in PostgreSQL Full-Text Search with GIN indexes and `pg_trgm` will sufficiently serve discovery through Milestones 1 and 2. Migration to an external search cluster (e.g. Meilisearch) is deferred until database CPU metrics justify it.
4. **Email Dispatch**: External transactional email delivery (SMTP/SES) will be mocked or queued in development and connected via standard transport adapters in production.

---

## 4. Claims Requiring Benchmarking & Load Testing Validation

The following items are explicit design goals and **must not be characterized as proven** until benchmark results are captured in Phase 13:

* **Feed Query Latency**: Target p95 < 150ms for cursor-paginated following feeds with 20 items per page under concurrent reads.
* **Search Query Latency**: Target response time < 100ms for full-text queries across a dataset of 50,000+ posts with active GIN indexes.
* **Database Concurrency & Connection Pooling**: Stability and latency percentiles under 250–500 concurrent users against a pool of 20 PostgreSQL connections.
* **Media Worker Throughput**: Transcoding completion time for a 60-second 1080p video clip on a 2-core background worker instance.
* **Rate Limiter Precision**: Zero-leak rate limiting under burst attacks against `/api/v1/auth/login` and `/api/v1/media/upload-url`.
