// Seed Script for DevSpace — Populates rich initial technical discussions
const BASE = process.env.BASE_URL || 'http://localhost:4000';

const SAMPLE_USERS = [
  {
    username: 'martin_kleppmann',
    displayName: 'Martin Kleppmann',
    email: 'martin@dataintensive.io',
    password: 'Password123!',
    bio: 'Author of Designing Data-Intensive Applications. Researcher in distributed systems, CRDTs, and local-first software.',
    posts: [
      {
        title: 'B-Trees vs. LSM-Trees: Trade-Offs in Modern Storage Engines',
        content: `When designing database storage engines, two fundamental data structures dominate the landscape: **B-Trees** and **Log-Structured Merge-Trees (LSM-Trees)**.

### 1. Write Amplification vs Read Latency
- **B-Trees** update in-place, offering fast point reads (O(log N)) with minimal read amplification. However, random writes incur high write amplification due to 4KB/8KB page overwrites.
- **LSM-Trees** (e.g. RocksDB, Cassandra) append sequential SSTables to disk and merge via background compaction. This optimizes write throughput at the expense of read latency and compaction CPU overhead.

\`\`\`ts
// Conceptual LSM Memtable flush threshold
if (memtable.sizeBytes >= FLUSH_THRESHOLD_MB * 1024 * 1024) {
  await sstableWriter.flushToDisk(memtable.freeze());
  memtable.reset();
}
\`\`\`

**Rule of Thumb:** Use LSM-Trees for high-ingestion time-series or append-heavy systems; use B-Trees for read-heavy OLTP workloads with strict p99 read latencies.`,
        tags: ['distributed-systems', 'postgres', 'architecture', 'database'],
      },
    ],
  },
  {
    username: 'kelsey_hightower',
    displayName: 'Kelsey Hightower',
    email: 'kelsey@cloudnative.dev',
    password: 'Password123!',
    bio: 'Staff Developer Advocate. Minimalist infrastructure, Linux containers, and production reliability.',
    posts: [
      {
        title: 'Production Post-Mortem: Why Simple Architectures Outlive Complex Ones',
        content: `Over the last decade of container orchestration, the single most common failure mode I have seen in production is **accidental architectural complexity**.

Before you introduce:
1. A service mesh with sidecar proxies
2. A distributed distributed-cache layer
3. Multi-cluster federation

Ask yourself: **Can a single well-tuned PostgreSQL database with read replicas handle your throughput?**

In 90% of systems under 10,000 requests per second, the answer is yes. Don't build for Netflix scale before you reach 1,000 active users. Keep it boring, keep it observable, and benchmark continuously.`,
        tags: ['architecture', 'linux', 'concurrency', 'systems'],
      },
    ],
  },
  {
    username: 'sarah_chen',
    displayName: 'Sarah Chen',
    email: 'sarah@systemsperf.com',
    password: 'Password123!',
    bio: 'Database Performance Architect. Specializing in PostgreSQL vacuum tuning, B-Tree indices, and high-concurrency systems.',
    posts: [
      {
        title: 'PostgreSQL Indexing Mastery: Demystifying Partial and Covering Indices',
        content: `Most engineers know how to create a basic index: \`CREATE INDEX ON orders(user_id)\`. But in high-throughput systems, partial and covering indices can reduce index size by 80% while doubling query throughput.

### Partial Indices
If 95% of your records have \`status = 'archived'\`, do not index them for active queries:

\`\`\`sql
-- Only indexes active unfulfilled orders
CREATE INDEX idx_active_orders ON orders (user_id, created_at DESC)
WHERE status IN ('pending', 'processing');
\`\`\`

### Covering Indices (INCLUDE)
Avoid table heap fetches entirely with index-only scans:

\`\`\`sql
CREATE INDEX idx_user_orders_covering ON orders (user_id)
INCLUDE (total_amount, status);
\`\`\`

Always check \`EXPLAIN (ANALYZE, BUFFERS)\` before shipping schema migrations to production.`,
        tags: ['postgres', 'performance', 'database', 'sql'],
      },
    ],
  },
  {
    username: 'alex_distrib',
    displayName: 'Alexandre Dubois',
    email: 'alex@distributed.eng',
    password: 'Password123!',
    bio: 'Senior Infrastructure Engineer. Concurrency, Raft consensus, and kernel networking.',
    posts: [
      {
        title: 'Understanding the Raft Consensus Protocol: Leader Election & Log Replication',
        content: `Consensus in distributed systems is notoriously difficult. While Paxos is notoriously difficult to understand and implement correctly, **Raft** decomposes the problem into three clear sub-problems:

1. **Leader Election:** When the heartbeat timer expires, a node transitions from Follower to Candidate and requests votes.
2. **Log Replication:** The elected leader accepts client entries and broadcasts \`AppendEntries\` RPCs to peers.
3. **Safety:** A leader never overwrites its own entries and only commits entries replicated to a majority quorum.

\`\`\`ts
interface LogEntry {
  term: number;
  index: number;
  command: Record<string, any>;
}
\`\`\`

Consensus is not about speed; it is about linearizable consistency in the presence of network partitions.`,
        tags: ['distributed-systems', 'concurrency', 'architecture'],
      },
    ],
  },
];

async function seed() {
  console.log('====================================================');
  console.log('Seeding DevSpace with Realistic Engineering Discussions');
  console.log(`Target: ${BASE}`);
  console.log('====================================================\n');

  const createdPosts = [];

  for (const user of SAMPLE_USERS) {
    console.log(`[User] Registering ${user.displayName} (@${user.username})...`);
    let cookie = null;

    const regRes = await fetch(`${BASE}/api/v1/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: user.email,
        username: user.username,
        password: user.password,
        displayName: user.displayName,
      }),
    });

    const regJson = await regRes.json();
    if (regJson.success) {
      cookie = `devspace_session=${regJson.data.token}`;
      console.log(`  -> Registered successfully.`);
    } else if (regJson.error?.code === 'EMAIL_ALREADY_EXISTS' || regJson.error?.code === 'USERNAME_ALREADY_TAKEN') {
      // Login if already registered
      const loginRes = await fetch(`${BASE}/api/v1/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          emailOrUsername: user.email,
          password: user.password,
        }),
      });
      const loginJson = await loginRes.json();
      if (loginJson.success) {
        cookie = `devspace_session=${loginJson.data.token}`;
        console.log(`  -> Logged in successfully.`);
      }
    }

    if (!cookie) {
      console.error(`  -> Failed to authenticate ${user.username}:`, regJson.error);
      continue;
    }

    // Update user bio
    await fetch(`${BASE}/api/v1/users/me/profile`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ bio: user.bio }),
    });

    // Create user posts
    for (const postData of user.posts) {
      console.log(`  -> Publishing post: "${postData.title}"...`);
      const postRes = await fetch(`${BASE}/api/v1/posts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: cookie },
        body: JSON.stringify(postData),
      });
      const postJson = await postRes.json();
      if (postJson.success) {
        createdPosts.push({ id: postJson.data.id, cookie, title: postData.title });
        console.log(`     * Published (ID: ${postJson.data.id})`);
      }
    }
  }

  // Cross-like and add thoughtful technical comments
  if (createdPosts.length >= 2) {
    console.log('\n[Interactions] Adding cross-likes and architectural comments...');
    for (let i = 0; i < createdPosts.length; i++) {
      const targetPost = createdPosts[i];
      const otherUser = createdPosts[(i + 1) % createdPosts.length];

      // Like
      await fetch(`${BASE}/api/v1/posts/${targetPost.id}/like`, {
        method: 'POST',
        headers: { Cookie: otherUser.cookie },
      });

      // Comment
      await fetch(`${BASE}/api/v1/posts/${targetPost.id}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: otherUser.cookie },
        body: JSON.stringify({
          content: 'Excellent technical breakdown! In our production cluster, tuning this exact parameter reduced p99 latencies by over 40%.',
        }),
      });
    }
    console.log('  -> Added realistic comments and likes.');
  }

  console.log('\n====================================================');
  console.log('✅ DevSpace Seed Completed Successfully!');
  console.log('====================================================\n');
}

seed().catch(console.error);
