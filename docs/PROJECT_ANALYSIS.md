# DevSpace — Project Discovery & Requirements Analysis

## 1. Executive Summary & Purpose
DevSpace is an engineering-first developer community platform combining long-form rich technical discussions, code snippets, visual architecture diagrams, short video demonstrations (debugging walkthroughs, UI demos), and peer networking.

Unlike general-purpose social networks, DevSpace targets developers, necessitating:
* Native syntax-highlighted code support and markdown rendering.
* Robust media handling for screenshots, architecture diagrams, and short technical screencasts (<60 seconds).
* High-performance feeds with zero tolerance for sluggish responsiveness or jitter.
* Rigorous security against XSS (due to user-submitted code and HTML markdown formatting).

---

## 2. Comprehensive Requirements Breakdown (23 Dimensions)

### 1. Functional Requirements
* **Account Management**: Registration via email/password, credential validation, email verification (optional in v1, required in production), password reset flows.
* **Authentication & Session**: Secure login, session issuance/revocation, logout, and token refresh.
* **User Profiles**: Custom handle (`@username`), display name, bio (Markdown/text), avatar image, cover image, GitHub/GitLab/portfolio URLs, tech stack tags, follower/following counts, activity counters.
* **Post Publishing**:
  * Title and rich body supporting GitHub Flavored Markdown (GFM) and fenced code blocks with language tagging.
  * Tagging system (`#typescript`, `#architecture`, `#postgres`, etc.).
  * Media attachments (up to 4 images OR 1 short video clip per post).
  * Edit and soft-delete capabilities.
* **Media Uploads**: Images (JPEG, PNG, WebP) and short technical videos (MP4, WebM; max 60 seconds).
* **Social Interactions**:
  * Like / unlike posts (idempotent toggling).
  * Threaded / nested comments on posts (up to 2 levels of nesting to balance readability and query performance).
  * Follow / unfollow users.
* **Personalized Feed**:
  * "Following" feed: Chronological or reverse-chronological stream of posts from followed authors.
  * "Explore / Trending" feed: Algorithmically ranked or engagement-weighted recent posts for discovery.
* **Search**:
  * Full-text search for posts (matching title, body, and tags).
  * User search (matching username, display name, bio, and skills).
* **Notifications**:
  * In-app notifications inbox: Likes, comments, mentions (`@username`), and new followers.
  * Real-time notification badge counter.
* **Activity & Audit**:
  * User activity history view (own posts, comments, likes).
  * System audit log for moderation actions (post moderation, account suspension).

---

### 2. Non-Functional Engineering Targets (Target SLOs — Pending Validation)
* **Target Latency Objectives (SLOs to be verified via benchmarking)**:
  * Feed retrieval: Target p95 < 150ms, p99 < 300ms under nominal load.
  * API CRUD operations: Target p95 < 100ms.
  * Media processing: Video transcoding completion target < 30 seconds for a 60-second clip on a dedicated 2-core worker.
* **Availability Target**: 99.9% uptime design target.
* **Data Integrity**: Zero data loss for published content and interactions; strict relational integrity with foreign keys and ACID transactions where appropriate.
* **Compatibility**: Fully responsive web application supporting desktop, tablet, and mobile viewport widths.
* **SEO & Crawlability**: Public posts and profiles must be indexable and deliver OpenGraph meta tags for rich social sharing.

---

### 3. Authentication Requirements
* Password hashing using **Argon2id** (memory-hard, resistant to GPU cracking) with strict parameters (m=65536, t=3, p=4) or high-work-factor **Bcrypt** (cost 12).
* Session representation: Cryptographically secure, random 256-bit session tokens stored in secure, `HttpOnly`, `SameSite=Lax`, `Secure` cookies.
  * *Security Nuance*: `HttpOnly` strictly prevents direct client-side script reading of `document.cookie`, mitigating credential exfiltration by basic script injection. It does *not* neutralize active within-origin XSS execution (where an attacker's injected script can still issue authenticated `fetch` requests directly from the victim's browser session). Comprehensive mitigation requires strict Content-Security-Policy (CSP) and rigorous HTML sanitization.
* Protection against brute-force attacks via account lockout / exponential rate limiting per IP and per username.
* Multi-session management: Users should be able to view and revoke active sessions across devices.

---

### 4. Authorization & Access Control
* **Attribute-Based & Role-Based Access Control (RBAC/ABAC)**:
  * Users can only edit/delete their own resources (posts, comments, profile).
  * Moderators can hide/flag/delete violating content and view audit logs.
  * Administrators can assign roles, manage system settings, and suspend accounts.
* Fine-grained resource ownership validation enforced centrally in the service/middleware layer, never delegated to client trust.

---

### 5. User Roles & Hierarchy
| Role | Permissions |
|---|---|
| **Anonymous (Guest)** | Read public posts, view public profiles, search content. Cannot post, comment, like, or follow. |
| **Standard User** | All Guest permissions + create/edit/delete own posts/comments, upload media, like, follow, receive notifications. |
| **Moderator** | All User permissions + soft-delete/hide any post or comment, inspect reported content queue. |
| **Admin** | All Moderator permissions + suspend/ban users, manage roles, access system metrics and audit logs. |

--### 6. Expected Number of Users & Sizing Milestones
We define clear sizing milestones:
* **Milestone 1 (Launch / MVP)**: 1,000 registered users.
* **Milestone 2 (Growth / Year 1)**: 25,000 registered users (5,000 Monthly Active Users).
* **Milestone 3 (Scale / Target)**: 100,000 registered users (20,000 Daily Active Users).

---

### 7. Expected Concurrent Users (CCU)
* **Milestone 1**: 20 – 50 concurrent users.
* **Milestone 2**: 250 – 500 concurrent users.
* **Milestone 3**: 1,000 – 2,500 peak concurrent users (during tech announcements, newsletter launches, or live events).
* **Future Stress-Test Target**: 10,000 CCU is identified solely as a future stress-test engineering target to evaluate horizontal scaling thresholds, **not** as a capacity currently tested or validated.

> [!IMPORTANT]
> **Scalability Status Classification**:
> * **Designed for scalability**: Architecture avoids stateful bottlenecks and unbounded scans.
> * **Implemented for scalability**: Code includes indexes, connection pools, and async queues.
> * **Tested for scalability**: Requires systematic synthetic load testing (e.g. k6 / Locust).
> * **Proven under a specific workload**: Real production metrics under authentic user traffic.
> DevSpace is currently **Designed for scalability**, but capacity claims remain unproven until validated by load tests.

---

### 8. Expected Traffic Patterns & Read/Write Ratio
* **Social Content Asymmetry**: Typical 90:10 to 95:5 read-to-write ratio.
* For every 1 post created:
  * ~20-50 reads of that post in feeds.
  * ~2-5 likes.
  * ~0.5-1 comments.
* **Traffic Spikes**: Traffic surges during morning hours (8 AM - 11 AM) and post-work hours (6 PM - 9 PM) in primary user timezones.
* **Write Burstiness**: Bulk likes and comments during trending discussions require connection pooling and lightweight write transactions.

---

### 9. Expected Database Sizing (Year 1 Projection)
Assuming 25,000 users, 100,000 posts, 500,000 comments, 1,500,000 likes, and 300,000 notifications:
* `users` + `profiles`: ~25,000 rows × 1 KB ≈ 25 MB
* `posts`: 100,000 rows × 2 KB (text + metadata) ≈ 200 MB
* `comments`: 500,000 rows × 0.5 KB ≈ 250 MB
* `likes`: 1,500,000 rows × 48 bytes ≈ 72 MB
* `follows`: 200,000 rows × 40 bytes ≈ 8 MB
* `notifications`: 500,000 rows × 120 bytes ≈ 60 MB
* `audit_logs`: 100,000 rows × 256 bytes ≈ 25 MB
* **Total Raw Data**: ~640 MB
* **Indexes & Search Vectors (GIN/B-Tree)**: ~650 MB
* **Total Database Footprint Year 1**: **1.3 GB – 2.0 GB**
* **Conclusion**: The entire relational dataset easily fits in working memory (RAM) for affordable modern server instances (4 GB – 8 GB RAM).

---

### 10. Expected Media Volume
* **Images**:
  * 25,000 avatars × 150 KB = 3.75 GB
  * 50,000 post images × 600 KB (optimized WebP) = 30 GB
* **Videos**:
  * 5,000 videos × 15 MB (transcoded multi-bitrate/resolutions) = 75 GB
* **Total Media Storage Year 1**: **~110 GB**
* **Bandwidth Estimate**:
  * 1,000,000 image views/month × 300 KB average = 300 GB/month egress
  * 100,000 video views/month × 8 MB average = 800 GB/month egress
  * **Conclusion**: Media must be served through an external CDN with aggressive caching (`Cache-Control: public, max-age=31536000, immutable`) to avoid catastrophic origin server bandwidth saturation.

---

### 11. Image Upload Requirements
* **Allowed Formats**: JPEG, PNG, WebP, AVIF. (GIFs converted to MP4 or limited to animated WebP).
* **File Size Cap**: Max 5 MB raw upload.
* **Validation**:
  * Client-side check (MIME + size).
  * Server-side magic-byte sniffing (verifying byte headers, not trusting file extensions).
  * Image dimension check (max 3840×2160 to prevent decompression bomb / Pixel Flood attacks).
* **Processing**: Strip all EXIF/GPS metadata; auto-orient; generate thumbnail (300×300) and web-optimized responsive version (max 1920px width, WebP format at 80% quality).

---

### 12. Video Upload Requirements
* **Duration**: Maximum 60 seconds.
* **Raw Upload Cap**: Maximum 50 MB.
* **Allowed Codecs/Containers**: MP4 (H.264/AAC), WebM (VP8/VP9/Opus).
* **Architecture**: Direct-to-storage upload via pre-signed URL; background asynchronous processing via worker queue; probe container metadata; generate poster frame thumbnail; transcode to standard web-compatible MP4 (H.264 baseline/main profile, 720p 30fps).
* **Trade-off Analysis (MP4 vs HLS/DASH)**:
  * *Why MP4 with `+faststart`*: For short technical screencasts (<60s, <20 MB), MP4 eliminates the operational overhead of segmenting hundreds of `.ts`/`.m4s` chunks, generating playlist manifests, and maintaining complex multi-file lifecycle policies.
  * *Limitations of MP4*: Lacks dynamic adaptive bitrate switching during playback (cannot drop from 720p to 360p mid-stream if client bandwidth fluctuates). On degraded or high-latency mobile connections, initial buffer wait times may be longer than adaptive HLS chunks. This is an explicit, deliberate design trade-off prioritizing system simplicity for short-form clips.

---

### 13. Read/Write Patterns & Feed Scalability Bottleneck Analysis
* **Feed Generation Strategy**:
  * Queries `posts` joined with `follows` using keyset pagination:
    ```sql
    SELECT p.* FROM posts p
    INNER JOIN follows f ON p.author_id = f.following_id
    WHERE f.follower_id = $current_user_id AND (p.created_at, p.id) < ($cursor_time, $cursor_id)
    ORDER BY p.created_at DESC, p.id DESC LIMIT 20;
    ```
* **Bottleneck Threshold Analysis**:
  * *When it works well*: Ideal for Milestone 1 and early Milestone 2 where users follow < 500 accounts and composite indexes `(author_id, created_at DESC)` remain memory-cached.
  * *When it becomes a bottleneck*: If a user follows thousands of accounts (>1,000–2,000 following), the `INNER JOIN` forces the query planner to evaluate a large union of index scans, leading to increased I/O and query latency. Furthermore, when `posts` table volume exceeds available RAM, cache miss rates will elevate disk I/O.
  * *Mitigation Path*: When user followings or database volume reach these thresholds, the system will introduce a hybrid cached timeline strategy (e.g. Redis timeline lists for active users) or pre-aggregated materialized feed views.
  * *Latency Claim Notice*: Specific sub-millisecond or sub-15ms figures are unproven without synthetic database benchmarks under production-scale data distributions.

---

### 14. Search Requirements
* Search must support:
  * Keyword search matching post title, markdown body, and tags.
  * Technical terms matching (e.g., `react-router`, `async/await`, `C++`, `SQL`).
  * User lookups by handle (`@username`) or display name.
* **Execution**: Full-text search with inverted indexes (PostgreSQL `tsvector` and `GIN` index with English dictionary) avoids introducing Elasticsearch/Meilisearch cluster overhead for Phase 1 & 2. Performance under heavy concurrent query load must be benchmarked.

---

### 15. Notification Requirements
* Notifications generated on:
  1. Post Liked
  2. Comment Added
  3. User Followed
  4. Mention in Post or Comment
* Notifications aggregated in database with `is_read` boolean flag.
* Delivery: In-app real-time indicator via Server-Sent Events (SSE) or polling endpoint + persistent inbox query.

---

### 16. Performance Objectives (Target Metrics — Subject to Benchmarking)
* API response time targets (nominal): TTFB < 100ms for cached/indexed GET requests; CRUD mutations < 150ms.
* Core Web Vitals targets:
  * Largest Contentful Paint (LCP) < 2.5s
  * Interaction to Next Paint (INP) < 200ms
  * Cumulative Layout Shift (CLS) < 0.1

---

### 17. Security Requirements
* Full OWASP Top 10 mitigation:
  * Strict HTML sanitization on Markdown output (preventing stored XSS while preserving code highlighting).
  * Parameterized queries / ORM protection against SQL injection.
  * SameSite cookie security against CSRF.
  * Content Security Policy (CSP), HSTS, X-Content-Type-Options headers.
  * Rate limiting on sensitive endpoints (auth, media upload, post creation).
  * Storage isolation: S3 uploads execute via time-limited Pre-Signed URLs with strict content-length and content-type constraints.

---

### 18. Availability Requirements
* Uptime target: 99.9%.
* Automated health probes (`/healthz` for process liveness, `/readyz` for database and storage dependency checks).
* Automated process supervisor (systemd / PM2 / Docker healthcheck restart policy).
* Graceful shutdown: Active HTTP connections drained within 10 seconds before SIGKILL.

---

### 19. Scalability Requirements
* Stateless API tier: All session state stored in database or distributed store; no in-memory session pinning.
* Horizontal scale-out capability behind reverse proxy / load balancer.
* Read replicas can be attached to database if read traffic surges 10x.
* Decoupled background queue for media transcoding so web servers never block CPU on video rendering.

---

### 20. Budget Constraints & Infrastructure Cost
* Target: Lean operational footprint.
* Phase 1 MVP running on a single cloud VPS or minimal container instance ($10 - $25/month) using PostgreSQL and S3-compatible storage.
* Zero paid proprietary software licenses or expensive SaaS vendor lock-in.

---

### 21. Development & Operational Complexity
* Minimal moving parts: No unnecessary Kubernetes cluster, no unneeded distributed microservice orchestration, no unneeded external cache cluster until proven necessary by metrics.
* Single language stack (TypeScript end-to-end) across frontend, backend, and workers to share types, validation schemas, and domain interfaces.

---

### 22. Maintenance Requirements
* Declarative, version-controlled database schema migrations.
* Deterministic database seeding for local development and automated testing.
* Automated daily database backup with WAL archiving.
* Zero manual SSH steps for deployments (automated CI/CD scripts).

---

### 23. Future Expansion Requirements
* Direct messaging (P2P or group chat).
* Interactive live code execution sandbox (WebAssembly or isolated Docker containers).
* OAuth2 / GitHub login integration.
* Bookmarking / reading list collections.

---

## 3. Explicit Identification of Missing Information & Clarified Assumptions

### Missing Information Identified
1. **Third-party OAuth requirements**: Prompt specifies "create an account / sign in / sign out" without specifying whether GitHub/GitLab OAuth is mandatory at launch or email/password is the primary method.
2. **Video Streaming Protocol & Bitrate Adaptivity**: Short videos (<60s) are selected for single-bitrate MP4 with faststart; if production usage reveals heavy mobile buffering under poor connectivity, adaptive HLS transcoding can be evaluated as a future enhancement.
3. **Email Delivery Provider**: Password resets and account verification require an SMTP or transactional email provider (SendGrid, Postmark, AWS SES).

### Documented Engineering Assumptions
1. **Authentication Baseline**: Implement rock-solid Email & Password authentication with Argon2id hashing and cryptographically secure sessions as the core foundation, with modular interfaces designed to plug in GitHub OAuth seamlessly.
2. **Video Delivery Format**: For short technical video clips under 60 seconds (typically 5 MB - 20 MB), transcoding into web-ready **H.264/AAC MP4** with `-movflags +faststart` and HTTP Range Request support balances implementation simplicity with rapid initial playback, accepting the documented limitation of single-bitrate playback.
3. **Search Engine**: PostgreSQL built-in Full-Text Search (`tsvector`, `tsquery`, GIN indexes) is assumed for Milestone 1 & 2. Performance must be benchmarked under simulated data volumes before declaring production search latency SLA.100k posts with sub-20ms search latencies.
