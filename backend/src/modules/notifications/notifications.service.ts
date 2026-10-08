import { Kysely } from 'kysely';
import { Database } from '../../db/schema.js';
import { NotificationItem, MarkReadResult } from '@devspace/shared';

export class NotificationsService {
  constructor(private db: Kysely<Database>) {}

  async getUserNotifications(
    userId: string,
    limit: number = 20
  ): Promise<NotificationItem[]> {
    const safeLimit = Math.min(Math.max(1, limit), 50);

    const rows = await this.db
      .selectFrom('notifications')
      .innerJoin('profiles', 'notifications.actor_id', 'profiles.user_id')
      .select([
        'notifications.id',
        'notifications.recipient_id',
        'notifications.actor_id',
        'notifications.type',
        'notifications.resource_id',
        'notifications.resource_type',
        'notifications.is_read',
        'notifications.created_at',
        'profiles.username as actor_username',
        'profiles.display_name as actor_display_name',
        'profiles.avatar_url as actor_avatar_url',
      ])
      .where('notifications.recipient_id', '=', userId)
      .orderBy('notifications.created_at', 'desc')
      .limit(safeLimit)
      .execute();

    return rows.map((r) => ({
      id: r.id,
      recipientId: r.recipient_id,
      actorId: r.actor_id,
      actor: {
        id: r.actor_id,
        username: r.actor_username,
        displayName: r.actor_display_name,
        avatarUrl: r.actor_avatar_url,
      },
      type: r.type,
      resourceId: r.resource_id,
      resourceType: r.resource_type,
      isRead: r.is_read,
      createdAt: r.created_at,
    }));
  }

  async getUnreadCount(userId: string): Promise<number> {
    const res = await this.db
      .selectFrom('notifications')
      .select((eb) => eb.fn.count<number>('id').as('count'))
      .where('recipient_id', '=', userId)
      .where('is_read', '=', false)
      .executeTakeFirst();

    return Number(res?.count || 0);
  }

  async markRead(userId: string, notificationIds?: string[]): Promise<MarkReadResult> {
    let query = this.db
      .updateTable('notifications')
      .set({ is_read: true })
      .where('recipient_id', '=', userId)
      .where('is_read', '=', false);

    if (notificationIds && notificationIds.length > 0) {
      query = query.where('id', 'in', notificationIds);
    }

    const updated = await query.returning('id').execute();
    return { markedReadCount: updated.length };
  }
}
