# DevSpace — Production Observability & Monitoring Specification

## 1. Observability Pillars Architecture
Production systems must provide immediate visibility into performance, regressions, bottlenecks, and security events. DevSpace adheres to the three core pillars of observability (Logs, Metrics, Traces) plus continuous Health Probing and Audit Logging.

```
┌────────────────────────────────────────────────────────┐
│                   DevSpace Platform                    │
├───────────────────┬───────────────────┬────────────────┤
│  Structured Logs  │  System Metrics   │ Health Probes  │
│    (Pino JSON)    │ (Prometheus / OTel)│(/healthz/ready)│
├───────────────────┼───────────────────┼────────────────┤
│  Audit Trail Log  │ Background Queue  │ Error Tracking │
│  (DB audit_logs)  │  (BullMQ Metrics) │(Sentry / Alerts│
└───────────────────┴───────────────────┴────────────────┘
```

---

## 2. Structured JSON Logging (Pino)

### 2.1 Log Schema Standard
All logs emitted by Fastify, background workers, and services follow a standardized structured JSON format:

```json
{
  "level": 30,
  "time": "2026-10-06T12:00:01.452Z",
  "pid": 14201,
  "hostname": "api-worker-prod-1",
  "reqId": "req-c8f74211-e402-491b",
  "userId": "c1f2b4b2-5f67-4e98-963b-9e4a3b8417c8",
  "method": "POST",
  "url": "/api/v1/posts",
  "statusCode": 201,
  "durationMs": 14.82,
  "msg": "Post created successfully",
  "context": {
    "postId": "90e44b82-628f-431f-9da8-26f584e27f05",
    "mediaCount": 2,
    "tags": ["postgresql", "architecture"]
  }
}
```

### 2.2 Privacy & PII Redaction
* Password fields, session tokens, authorization headers, and credit card / PII data are automatically redacted via Pino serializers before serialization.
* Log levels:
  * `trace` / `debug`: Local development only.
  * `info`: Request lifecycle, state-changing events, worker job completion.
  * `warn`: Rate limit hits, client-side 4xx errors, retryable network timeouts.
  * `error`: Uncaught exceptions, database query failures, media transcode rejections.

---

## 3. Health Checks & Probes

DevSpace implements standard Kubernetes/Docker liveness and readiness probe semantics:

### 3.1 Liveness Probe: `GET /healthz`
* **Purpose**: Verifies that the Node.js process event loop is responsive.
* **Checks**:
  * Process uptime.
  * Event loop lag (< 100ms).
* **Response (200 OK)**:
  ```json
  { "status": "ok", "uptimeSeconds": 84210 }
  ```

### 3.2 Readiness Probe: `GET /readyz`
* **Purpose**: Verifies that external stateful dependencies are reachable and healthy before routing traffic.
* **Checks**:
  1. **PostgreSQL**: Executes `SELECT 1;` via the connection pool.
  2. **Object Storage**: Performs an S3 `HeadBucket` check.
  3. **Queue / Redis**: Sends a `PING` command to the Redis broker.
* **Failure Response (503 Service Unavailable)**:
  ```json
  {
    "status": "degraded",
    "dependencies": {
      "database": { "status": "healthy", "latencyMs": 2.1 },
      "storage": { "status": "healthy", "latencyMs": 14.3 },
      "redisQueue": { "status": "down", "error": "Connection refused" }
    }
  }
  ```

---

## 4. Key Performance Metrics (Prometheus / OpenTelemetry)

### 4.1 Golden Signals Monitored
1. **Latency**:
   * `http_request_duration_seconds` (Histogram by route, method, and status code).
   * Percentiles tracked: p50, p95, p99.
2. **Traffic**:
   * `http_requests_total` (Counter by route and method).
3. **Errors**:
   * `http_errors_total` (Counter partitioned by 4xx client errors vs 5xx server errors).
4. **Saturation**:
   * `process_cpu_usage_ratio` & `process_memory_rss_bytes`.
   * `pg_pool_active_connections` vs `pg_pool_idle_connections` vs `pg_pool_waiting_queries`.

### 4.2 Background Worker Metrics
* `queue_active_jobs_count`
* `queue_waiting_jobs_count`
* `queue_failed_jobs_total` (Counter triggering alerts if > 5 failures in 10 minutes)
* `media_transcode_duration_seconds` (Histogram by media type: image vs video)

---

## 5. Database Performance & Slow Query Monitoring

1. **Slow Query Threshold**: Any SQL query taking > 100ms logs a warning with the parameterized SQL template and execution plan (`EXPLAIN ANALYZE`).
2. **Postgres Extensions**:
   * `pg_stat_statements` enabled to monitor top 10 most time-consuming queries across the entire database.
   * `pg_stat_activity` inspected for transaction lock waiting times.

---

## 6. Audit Logging for Security & Sensitive Operations

All sensitive administrative and moderation actions write an immutable record to the `audit_logs` table:

* User role changes (e.g., promoting user to moderator).
* Account suspensions or ban actions.
* Moderator content suppression (soft-deleting violating posts or comments).
* Password reset requests and email changes.
* API key and session mass-revocations.

Each audit record captures:
`actor_id`, `action`, `entity_type`, `entity_id`, `ip_address`, `timestamp`, and `metadata` (before/after state diff).
