# DevSpace — Security Architecture & Threat Modeling

## 1. Threat Modeling Overview (STRIDE)
As a developer social platform handling user-submitted code snippets, markdown, files, and authentication credentials, DevSpace faces distinct threats categorized via STRIDE:

| Threat Category | Primary Risk in DevSpace | Architectural Mitigation |
|---|---|---|
| **Spoofing** | Credential stuffing, session hijacking | Argon2id hashing, secure HttpOnly cookie sessions, IP/user rate limiting. |
| **Tampering** | Modifying other users' posts or comments | Centralized RBAC/ownership policy middleware; parameterized SQL queries. |
| **Repudiation** | Denying malicious actions (e.g. spam/banning) | Immutable `audit_logs` table recording actor ID, IP address, and payload delta. |
| **Information Disclosure** | Leakage of password hashes, emails, or internal tokens | Strict DTO serialization; no client exposure of database credentials or secrets. |
| **Denial of Service** | Decompression bombs, infinite query depth, brute-force auth | Upload size caps, Sharp pixel bounds, cursor pagination limits, Redis-based rate limiting. |
| **Elevation of Privilege** | Escalating from standard user to admin | Role field in JWT/session is immutable by user; verified server-side on every privileged endpoint. |

---

## 2. Authentication & Credential Security

### 2.1 Password Hashing Specification
* Algorithm: **Argon2id** (RFC 9106 recommended).
* Cost Parameters:
  * Memory: 64 MB ($m = 65536$)
  * Iterations: 3 passes ($t = 3$)
  * Parallelism: 4 threads ($p = 4$)
* Work Factor Fallback: If running on minimal memory environments, fallback to **Bcrypt** with salt rounds = 12.
* Constant-Time Comparisons: Used for all hash and secret comparisons to eliminate timing attack vectors.

### 2.2 Session Management & Cookie Hardening
* Sessions use cryptographically random 256-bit entropy generated via `crypto.randomBytes(32)`.
* Only the SHA-256 hash of the session token is stored in the database (`token_hash`), preventing session impersonation even in the catastrophic event of a read-only database leak.
* Cookie Attributes:
  * `HttpOnly = true`
    * **What HttpOnly Protects Against**: It prevents client-side JavaScript from reading `document.cookie`, stopping raw session token exfiltration via basic script injection.
    * **What XSS Risks Still Remain**: `HttpOnly` does **not** neutralize active within-origin XSS execution. An attacker who injects and executes arbitrary JavaScript in the victim's browser session can still issue authenticated HTTP requests (`fetch('/api/v1/posts', ...)` or account mutation actions) because the user's browser automatically attaches same-origin cookies to outgoing requests. Furthermore, the attacker could inspect or manipulate the DOM or exfiltrate on-screen data.
    * **Required Defense-in-Depth**: Because `HttpOnly` does not prevent in-browser session abuse, XSS prevention must be enforced at the root: strict HTML sanitization (DOMPurify with an airtight tag whitelist) to prevent malicious script injection entirely, combined with a restrictive Content Security Policy (CSP).
  * `Secure = true` (Transmitted strictly over TLS/HTTPS in production).
  * `SameSite = Lax` (Protects against Cross-Site Request Forgery for state-changing endpoints while allowing top-level navigation).
  * `Path = /`
  * `Max-Age = 2592000` (30 days with rolling refresh on active usage).

---

## 3. Authorization & Access Control (RBAC/ABAC)

Authorization is enforced via composable policy middleware in the Fastify routing pipeline:

```typescript
// Architectural Guard Pattern
export function requireOwnershipOrRole(resourceService, allowedRoles = ['admin']) {
  return async (request, reply) => {
    const user = request.currentUser;
    const resourceId = request.params.id;
    const resource = await resourceService.findById(resourceId);

    if (!resource) {
      return reply.status(404).send({ error: 'Resource not found' });
    }

    const isOwner = resource.author_id === user.id || resource.user_id === user.id;
    const hasRole = allowedRoles.includes(user.role);

    if (!isOwner && !hasRole) {
      return reply.status(403).send({ 
        error: 'Forbidden: You do not have permission to modify this resource' 
      });
    }
    request.resource = resource;
  };
}
```

---

## 4. Input & Output Validation

### 4.1 Input Validation (Zod / Ajv)
Every incoming request body, query parameter, and path variable is strictly validated against pre-compiled schemas before hitting business logic.
* Strip unexpected properties (`stripUnknown: true` / `additionalProperties: false`) to prevent mass assignment vulnerabilities.
* Enforce maximum string lengths on all fields (e.g., Post title max 255 chars, Post content max 50,000 chars, Bio max 500 chars).

### 4.2 SQL Injection Prevention
* 100% of database interactions are performed via parameterized queries through Kysely.
* String interpolation into SQL queries is forbidden by linting rules (`no-unsafe-query`).

### 4.3 Stored XSS Prevention in Developer Markdown
Developers publish code snippets and markdown containing tags like `<pre>`, `<code>`, and backticks. To prevent Stored Cross-Site Scripting (XSS):
1. **Server-Side Storage**: Raw markdown is stored as authored (allowing users to edit original text).
2. **HTML Generation & Sanitization**:
   * Markdown is parsed via an AST parser (e.g. `marked` or `remark`).
   * Output HTML is sanitized through **DOMPurify** with a strict whitelist:
     * Allowed tags: `p`, `b`, `i`, `em`, `strong`, `a`, `h1`-`h6`, `pre`, `code`, `ul`, `ol`, `li`, `blockquote`, `table`, `thead`, `tbody`, `tr`, `th`, `td`, `img`.
     * Explicitly blocked tags: `script`, `iframe`, `object`, `embed`, `style`, `svg`, `form`, `input`.
     * Allowed URI schemes: strictly `https://`, `http://`, `mailto:`. Block all `javascript:` and `data:` URI links.
3. **Client-Side Rendering**: Rendered inside React with sanitized markup; never using un-sanitized `dangerouslySetInnerHTML`.

---

## 5. Network & HTTP Security Headers

Fastify registers `@fastify/helmet` with a production Content Security Policy (CSP):

```http
Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; img-src 'self' data: https://*.cloudfront.net https://*.r2.cloudflarestorage.com; media-src 'self' https://*.cloudfront.net https://*.r2.cloudflarestorage.com; connect-src 'self'; frame-ancestors 'none';
Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
X-XSS-Protection: 0
Referrer-Policy: strict-origin-when-cross-origin
```

### CORS Configuration
* CORS is restricted to explicit known domain origins (`https://devspace.app` or `http://localhost:5173` in local dev).
* `credentials: true` enabled for cross-origin cookie delivery between client origin and API origin.
* Wildcard `*` origins with credentials are strictly forbidden.

---

## 6. Multi-Tier Rate Limiting & Abuse Prevention

Rate limiting is enforced at both the IP level and the Authenticated User ID level:

| Endpoint Route | Window | Limit | Rationale |
|---|---|---|---|
| `/api/v1/auth/login` | 1 minute | 5 requests | Prevent brute-force password cracking |
| `/api/v1/auth/register` | 1 hour | 3 requests | Prevent automated spam bot registrations |
| `/api/v1/posts` (POST) | 10 minutes | 5 requests | Prevent spam post flooding |
| `/api/v1/comments` (POST) | 1 minute | 10 requests | Prevent comment spam bots |
| `/api/v1/media/upload-url` | 15 minutes | 15 uploads | Prevent storage quota exhaustion |
| Global API routes | 1 minute | 120 requests | General DDoS / scraper throttling |

* Exceeded limits return HTTP `429 Too Many Requests` with `Retry-After: <seconds>` headers.

---

## 7. Secrets Management & Environment Isolation

* All sensitive configurations (Database credentials, S3 Access Keys, JWT/Cookie signing keys) are loaded through environment variables validated at startup via a strict Zod configuration schema.
* If any required secret is missing or empty, the application **fails fast and terminates immediately during boot**.
* Secrets are excluded from version control via `.gitignore`.
* A sanitized template `.env.example` provides explicit variable documentation without secret values.
* Client-facing bundles never bundle private secrets; only public configuration variables prefixed with `VITE_` are accessible on the client.
