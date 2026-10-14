import { useState, type FormEvent } from 'react';
import { Avatar, Badge, Button, Panel, Text } from '../../../components';
import { useCourseComments } from '../useCourseComments';
import styles from './CourseComments.module.css';

const MAX_LENGTH = 1000;

const dateFormat = new Intl.DateTimeFormat('tr-TR', { dateStyle: 'medium', timeStyle: 'short' });

function formatDate(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? '' : dateFormat.format(date);
}

interface CourseCommentsProps {
  courseId: string;
}

export function CourseComments({ courseId }: CourseCommentsProps) {
  const { comments, loading, error, actionError, sending, addComment, deleteComment, saveReply, deleteReply } =
    useCourseComments(courseId);
  const [text, setText] = useState('');
  const trimmed = text.trim();
  const [replyingId, setReplyingId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');
  const [replyError, setReplyError] = useState<string | null>(null);
  const [replySending, setReplySending] = useState(false);

  const openReply = (id: string, current: string) => {
    setReplyingId(id);
    setReplyText(current);
    setReplyError(null);
  };

  const submitReply = async (event: FormEvent, id: string) => {
    event.preventDefault();
    if (!replyText.trim() || replySending) return;
    setReplySending(true);
    const err = await saveReply(id, replyText.trim());
    setReplySending(false);
    if (err) setReplyError(err);
    else setReplyingId(null);
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!trimmed || sending) return;
    if (await addComment(trimmed)) setText('');
  };

  return (
    <Panel title="Yorumlar" icon="forum" className={styles.panel}>
      <form onSubmit={handleSubmit} className={styles.form}>
        <label htmlFor="course-comment" className={styles.visuallyHidden}>
          Yorumunuz
        </label>
        <textarea
          id="course-comment"
          className={styles.textarea}
          value={text}
          maxLength={MAX_LENGTH}
          rows={3}
          placeholder="Bu kurs hakkındaki düşüncelerinizi paylaşın…"
          onChange={(e) => setText(e.target.value)}
        />
        <div className={styles.formFooter}>
          <Text role="body-sm" tone="muted" as="span" aria-live="polite">
            {text.length} / {MAX_LENGTH}
          </Text>
          <Button type="submit" variant="primary" size="sm" disabled={!trimmed || sending}>
            {sending ? 'Gönderiliyor…' : 'Yorum Yap'}
          </Button>
        </div>
        {actionError && (
          <Text role="body-sm" tone="error" as="p">
            {actionError}
          </Text>
        )}
      </form>

      {loading && <Text role="body-md">Yorumlar yükleniyor…</Text>}
      {!loading && error && (
        <Text role="body-md" tone="error" as="p">
          {error}
        </Text>
      )}
      {!loading && !error && comments.length === 0 && (
        <Text role="body-md" tone="muted" as="p">
          Henüz yorum yok. İlk yorumu siz yapın.
        </Text>
      )}
      {!loading && !error && comments.length > 0 && (
        <ul className={styles.list}>
          {comments.map((comment) => (
            <li key={comment.id} className={styles.item}>
              <Avatar name={comment.author.name} src={comment.author.avatarUrl ?? undefined} />
              <div className={styles.content}>
                <div className={styles.meta}>
                  <Text role="label-lg" as="span" tone="main">
                    {comment.author.name}
                  </Text>
                  <Text role="body-sm" as="span" tone="muted">
                    {formatDate(comment.createdAt)}
                  </Text>
                </div>
                <p className={styles.body}>{comment.body}</p>
                {comment.reply && (
                  <div className={styles.reply}>
                    <div className={styles.meta}>
                      <Badge tone="brand" variant="soft" icon="school">
                        Eğitmen yanıtı
                      </Badge>
                      <Avatar
                        name={comment.reply.author.name}
                        src={comment.reply.author.avatarUrl ?? undefined}
                      />
                      <Text role="label-lg" as="span" tone="main">
                        {comment.reply.author.name}
                      </Text>
                      <Text role="body-sm" as="span" tone="muted">
                        {formatDate(comment.reply.createdAt)}
                      </Text>
                    </div>
                    <p className={styles.body}>{comment.reply.body}</p>
                  </div>
                )}
                {replyingId === comment.id ? (
                  <form className={styles.replyForm} onSubmit={(e) => void submitReply(e, comment.id)}>
                    <label htmlFor={`reply-${comment.id}`} className={styles.visuallyHidden}>
                      Yanıtınız
                    </label>
                    <textarea
                      id={`reply-${comment.id}`}
                      className={styles.textarea}
                      value={replyText}
                      maxLength={MAX_LENGTH}
                      rows={3}
                      autoFocus
                      onChange={(e) => setReplyText(e.target.value)}
                    />
                    <div className={styles.formFooter}>
                      <Text role="body-sm" tone="muted" as="span" aria-live="polite">
                        {replyText.length} / {MAX_LENGTH}
                      </Text>
                      <div className={styles.actions}>
                        <Button type="button" variant="ghost" size="sm" onClick={() => setReplyingId(null)}>
                          İptal
                        </Button>
                        <Button
                          type="submit"
                          variant="primary"
                          size="sm"
                          disabled={!replyText.trim() || replySending}
                        >
                          {replySending ? 'Gönderiliyor…' : 'Gönder'}
                        </Button>
                      </div>
                    </div>
                    {replyError && (
                      <Text role="body-sm" tone="error" as="p">
                        {replyError}
                      </Text>
                    )}
                  </form>
                ) : (
                  (comment.canReply || (comment.canDeleteReply && comment.reply)) && (
                    <div className={styles.actions}>
                      {comment.canReply && (
                        <Button
                          variant="ghost"
                          size="sm"
                          iconStart="reply"
                          onClick={() => openReply(comment.id, comment.reply?.body ?? '')}
                        >
                          {comment.reply ? 'Yanıtı düzenle' : 'Yanıtla'}
                        </Button>
                      )}
                      {comment.canDeleteReply && comment.reply && (
                        <Button
                          variant="ghost"
                          size="sm"
                          iconStart="delete"
                          onClick={() => {
                            if (window.confirm('Bu yanıtı silmek istediğinize emin misiniz?')) {
                              void deleteReply(comment.id);
                            }
                          }}
                        >
                          Yanıtı sil
                        </Button>
                      )}
                    </div>
                  )
                )}
              </div>
              {comment.canDelete && (
                <Button
                  variant="ghost"
                  size="sm"
                  iconStart="delete"
                  aria-label="Yorumu sil"
                  onClick={() => {
                    if (window.confirm('Bu yorumu silmek istediğinize emin misiniz?')) {
                      void deleteComment(comment.id);
                    }
                  }}
                >
                  Sil
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}
