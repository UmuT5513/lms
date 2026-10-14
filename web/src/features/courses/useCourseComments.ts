import { useCallback, useEffect, useState } from 'react';
import { apiFetch, ApiError } from '../../lib/apiClient';
import type { CourseComment } from '../../types';

function messageFor(err: unknown, fallback: string): string {
  if (err instanceof ApiError) {
    return err.code === 'NOT_ENROLLED' ? 'Yorum yapmak için kursa kayıtlı olmalısınız.' : err.message;
  }
  return fallback;
}

export function useCourseComments(courseId: string | undefined) {
  const [comments, setComments] = useState<CourseComment[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    setComments([]);
    setError(null);
    setActionError(null);
    if (!courseId) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    apiFetch<{ comments: CourseComment[] }>(`/api/v1/courses/${courseId}/comments`)
      .then((res) => {
        if (!cancelled) setComments(res.comments);
      })
      .catch((err) => {
        if (!cancelled) setError(messageFor(err, 'Yorumlar yüklenemedi.'));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [courseId]);

  /** Başarılıysa true döner (form temizlenebilsin diye). */
  const addComment = useCallback(
    async (body: string): Promise<boolean> => {
      if (!courseId) return false;
      setActionError(null);
      setSending(true);
      try {
        const res = await apiFetch<{ comment: CourseComment }>(`/api/v1/courses/${courseId}/comments`, {
          method: 'POST',
          body: JSON.stringify({ body }),
        });
        setComments((prev) => [res.comment, ...prev]);
        return true;
      } catch (err) {
        setActionError(messageFor(err, 'Yorum gönderilemedi. Lütfen tekrar deneyin.'));
        return false;
      } finally {
        setSending(false);
      }
    },
    [courseId],
  );

  const deleteComment = useCallback(
    async (commentId: string) => {
      if (!courseId) return;
      setActionError(null);
      try {
        await apiFetch<void>(`/api/v1/courses/${courseId}/comments/${commentId}`, { method: 'DELETE' });
        setComments((prev) => prev.filter((c) => c.id !== commentId));
      } catch (err) {
        if (err instanceof ApiError && err.code === 'COMMENT_NOT_FOUND') {
          setComments((prev) => prev.filter((c) => c.id !== commentId));
          return;
        }
        setActionError(messageFor(err, 'Yorum silinemedi. Lütfen tekrar deneyin.'));
      }
    },
    [courseId],
  );

  const replaceComment = (comment: CourseComment) =>
    setComments((prev) => prev.map((c) => (c.id === comment.id ? comment : c)));

  /** Başarılıysa null, aksi halde hata mesajı döner. */
  const saveReply = useCallback(
    async (commentId: string, body: string): Promise<string | null> => {
      if (!courseId) return 'Kurs bulunamadı.';
      try {
        const res = await apiFetch<{ comment: CourseComment }>(
          `/api/v1/courses/${courseId}/comments/${commentId}/reply`,
          { method: 'PUT', body: JSON.stringify({ body }) },
        );
        replaceComment(res.comment);
        return null;
      } catch (err) {
        return messageFor(err, 'Yanıt kaydedilemedi. Lütfen tekrar deneyin.');
      }
    },
    [courseId],
  );

  const deleteReply = useCallback(
    async (commentId: string) => {
      if (!courseId) return;
      setActionError(null);
      try {
        const res = await apiFetch<{ comment: CourseComment }>(
          `/api/v1/courses/${courseId}/comments/${commentId}/reply`,
          { method: 'DELETE' },
        );
        replaceComment(res.comment);
      } catch (err) {
        setActionError(messageFor(err, 'Yanıt silinemedi. Lütfen tekrar deneyin.'));
      }
    },
    [courseId],
  );

  return {
    comments,
    loading,
    error,
    actionError,
    sending,
    addComment,
    deleteComment,
    saveReply,
    deleteReply,
  };
}
