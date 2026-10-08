import React, { useEffect, useState } from 'react';
import { api, NotificationItem } from '../api/client';
import { Heart, MessageSquare, UserPlus, CheckCheck, ArrowLeft, Bell } from 'lucide-react';

interface NotificationsViewProps {
  onBack: () => void;
  onOpenAuthor: (username: string) => void;
}

export const NotificationsView: React.FC<NotificationsViewProps> = ({ onBack, onOpenAuthor }) => {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchNotifications = async () => {
    setLoading(true);
    try {
      const data = await api.notifications.getAll();
      setNotifications(data);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifications();
  }, []);

  const handleMarkAllRead = async () => {
    try {
      await api.notifications.markRead();
      setNotifications((prev) =>
        prev.map((n) => ({ ...n, readAt: new Date().toISOString() }))
      );
    } catch {
      // ignore
    }
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'like':
        return <Heart size={16} style={{ color: '#ffffff', fill: '#ffffff' }} />;
      case 'comment':
        return <MessageSquare size={16} style={{ color: '#ffffff' }} />;
      case 'follow':
        return <UserPlus size={16} style={{ color: '#ffffff' }} />;
      default:
        return <Bell size={16} style={{ color: '#ffffff' }} />;
    }
  };

  const getMessage = (n: NotificationItem) => {
    switch (n.type) {
      case 'like':
        return 'liked your technical post';
      case 'comment':
        return 'commented on your post';
      case 'follow':
        return 'started following your engineering updates';
      default:
        return 'interacted with your activity';
    }
  };

  const timeAgo = (dateStr: string) => {
    const seconds = Math.floor((new Date().getTime() - new Date(dateStr).getTime()) / 1000);
    if (seconds < 60) return 'just now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  };

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
        <button className="btn btn-ghost" style={{ paddingLeft: 0 }} onClick={onBack}>
          <ArrowLeft size={16} /> Back to Feed
        </button>

        <button className="btn btn-secondary" onClick={handleMarkAllRead}>
          <CheckCheck size={16} /> Mark all read
        </button>
      </div>

      <h2 style={{ fontSize: '1.4rem', marginBottom: '18px' }}>Engineering Activity & Alerts</h2>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-dim)' }}>
          <span className="spinner" />
          <p style={{ marginTop: '10px' }}>Loading notifications...</p>
        </div>
      ) : notifications.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 20px', background: 'var(--bg-surface)', borderRadius: 'var(--radius-lg)' }}>
          <Bell size={32} style={{ color: 'var(--text-dim)', marginBottom: '12px' }} />
          <h4 style={{ color: 'white', marginBottom: '6px' }}>All caught up!</h4>
          <p style={{ color: 'var(--text-dim)', fontSize: '0.9rem' }}>
            No new likes, comments, or followers at the moment.
          </p>
        </div>
      ) : (
        notifications.map((n) => (
          <div
            key={n.id}
            className={`notification-card ${!n.readAt ? 'unread' : ''}`}
          >
            <div style={{ marginTop: '2px' }}>{getIcon(n.type)}</div>
            <div style={{ flex: 1 }}>
              <div>
                <strong
                  style={{ color: 'white', cursor: 'pointer', marginRight: '6px' }}
                  onClick={() => onOpenAuthor(n.actorUsername)}
                >
                  {n.actorDisplayName || n.actorUsername}
                </strong>
                <span style={{ color: 'var(--text-muted)' }}>{getMessage(n)}</span>
              </div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-dim)', marginTop: '4px' }}>
                {timeAgo(n.createdAt)}
              </div>
            </div>
          </div>
        ))
      )}
    </div>
  );
};
