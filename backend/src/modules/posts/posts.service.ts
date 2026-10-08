import { Kysely } from 'kysely';
import { Database } from '../../db/schema.js';
import { CreatePostInput, UpdatePostInput, Post, AuthorSummary } from '@devspace/shared';
import { renderAndSanitizeMarkdown } from '../../security/sanitization.js';

export class PostsService {
  constructor(private db: Kysely<Database>) {}

  async createPost(authorId: string, input: CreatePostInput): Promise<Post> {
    // 1. Sanitize Markdown content to prevent stored XSS attacks
    renderAndSanitizeMarkdown(input.content);

    return await this.db.transaction().execute(async (trx) => {
      // 2. Insert Post
      const [postRecord] = await trx
        .insertInto('posts')
        .values({
          author_id: authorId,
          title: input.title,
          content: input.content,
          status: 'published',
          likes_count: 0,
          comments_count: 0,
        })
        .returningAll()
        .execute();

      // 3. Associate media attachments if provided
      if (input.mediaIds && input.mediaIds.length > 0) {
        for (let i = 0; i < input.mediaIds.length; i++) {
          const mediaId = input.mediaIds[i];
          await trx
            .updateTable('post_media')
            .set({ post_id: postRecord.id, order_index: i })
            .where('id', '=', mediaId)
            .where('uploader_id', '=', authorId)
            .execute();
        }
      }

      // 4. Associate tags
      const tagNames = input.tags || [];
      for (const tagName of tagNames) {
        const slug = tagName.toLowerCase().replace(/[^a-z0-9_-]/g, '');
        // Upsert tag
        let tag = await trx
          .selectFrom('tags')
          .selectAll()
          .where('slug', '=', slug)
          .executeTakeFirst();

        if (!tag) {
          [tag] = await trx
            .insertInto('tags')
            .values({ name: tagName, slug, posts_count: 1 })
            .returningAll()
            .execute();
        } else {
          await trx
            .updateTable('tags')
            .set({ posts_count: tag.posts_count + 1 })
            .where('id', '=', tag.id)
            .execute();
        }

        await trx
          .insertInto('post_tags')
          .values({ post_id: postRecord.id, tag_id: tag.id })
          .execute();
      }

      // 5. Increment user posts count
      await trx
        .updateTable('profiles')
        .set((eb) => ({ posts_count: eb('posts_count', '+', 1) }))
        .where('user_id', '=', authorId)
        .execute();

      // 6. Fetch author profile
      const author = await trx
        .selectFrom('profiles')
        .select(['user_id', 'username', 'display_name', 'avatar_url'])
        .where('user_id', '=', authorId)
        .executeTakeFirstOrThrow();

      // 7. Fetch attached media
      const mediaList = await trx
        .selectFrom('post_media')
        .selectAll()
        .where('post_id', '=', postRecord.id)
        .orderBy('order_index', 'asc')
        .execute();

      const authorSummary: AuthorSummary = {
        id: author.user_id,
        username: author.username,
        displayName: author.display_name,
        avatarUrl: author.avatar_url,
      };

      return {
        id: postRecord.id,
        authorId: postRecord.author_id,
        author: authorSummary,
        title: postRecord.title,
        content: postRecord.content,
        status: postRecord.status,
        likesCount: postRecord.likes_count,
        commentsCount: postRecord.comments_count,
        tags: tagNames,
        media: mediaList.map((m) => ({
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
        })),
        isLiked: false,
        createdAt: postRecord.created_at,
        updatedAt: postRecord.updated_at,
      };
    });
  }

  async getPostById(postId: string, viewerId?: string): Promise<Post | null> {
    const postRecord = await this.db
      .selectFrom('posts')
      .selectAll()
      .where('id', '=', postId)
      .where('deleted_at', 'is', null)
      .executeTakeFirst();

    if (!postRecord) return null;

    const author = await this.db
      .selectFrom('profiles')
      .select(['user_id', 'username', 'display_name', 'avatar_url'])
      .where('user_id', '=', postRecord.author_id)
      .executeTakeFirstOrThrow();

    const mediaList = await this.db
      .selectFrom('post_media')
      .selectAll()
      .where('post_id', '=', postId)
      .orderBy('order_index', 'asc')
      .execute();

    const tagList = await this.db
      .selectFrom('post_tags')
      .innerJoin('tags', 'post_tags.tag_id', 'tags.id')
      .select('tags.name')
      .where('post_tags.post_id', '=', postId)
      .execute();

    let isLiked = false;
    if (viewerId) {
      const like = await this.db
        .selectFrom('likes')
        .select('id')
        .where('post_id', '=', postId)
        .where('user_id', '=', viewerId)
        .executeTakeFirst();
      isLiked = !!like;
    }

    return {
      id: postRecord.id,
      authorId: postRecord.author_id,
      author: {
        id: author.user_id,
        username: author.username,
        displayName: author.display_name,
        avatarUrl: author.avatar_url,
      },
      title: postRecord.title,
      content: postRecord.content,
      status: postRecord.status,
      likesCount: postRecord.likes_count,
      commentsCount: postRecord.comments_count,
      tags: tagList.map((t) => t.name),
      media: mediaList.map((m) => ({
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
      })),
      isLiked,
      createdAt: postRecord.created_at,
      updatedAt: postRecord.updated_at,
    };
  }

  async updatePost(
    postId: string,
    userId: string,
    userRole: string,
    input: UpdatePostInput
  ): Promise<Post> {
    const post = await this.db
      .selectFrom('posts')
      .selectAll()
      .where('id', '=', postId)
      .where('deleted_at', 'is', null)
      .executeTakeFirst();

    if (!post) {
      const err = new Error('Post not found');
      (err as any).statusCode = 404;
      throw err;
    }

    if (post.author_id !== userId && userRole !== 'admin') {
      const err = new Error('Forbidden: You can only edit your own posts');
      (err as any).statusCode = 403;
      throw err;
    }

    const updates: Record<string, any> = {
      updated_at: new Date().toISOString(),
    };
    if (input.title) updates.title = input.title;
    if (input.content) {
      renderAndSanitizeMarkdown(input.content);
      updates.content = input.content;
    }

    await this.db
      .updateTable('posts')
      .set(updates)
      .where('id', '=', postId)
      .execute();

    return (await this.getPostById(postId, userId))!;
  }

  async deletePost(postId: string, userId: string, userRole: string): Promise<void> {
    const post = await this.db
      .selectFrom('posts')
      .selectAll()
      .where('id', '=', postId)
      .where('deleted_at', 'is', null)
      .executeTakeFirst();

    if (!post) {
      const err = new Error('Post not found');
      (err as any).statusCode = 404;
      throw err;
    }

    const isAuthorized = post.author_id === userId || userRole === 'moderator' || userRole === 'admin';
    if (!isAuthorized) {
      const err = new Error('Forbidden: Insufficient permissions to delete this post');
      (err as any).statusCode = 403;
      throw err;
    }

    await this.db.transaction().execute(async (trx) => {
      await trx
        .updateTable('posts')
        .set({ deleted_at: new Date().toISOString(), status: 'archived' })
        .where('id', '=', postId)
        .execute();

      await trx
        .updateTable('profiles')
        .set((eb) => ({ posts_count: eb('posts_count', '-', 1) }))
        .where('user_id', '=', post.author_id)
        .execute();
    });
  }

  async getPostsByUsername(username: string, viewerId?: string): Promise<Post[]> {
    const profile = await this.db
      .selectFrom('profiles')
      .select(['user_id', 'username', 'display_name', 'avatar_url'])
      .where('username', '=', username.toLowerCase())
      .executeTakeFirst();

    if (!profile) return [];

    const postRecords = await this.db
      .selectFrom('posts')
      .selectAll()
      .where('author_id', '=', profile.user_id)
      .where('deleted_at', 'is', null)
      .orderBy('created_at', 'desc')
      .limit(50)
      .execute();

    if (postRecords.length === 0) return [];

    const postIds = postRecords.map((p) => p.id);

    const allMedia = await this.db
      .selectFrom('post_media')
      .selectAll()
      .where('post_id', 'in', postIds)
      .orderBy('order_index', 'asc')
      .execute();

    const allTags = await this.db
      .selectFrom('post_tags')
      .innerJoin('tags', 'post_tags.tag_id', 'tags.id')
      .select(['post_tags.post_id', 'tags.name'])
      .where('post_tags.post_id', 'in', postIds)
      .execute();

    let likedPostIds = new Set<string>();
    if (viewerId) {
      const likes = await this.db
        .selectFrom('likes')
        .select('post_id')
        .where('user_id', '=', viewerId)
        .where('post_id', 'in', postIds)
        .execute();
      likedPostIds = new Set(likes.map((l) => l.post_id).filter((id): id is string => Boolean(id)));
    }

    return postRecords.map((p) => ({
      id: p.id,
      authorId: p.author_id,
      author: {
        id: profile.user_id,
        username: profile.username,
        displayName: profile.display_name,
        avatarUrl: profile.avatar_url,
      },
      title: p.title,
      content: p.content,
      status: p.status,
      likesCount: p.likes_count,
      commentsCount: p.comments_count,
      tags: allTags.filter((t) => t.post_id === p.id).map((t) => t.name),
      media: allMedia
        .filter((m) => m.post_id === p.id)
        .map((m) => ({
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
        })),
      isLiked: likedPostIds.has(p.id),
      createdAt: p.created_at,
      updatedAt: p.updated_at,
    }));
  }
}
