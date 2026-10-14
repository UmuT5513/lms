import { useCallback, useEffect, useState } from 'react';
import { apiFetch } from '../../../../lib/apiClient';
import type { CourseInstructor } from '../../../../types';

export type CourseStatus = 'DRAFT' | 'PUBLISHED';
export type CourseAccessMode = 'SEQUENTIAL' | 'FREE';

export interface AdminCourse {
  id: string;
  title: string;
  description: string;
  category: string;
  level: string;
  tags: string[];
  accessMode: CourseAccessMode;
  status: CourseStatus;
  /** Kuruş; 0 = ücretsiz. */
  priceKurus: number;
  instructors?: CourseInstructor[];
}

export interface CourseInput {
  title: string;
  description: string;
  category: string;
  level: string;
  tags: string[];
  accessMode: CourseAccessMode;
  status?: CourseStatus;
  priceKurus?: number;
  /** Yalnızca oluşturmada ve yalnızca ADMIN için. */
  instructorIds?: string[];
}

export interface EnrolledStudent {
  id: string;
  name: string;
  email: string;
  enrolledAt: string;
  method: string;
}

/**
 * Yönetici kurs listesi: GET /api/v1/courses, ADMIN rolü taslak (DRAFT)
 * kursları da görür. Oluşturma/güncelleme/silme işlemleri de burada.
 */
export function useAdminCourses() {
  const [courses, setCourses] = useState<AdminCourse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    return apiFetch<{ courses: AdminCourse[] }>('/api/v1/courses')
      .then((result) => setCourses(result.courses))
      .catch((err) => setError(err instanceof Error ? err.message : 'Kurslar yüklenemedi.'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const createCourse = useCallback(async (input: CourseInput) => {
    const result = await apiFetch<{ course: AdminCourse }>('/api/v1/courses', {
      method: 'POST',
      body: JSON.stringify(input),
    });
    setCourses((prev) => [...prev, result.course]);
    return result.course;
  }, []);

  const updateCourse = useCallback(async (id: string, input: Partial<CourseInput>) => {
    const result = await apiFetch<{ course: AdminCourse }>(`/api/v1/courses/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(input),
    });
    setCourses((prev) => prev.map((course) => (course.id === id ? result.course : course)));
    return result.course;
  }, []);

  const deleteCourse = useCallback(async (id: string) => {
    await apiFetch<void>(`/api/v1/courses/${id}`, { method: 'DELETE' });
    setCourses((prev) => prev.filter((course) => course.id !== id));
  }, []);

  return { courses, loading, error, reload: load, createCourse, updateCourse, deleteCourse };
}

/**
 * Tek bir kursun kayıtlı öğrenci listesi ve kayıt kaldırma işlemi.
 */
export function useCourseStudents(courseId: string | undefined) {
  const [students, setStudents] = useState<EnrolledStudent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    if (!courseId) {
      return Promise.resolve();
    }
    setLoading(true);
    setError(null);
    return apiFetch<{ students: EnrolledStudent[] }>(`/api/v1/courses/${courseId}/students`)
      .then((result) => setStudents(result.students))
      .catch((err) => setError(err instanceof Error ? err.message : 'Öğrenciler yüklenemedi.'))
      .finally(() => setLoading(false));
  }, [courseId]);

  useEffect(() => {
    load();
  }, [load]);

  const removeStudent = useCallback(
    async (userId: string) => {
      if (!courseId) return;
      await apiFetch<void>(`/api/v1/courses/${courseId}/students/${userId}`, {
        method: 'DELETE',
      });
      setStudents((prev) => prev.filter((student) => student.id !== userId));
    },
    [courseId],
  );

  return { students, loading, error, reload: load, removeStudent };
}
