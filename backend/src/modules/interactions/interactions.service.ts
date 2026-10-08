import { Kysely, sql } from 'kysely';
import { Database } from '../../db/schema.js';
import { CreateCommentInput, Comment, LikeResult, FollowResult } from '@devspace/shared';
import { renderAndSanitizeMarkdown } from '../../security/sanitization.js';

export class InteractionsService {
  constructor(private db: Kysely<Database>) {}

  async likePost(userId: string, postId: string): Promise<LikeResult> {
    const post = await this.db
      .selectFrom('posts')
      .select(['id', 'author_id', 'likes_count'])
      .where('id', '=', postId)
      .where('deleted_at', 'is', null)
      .executeTakeFirst();

    if (!post) {
      const err = new Error('Post not found');
      (err as any).statusCode = 404;
      throw err;
    }

    // Atomic insert with partial index arbiter predicate
    const result = await sql<{ id: string }>`
      INSERT INTO likes (user_id, post_id)
      VALUES (${userId}, ${postId})
      ON CONFLICT (user_id, post_id) WHERE post_id IS NOT NULL DO NOTHING
      RETURNING id
    `.execute(this.db);

    const inserted = result.rows[0];

    if (inserted) {
      await this.db
        .updateTable('posts')
        .set((eb) => ({ likes_count: eb('likes_count', '+', 1) }))
        .where('id', '=', postId)
        .execute();

      // Trigger notification if liking someone else's post
      if (post.author_id !== userId) {
        await this.db
          .insertInto('notifications')
          .values({
            recipient_id: post.author_id,
            actor_id: userId,
            type: 'post_liked',
            resource_id: postId,
            resource_type: 'post',
          })
          .execute();
      }
    }

    const updated = await this.db
      .selectFrom('posts')
      .select('likes_count')
      .where('id', '=', postId)
      .executeTakeFirstOrThrow();

    return { liked: true, likesCount: updated.likes_count };
  }

  async unlikePost(userId: string, postId: string): Promise<LikeResult> {
    const deleted = await this.db
      .deleteFrom('likes')
      .where('user_id', '=', userId)
      .where('post_id', '=', postId)
      .returning('id')
      .executeTakeFirst();

    if (deleted) {
      await this.db
        .updateTable('posts')
        .set((eb) => ({ likes_count: eb('likes_count', '-', 1) }))
        .where('id', '=', postId)
        .where('likes_count', '>', 0)
        .execute();
    }

    const updated = await this.db
      .selectFrom('posts')
      .select('likes_count')
      .where('id', '=', postId)
      .executeTakeFirstOrThrow();

    return { liked: false, likesCount: updated.likes_count };
  }

  async createComment(
    authorId: string,
    postId: string,
    input: CreateCommentInput
  ): Promise<Comment> {
    renderAndSanitizeMarkdown(input.content);

    const post = await this.db
      .selectFrom('posts')
      .select(['id', 'author_id'])
      .where('id', '=', postId)
      .where('deleted_at', 'is', null)
      .executeTakeFirst();

    if (!post) {
      const err = new Error('Post not found');
      (err as any).statusCode = 404;
      throw err;
    }

    return await this.db.transaction().execute(async (trx) => {
      const [commentRecord] = await trx
        .insertInto('comments')
        .values({
          post_id: postId,
          author_id: authorId,
          parent_id: input.parentId || null,
          content: input.content,
          likes_count: 0,
        })
        .returningAll()
        .execute();

      await trx
        .updateTable('posts')
        .set((eb) => ({ comments_count: eb('comments_count', '+', 1) }))
        .where('id', '=', postId)
        .execute();

      // Notify post author
      if (post.author_id !== authorId) {
        await trx
          .insertInto('notifications')
          .values({
            recipient_id: post.author_id,
            actor_id: authorId,
            type: 'comment_added',
            resource_id: postId,
            resource_type: 'post',
          })
          .execute();
      }

      const author = await trx
        .selectFrom('profiles')
        .select(['user_id', 'username', 'display_name', 'avatar_url'])
        .where('user_id', '=', authorId)
        .executeTakeFirstOrThrow();

      return {
        id: commentRecord.id,
        postId: commentRecord.post_id,
        authorId: commentRecord.author_id,
        author: {
          id: author.user_id,
          username: author.username,
          displayName: author.display_name,
          avatarUrl: author.avatar_url,
        },
        parentId: commentRecord.parent_id,
        content: commentRecord.content,
        likesCount: commentRecord.likes_count,
        isLiked: false,
        createdAt: commentRecord.created_at,
        updatedAt: commentRecord.updated_at,
      };
    });
  }

  async getPostComments(postId: string, viewerId?: string): Promise<Comment[]> {
    const comments = await this.db
      .selectFrom('comments')
      .innerJoin('profiles', 'comments.author_id', 'profiles.user_id')
      .select([
        'comments.id',
        'comments.post_id',
        'comments.author_id',
        'comments.parent_id',
        'comments.content',
        'comments.likes_count',
        'comments.created_at',
        'comments.updated_at',
        'profiles.username',
        'profiles.display_name',
        'profiles.avatar_url',
      ])
      .where('comments.post_id', '=', postId)
      .where('comments.deleted_at', 'is', null)
      .orderBy('comments.created_at', 'asc')
      .execute();

    return comments.map((c) => ({
      id: c.id,
      postId: c.post_id,
      authorId: c.author_id,
      author: {
        id: c.author_id,
        username: c.username,
        displayName: c.display_name,
        avatarUrl: c.avatar_url,
      },
      parentId: c.parent_id,
      content: c.content,
      likesCount: c.likes_count,
      createdAt: c.created_at,
      updatedAt: c.updated_at,
    }));
  }

  async followUser(followerId: string, targetUserId: string): Promise<FollowResult> {
    if (followerId === targetUserId) {
      const err = new Error('Cannot follow yourself');
      (err as any).statusCode = 400;
      throw err;
    }

    const inserted = await this.db
      .insertInto('follows')
      .values({ follower_id: followerId, following_id: targetUserId })
      .onConflict((oc) => oc.columns(['follower_id', 'following_id']).doNothing())
      .returning('follower_id')
      .executeTakeFirst();

    if (inserted) {
      await this.db.transaction().execute(async (trx) => {
        await trx
          .updateTable('profiles')
          .set((eb) => ({ following_count: eb('following_count', '+', 1) }))
          .where('user_id', '=', followerId)
          .execute();

        await trx
          .updateTable('profiles')
          .set((eb) => ({ followers_count: eb('followers_count', '+', 1) }))
          .where('user_id', '=', targetUserId)
          .execute();

        await trx
          .insertInto('notifications')
          .values({
            recipient_id: targetUserId,
            actor_id: followerId,
            type: 'user_followed',
            resource_id: targetUserId,
            resource_type: 'user',
          })
          .execute();
      });
    }

    const targetProfile = await this.db
      .selectFrom('profiles')
      .select('followers_count')
      .where('user_id', '=', targetUserId)
      .executeTakeFirstOrThrow();

    return { isFollowing: true, followersCount: targetProfile.followers_count };
  }

  async unfollowUser(followerId: string, targetUserId: string): Promise<FollowResult> {
    const deleted = await this.db
      .deleteFrom('follows')
      .where('follower_id', '=', followerId)
      .where('following_id', '=', targetUserId)
      .returning('follower_id')
      .executeTakeFirst();

    if (deleted) {
      await this.db.transaction().execute(async (trx) => {
        await trx
          .updateTable('profiles')
          .set((eb) => ({ following_count: eb('following_count', '-', 1) }))
          .where('user_id', '=', followerId)
          .where('following_count', '>', 0)
          .execute();

        await trx
          .updateTable('profiles')
          .set((eb) => ({ followers_count: eb('followers_count', '-', 1) }))
          .where('user_id', '=', targetUserId)
          .where('followers_count', '>', 0)
          .execute();
      });
    }

    const targetProfile = await this.db
      .selectFrom('profiles')
      .select('followers_count')
      .where('user_id', '=', targetUserId)
      .executeTakeFirstOrThrow();

    return { isFollowing: false, followersCount: targetProfile.followers_count };
  }
}
