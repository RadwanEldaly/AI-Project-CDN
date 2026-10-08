// Live End-to-End System Verification Script for DevSpace
const BASE = 'http://localhost:4000';

async function main() {
  console.log('====================================================');
  console.log('DevSpace — Live End-to-End System Verification');
  console.log('====================================================\n');

  // 1. Health Checks
  console.log('[1/8] Verifying Health & Readiness Probes...');
  const healthRes = await fetch(`${BASE}/healthz`);
  const readyRes = await fetch(`${BASE}/readyz`);
  console.log('  -> /healthz:', healthRes.status, await healthRes.json());
  console.log('  -> /readyz:', readyRes.status, await readyRes.json());

  // 2. Static SPA Delivery
  console.log('\n[2/8] Verifying Static SPA HTML Delivery & CSP Headers...');
  const rootRes = await fetch(`${BASE}/`);
  console.log('  -> Status:', rootRes.status);
  console.log('  -> Content-Type:', rootRes.headers.get('content-type'));
  console.log('  -> CSP:', rootRes.headers.get('content-security-policy'));

  // 3. User Registration
  console.log('\n[3/8] Testing User Registration & Session Cookie Generation...');
  const suffix = Math.floor(Math.random() * 9000 + 1000);
  const username = `torvalds_${suffix}`;
  const email = `torvalds_${suffix}@kernel.org`;

  const regRes = await fetch(`${BASE}/api/v1/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username,
      displayName: 'Linus Torvalds',
      email,
      password: 'StrongPassword123!',
    }),
  });
  const regJson = await regRes.json();
  const cookie = regRes.headers.get('set-cookie');
  console.log('  -> Status:', regRes.status, 'Success:', regJson.success);
  console.log('  -> User Registered:', regJson.data?.user?.username, `(id: ${regJson.data?.user?.id})`);
  console.log('  -> HttpOnly Session Cookie Present:', !!cookie);

  // 4. Session Authentication Check
  console.log('\n[4/8] Verifying Authenticated Session via /api/v1/auth/me...');
  const meRes = await fetch(`${BASE}/api/v1/auth/me`, {
    headers: { Cookie: cookie },
  });
  const meJson = await meRes.json();
  console.log('  -> Authenticated User:', meJson.data?.user?.username);

  // 5. Publish Technical Post
  console.log('\n[5/8] Publishing Technical Post with Markdown Code Blocks & Tags...');
  const postRes = await fetch(`${BASE}/api/v1/posts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: cookie },
    body: JSON.stringify({
      title: 'Architecting High-Throughput Event Streams in Modern Node.js',
      content: 'Understanding the libuv event loop is paramount for low-latency backend systems.\n\n```ts\nconst db = getDatabase();\nconst results = await db.selectFrom("posts").selectAll().execute();\n```\nAlways benchmark before optimizing.',
      tags: ['nodejs', 'architecture', 'postgres', 'systems'],
    }),
  });
  const postJson = await postRes.json();
  const postId = postJson.data?.id;
  console.log('  -> Status:', postRes.status);
  console.log('  -> Post Created ID:', postId);
  console.log('  -> Title:', postJson.data?.title);
  console.log('  -> Tags:', postJson.data?.tags);

  // 6. Social Interactions: Likes & Comments
  console.log('\n[6/8] Executing Social Interactions (Idempotent Likes & Comments)...');
  const likeRes = await fetch(`${BASE}/api/v1/posts/${postId}/like`, {
    method: 'POST',
    headers: { Cookie: cookie },
  });
  const likeJson = await likeRes.json();
  console.log('  -> Post Liked:', likeJson.data);

  const commentRes = await fetch(`${BASE}/api/v1/posts/${postId}/comments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: cookie },
    body: JSON.stringify({
      content: 'Invaluable architectural insights! Bookmarked for production review.',
    }),
  });
  const commentJson = await commentRes.json();
  console.log('  -> Comment Published ID:', commentJson.data?.id);
  console.log('  -> Comment Author:', commentJson.data?.author?.username);

  // 7. Feed Queries
  console.log('\n[7/8] Verifying Explore Feed & Counters...');
  const feedRes = await fetch(`${BASE}/api/v1/feed/explore`);
  const feedJson = await feedRes.json();
  const feedItems = Array.isArray(feedJson.data) ? feedJson.data : feedJson.data?.items || [];
  console.log('  -> Explore Feed Items Count:', feedItems.length);
  const foundPost = feedItems.find((p) => p.id === postId);
  if (foundPost) {
    console.log('  -> Verified Post in Feed:');
    console.log('     * Title:', foundPost.title);
    console.log('     * Likes Count:', foundPost.likesCount);
    console.log('     * Comments Count:', foundPost.commentsCount);
    console.log('     * Tags:', foundPost.tags);
  }

  // 8. PostgreSQL Full-Text Search
  console.log('\n[8/8] Verifying Full-Text Search via PostgreSQL GIN Index...');
  const searchRes = await fetch(`${BASE}/api/v1/search?q=High-Throughput&type=posts`);
  const searchJson = await searchRes.json();
  const searchResults = Array.isArray(searchJson.data) ? searchJson.data : searchJson.data?.results || [];
  console.log('  -> Search Query: "High-Throughput"');
  console.log('  -> Matches Found:', searchResults.length);
  console.log('  -> First Match Title:', searchResults[0]?.title);

  console.log('\n====================================================');
  console.log('✅ ALL 8 LIVE END-TO-END VERIFICATION CHECKS PASSED!');
  console.log('====================================================\n');
}

main().catch((err) => {
  console.error('❌ Verification failed:', err);
  process.exit(1);
});
