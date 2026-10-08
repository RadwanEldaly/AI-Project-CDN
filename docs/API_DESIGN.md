# DevSpace — RESTful API Design Specification

## 1. Global API Standards & Conventions

### 1.1 Base URL & Versioning
All public endpoints are versioned under:
```
/api/v1
```

### 1.2 Uniform Response Envelope
All API endpoints return standardized JSON payloads:

#### Success Response Envelope
```json
{
  "success": true,
  "data": { ... },
  "meta": {
    "cursor": "2026-10-06T12:00:00Z_post_123",
    "hasMore": true,
    "total": 1240
  }
}
```

#### Error Response Envelope
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_FAILED",
    "message": "Title must be between 5 and 255 characters",
    "details": [
      {
        "field": "title",
        "issue": "String must contain at least 5 character(s)"
      }
    ]
  }
}
```

### 1.3 Standard HTTP Status Codes
* `200 OK`: Request succeeded with data payload.
* `201 Created`: Resource successfully created.
* `202 Accepted`: Asynchronous operation queued (e.g., media transcode).
* `204 No Content`: Resource deleted or action executed with no return body.
* `400 Bad Request`: Malformed JSON or syntax error.
* `401 Unauthorized`: Missing or invalid authentication token/cookie.
* `403 Forbidden`: Authenticated user lacks permission to modify or access resource.
* `404 Not Found`: Resource does not exist.
* `409 Conflict`: Unique constraint violation (e.g. duplicate username or email).
* `422 Unprocessable Entity`: Input payload failed schema validation.
* `429 Too Many Requests`: Rate limit threshold exceeded.
* `500 Internal Server Error`: Unhandled server error (details masked from client).

---

## 2. Comprehensive Endpoint Catalog

### 2.1 Authentication Endpoints

#### `POST /api/v1/auth/register`
* **Auth**: None (Public)
* **Rate Limit**: 3 req / hour per IP
* **Request Body**:
  ```json
  {
    "email": "developer@example.com",
    "username": "alexdev",
    "password": "SecurePassword123!",
    "displayName": "Alex Developer"
  }
  ```
* **Validation**: Email valid; username 3-30 chars `^[a-zA-Z0-9_]+$`; password min 10 chars with numbers & symbols.
* **Response (201 Created)**:
  ```json
  {
    "success": true,
    "data": {
      "user": {
        "id": "c1f2b4b2-5f67-4e98-963b-9e4a3b8417c8",
        "email": "developer@example.com",
        "username": "alexdev",
        "displayName": "Alex Developer",
        "role": "user"
      }
    }
  }
  ```
* **Cookie**: `Set-Cookie: devspace_session=<token>; HttpOnly; Secure; SameSite=Lax`

---

#### `POST /api/v1/auth/login`
* **Auth**: None (Public)
* **Rate Limit**: 5 req / minute per IP
* **Request Body**:
  ```json
  {
    "email": "developer@example.com",
    "password": "SecurePassword123!"
  }
  ```
* **Response (200 OK)**: Returns user info and issues session cookie.
* **Errors**: `401 Unauthorized` ("Invalid email or password").

---

#### `POST /api/v1/auth/logout`
* **Auth**: Required (User)
* **Rate Limit**: 60 req / min
* **Action**: Deletes session record from DB/Redis and clears session cookie.
* **Response (200 OK)**:
  ```json
  { "success": true, "data": { "message": "Successfully logged out" } }
  ```

---

#### `GET /api/v1/auth/me`
* **Auth**: Required (User)
* **Response (200 OK)**: Current authenticated user details and profile info.

---

### 2.2 User Profiles & Activity

#### `GET /api/v1/users/:username`
* **Auth**: Optional (Public)
* **Response (200 OK)**:
  ```json
  {
    "success": true,
    "data": {
      "id": "c1f2b4b2-5f67-4e98-963b-9e4a3b8417c8",
      "username": "alexdev",
      "displayName": "Alex Developer",
      "bio": "Systems architect & TypeScript enthusiast",
      "avatarUrl": "https://cdn.devspace.app/avatars/alexdev.webp",
      "githubUrl": "https://github.com/alexdev",
      "followersCount": 412,
      "followingCount": 189,
      "postsCount": 34,
      "isFollowing": false
    }
  }
  ```

---

#### `PATCH /api/v1/users/me/profile`
* **Auth**: Required (Owner)
* **Request Body**:
  ```json
  {
    "displayName": "Alex D.",
    "bio": "Updated bio...",
    "avatarUrl": "https://cdn.devspace.app/avatars/new.webp",
    "githubUrl": "https://github.com/alexdev"
  }
  ```
* **Response (200 OK)**: Updated profile object.

---

#### `GET /api/v1/users/:username/activity`
* **Auth**: Optional (Public)
* **Pagination**: Cursor-based (`?cursor=...&limit=20`)
* **Response (200 OK)**: Chronological stream of the user's published posts and comments.

---

### 2.3 Posts Management

#### `POST /api/v1/posts`
* **Auth**: Required (User)
* **Rate Limit**: 5 posts / 10 minutes
* **Request Body**:
  ```json
  {
    "title": "Optimizing PostgreSQL Full-Text Search with GIN Indexes",
    "content": "# Deep Dive\nHere is how to configure tsvector...",
    "tags": ["postgresql", "database", "performance"],
    "mediaIds": ["4b9d07ec-b08e-4f51-b8ef-eef22a945931"]
  }
  ```
* **Validation**: Title 5-255 chars; content 10-50,000 chars; tags max 5 items; mediaIds max 4.
* **Response (201 Created)**: Returns fully assembled Post object with associated media.

---

#### `GET /api/v1/posts/:id`
* **Auth**: Optional (Public)
* **Response (200 OK)**:
  ```json
  {
    "success": true,
    "data": {
      "id": "90e44b82-628f-431f-9da8-26f584e27f05",
      "title": "Optimizing PostgreSQL Full-Text Search with GIN Indexes",
      "content": "# Deep Dive\n...",
      "author": {
        "id": "c1f2b4b2-5f67-4e98-963b-9e4a3b8417c8",
        "username": "alexdev",
        "displayName": "Alex Developer",
        "avatarUrl": "https://cdn.devspace.app/avatars/alexdev.webp"
      },
      "media": [
        {
          "id": "4b9d07ec-b08e-4f51-b8ef-eef22a945931",
          "mediaType": "image",
          "optimizedUrl": "https://cdn.devspace.app/images/arch.webp",
          "thumbnailUrl": "https://cdn.devspace.app/images/arch-thumb.webp",
          "width": 1920,
          "height": 1080
        }
      ],
      "tags": ["postgresql", "database"],
      "likesCount": 87,
      "commentsCount": 14,
      "isLiked": true,
      "createdAt": "2026-10-06T10:15:30.000Z"
    }
  }
  ```

---

#### `PATCH /api/v1/posts/:id`
* **Auth**: Required (Author or Admin)
* **Request Body**: Partial `{ title, content, tags }`.
* **Response (200 OK)**: Updated post.

---

#### `DELETE /api/v1/posts/:id`
* **Auth**: Required (Author, Moderator, or Admin)
* **Action**: Soft deletes post (`deleted_at = NOW()`).
* **Response (204 No Content)**.

---

### 2.4 Feed Endpoints

#### `GET /api/v1/feed`
* **Auth**: Required (User)
* **Query Parameters**:
  * `cursor`: String (`<iso_timestamp>_<post_uuid>`)
  * `limit`: Integer (Default 20, max 50)
* **Response (200 OK)**: List of posts from followed authors ordered chronologically.

---

#### `GET /api/v1/feed/explore`
* **Auth**: Optional (Public)
* **Query Parameters**: `cursor`, `limit`, `tag` (optional filter).
* **Response (200 OK)**: Global discover feed ordered by engagement and recency.

---

### 2.5 Social Interactions (Likes, Comments, Follows)

#### `POST /api/v1/posts/:id/like`
* **Auth**: Required (User)
* **Idempotency**: Safe to call multiple times (creates single unique like).
* **Response (200 OK)**:
  ```json
  { "success": true, "data": { "liked": true, "likesCount": 88 } }
  ```

#### `DELETE /api/v1/posts/:id/like`
* **Auth**: Required (User)
* **Response (200 OK)**:
  ```json
  { "success": true, "data": { "liked": false, "likesCount": 87 } }
  ```

---

#### `POST /api/v1/posts/:id/comments`
* **Auth**: Required (User)
* **Request Body**:
  ```json
  {
    "content": "Terrific explanation of the GIN index structure!",
    "parentId": null
  }
  ```
* **Response (201 Created)**: Created Comment object.

#### `GET /api/v1/posts/:id/comments`
* **Auth**: Optional (Public)
* **Query Parameters**: `cursor`, `limit` (Default 20).
* **Response (200 OK)**: Threaded comments tree for the post.

---

#### `POST /api/v1/users/:id/follow`
* **Auth**: Required (User)
* **Response (200 OK)**: `{ "success": true, "data": { "isFollowing": true } }`

#### `DELETE /api/v1/users/:id/follow`
* **Auth**: Required (User)
* **Response (200 OK)**: `{ "success": true, "data": { "isFollowing": false } }`

---

### 2.6 Media Direct Upload Handshake

#### `POST /api/v1/media/upload-url`
* **Auth**: Required (User)
* **Rate Limit**: 15 requests / 15 minutes
* **Request Body**:
  ```json
  {
    "filename": "database-architecture.png",
    "mimeType": "image/png",
    "byteSize": 1845920,
    "purpose": "post_attachment"
  }
  ```
* **Validation**:
  * `byteSize <= 10485760` (10 MB for images, 50 MB for video).
  * `mimeType` in allowed whitelist (`image/png`, `image/jpeg`, `image/webp`, `video/mp4`, `video/webm`).
* **Response (200 OK)**:
  ```json
  {
    "success": true,
    "data": {
      "mediaId": "4b9d07ec-b08e-4f51-b8ef-eef22a945931",
      "uploadUrl": "https://storage.devspace.app/raw-uploads/pending/4b9d07ec.png?X-Amz-Signature=...",
      "storageKey": "raw-uploads/pending/4b9d07ec.png",
      "expiresInSeconds": 900
    }
  }
  ```

---

#### `POST /api/v1/media/confirm`
* **Auth**: Required (User who requested upload)
* **Request Body**: `{ "mediaId": "4b9d07ec-b08e-4f51-b8ef-eef22a945931" }`
* **Response (202 Accepted)**:
  ```json
  {
    "success": true,
    "data": {
      "mediaId": "4b9d07ec-b08e-4f51-b8ef-eef22a945931",
      "status": "processing",
      "message": "Media queued for background optimization"
    }
  }
  ```

---

### 2.7 Search & Notifications

#### `GET /api/v1/search`
* **Auth**: Optional (Public)
* **Query Parameters**:
  * `q`: Search query string (min 2 chars)
  * `type`: `posts` | `users` (default: `posts`)
  * `cursor`, `limit`
* **Response (200 OK)**: Ranked results matching query keywords.

---

#### `GET /api/v1/notifications`
* **Auth**: Required (User)
* **Query Parameters**: `cursor`, `limit`, `unreadOnly=true|false`
* **Response (200 OK)**: User notification inbox with actor previews.

#### `PATCH /api/v1/notifications/mark-read`
* **Auth**: Required (User)
* **Request Body**: `{ "notificationIds": ["uuid1", "uuid2"] }` (or empty to mark all as read).
* **Response (200 OK)**: `{ "success": true, "data": { "markedReadCount": 2 } }`
