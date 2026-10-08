import { Kysely } from 'kysely';
import { Database } from '../../db/schema.js';
import { Post, AuthorSummary } from '@devspace/shared';

export interface FeedResult {
  posts: Post[];
  nextCursor: string | null;
  hasMore: boolean;
}

export class FeedService {
  constructor(private db: Kysely<Database>) {}

  async getFollowingFeed(
    userId: string,
    cursor?: string | null,
    limit: number = 20
  ): Promise<FeedResult> {
    const safeLimit = Math.min(Math.max(1, limit), 50);

    let query = this.db
      .selectFrom('posts')
      .innerJoin('follows', 'posts.author_id', 'follows.following_id')
      .innerJoin('profiles', 'posts.author_id', 'profiles.user_id')
      .select([
        'posts.id',
        'posts.author_id',
        'posts.title',
        'posts.content',
        'posts.status',
        'posts.likes_count',
        'posts.comments_count',
        'posts.created_at',
        'posts.updated_at',
        'profiles.username',
        'profiles.display_name',
        'profiles.avatar_url',
      ])
      .where('follows.follower_id', '=', userId)
      .where('posts.deleted_at', 'is', null)
      .where('posts.status', '=', 'published');

    // Keyset pagination cursor: <created_at>_<post_id>
    if (cursor) {
      const [cursorTime, cursorId] = cursor.split('_');
      if (cursorTime && cursorId) {
        query = query.where((eb) =>
          eb.or([
            eb('posts.created_at', '<', cursorTime),
            eb.and([
              eb('posts.created_at', '=', cursorTime),
              eb('posts.id', '<', cursorId),
            ]),
          ])
        );
      }
    }

    const rows = await query
      .orderBy('posts.created_at', 'desc')
      .orderBy('posts.id', 'desc')
      .limit(safeLimit + 1)
      .execute();

    const hasMore = rows.length > safeLimit;
    const items = hasMore ? rows.slice(0, safeLimit) : rows;

    const posts = await this.populateMediaAndInteractions(items, userId);

    const lastItem = items[items.length - 1];
    const nextCursor =
      hasMore && lastItem ? `${lastItem.created_at}_${lastItem.id}` : null;

    return { posts, nextCursor, hasMore };
  }

  async getExploreFeed(
    cursor?: string | null,
    limit: number = 20,
    tag?: string | null,
    viewerId?: string | null
  ): Promise<FeedResult> {
    const safeLimit = Math.min(Math.max(1, limit), 50);

    let query = this.db
      .selectFrom('posts')
      .innerJoin('profiles', 'posts.author_id', 'profiles.user_id')
      .select([
        'posts.id',
        'posts.author_id',
        'posts.title',
        'posts.content',
        'posts.status',
        'posts.likes_count',
        'posts.comments_count',
        'posts.created_at',
        'posts.updated_at',
        'profiles.username',
        'profiles.display_name',
        'profiles.avatar_url',
      ])
      .where('posts.deleted_at', 'is', null)
      .where('posts.status', '=', 'published');

    if (tag) {
      query = query.where((eb) =>
        eb.exists(
          eb
            .selectFrom('post_tags')
            .innerJoin('tags', 'post_tags.tag_id', 'tags.id')
            .select('post_tags.post_id')
            .whereRef('post_tags.post_id', '=', 'posts.id')
            .where('tags.slug', '=', tag.toLowerCase())
        )
      );
    }

    if (cursor) {
      const [cursorTime, cursorId] = cursor.split('_');
      if (cursorTime && cursorId) {
        query = query.where((eb) =>
          eb.or([
            eb('posts.created_at', '<', cursorTime),
            eb.and([
              eb('posts.created_at', '=', cursorTime),
              eb('posts.id', '<', cursorId),
            ]),
          ])
        );
      }
    }

    const rows = await query
      .orderBy('posts.created_at', 'desc')
      .orderBy('posts.id', 'desc')
      .limit(safeLimit + 1)
      .execute();

    const hasMore = rows.length > safeLimit;
    const items = hasMore ? rows.slice(0, safeLimit) : rows;

    const posts = await this.populateMediaAndInteractions(items, viewerId);

    const lastItem = items[items.length - 1];
    const nextCursor =
      hasMore && lastItem ? `${lastItem.created_at}_${lastItem.id}` : null;

    return { posts, nextCursor, hasMore };
  }

  private async populateMediaAndInteractions(
    items: any[],
    viewerId?: string | null
  ): Promise<Post[]> {
    if (items.length === 0) return [];

    const postIds = items.map((i) => i.id);

    // Fetch media for all posts in a single query
    const mediaList = await this.db
      .selectFrom('post_media')
      .selectAll()
      .where('post_id', 'in', postIds)
      .orderBy('order_index', 'asc')
      .execute();

    // Fetch tags for all posts in a single query
    const tagsList = await this.db
      .selectFrom('post_tags')
      .innerJoin('tags', 'post_tags.tag_id', 'tags.id')
      .select(['post_tags.post_id', 'tags.name'])
      .where('post_tags.post_id', 'in', postIds)
      .execute();

    // Fetch viewer liked post IDs in a single query
    let likedPostIds = new Set<string>();
    if (viewerId) {
      const likes = await this.db
        .selectFrom('likes')
        .select('post_id')
        .where('user_id', '=', viewerId)
        .where('post_id', 'in', postIds)
        .execute();
      likedPostIds = new Set(likes.map((l) => l.post_id!));
    }

    const mediaByPost = new Map<string, any[]>();
    for (const m of mediaList) {
      const arr = mediaByPost.get(m.post_id!) || [];
      arr.push({
        id: m.id,
        postId: m.post_id,
        mediaType: m.media_type,
        originalUrl: m.original_url,
        optimizedUrl: m.optimized_url,
        thumbnailUrl: m.thumbnail_url,
        byteSize: m.byte_size,
        width: m.width,
        height: m.height,
        durationSeconds: m.duration_seconds,
        orderIndex: m.order_index,
        createdAt: m.created_at,
      });
      mediaByPost.set(m.post_id!, arr);
    }

    const tagsByPost = new Map<string, string[]>();
    for (const t of tagsList) {
      const arr = tagsByPost.get(t.post_id) || [];
      arr.push(t.name);
      tagsByPost.set(t.post_id, arr);
    }

    return items.map((row) => ({
      id: row.id,
      authorId: row.author_id,
      author: {
        id: row.author_id,
        username: row.username,
        displayName: row.display_name,
        avatarUrl: row.avatar_url,
      },
      title: row.title,
      content: row.content,
      status: row.status,
      likesCount: row.likes_count,
      commentsCount: row.comments_count,
      tags: tagsByPost.get(row.id) || [],
      media: mediaByPost.get(row.id) || [],
      isLiked: likedPostIds.has(row.id),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
  }
}
