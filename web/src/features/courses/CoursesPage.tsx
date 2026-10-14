import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Badge, Button, Card, ProgressBar, Text } from '../../components';
import { PageContainer } from '../../layout/PageContainer';
import { CourseInstructors } from './CourseInstructors';
import { useCourses } from './useCourses';
import { useAllCourses } from './useAllCourses';
import { enrollInCourse } from './enrollInCourse';
import { PurchaseButton } from '../payments';
import { formatPrice } from '../../lib/price';
import styles from './CoursesPage.module.css';

type TabKey = 'enrolled' | 'all';

export function CoursesPage() {
  const [tab, setTab] = useState<TabKey>('enrolled');
  const { courses: enrolledCourses, loading: enrolledLoading, error: enrolledError } = useCourses();
  const { courses: allCourses, loading: allLoading, error: allError } = useAllCourses();
  const navigate = useNavigate();

  const enrolledIds = useMemo(
    () => new Set(enrolledCourses.map((course) => course.id)),
    [enrolledCourses],
  );

  const [justEnrolledIds, setJustEnrolledIds] = useState<Set<string>>(new Set());
  const [enrollingId, setEnrollingId] = useState<string | null>(null);
  const [enrollError, setEnrollError] = useState<string | null>(null);

  const isEnrolled = (courseId: string) => enrolledIds.has(courseId) || justEnrolledIds.has(courseId);

  const handleEnroll = async (courseId: string) => {
    setEnrollingId(courseId);
    setEnrollError(null);
    try {
      await enrollInCourse(courseId);
      setJustEnrolledIds((prev) => new Set(prev).add(courseId));
    } catch (err) {
      setEnrollError(err instanceof Error ? err.message : 'Kayıt işlemi başarısız oldu.');
    } finally {
      setEnrollingId(null);
    }
  };

  return (
    <PageContainer>
      <div className={styles.header}>
        <Text role="headline-lg" as="h1">
          Kurslarım
        </Text>
      </div>

      <div className={styles.tabs} role="tablist" aria-label="Kurs listeleri">
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'enrolled'}
          className={tab === 'enrolled' ? styles.tabActive : styles.tab}
          onClick={() => setTab('enrolled')}
        >
          Kayıtlı Kurslarım
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'all'}
          className={tab === 'all' ? styles.tabActive : styles.tab}
          onClick={() => setTab('all')}
        >
          Tüm Kurslar
        </button>
      </div>

      {tab === 'enrolled' && (
        <>
          {!enrolledLoading && !enrolledError && (
            <Text role="body-md" tone="muted" as="p" className={styles.countLabel}>
              {enrolledCourses.length} aktif kurs
            </Text>
          )}
          {enrolledLoading && <Text role="body-md">Yükleniyor…</Text>}
          {!enrolledLoading && enrolledError && (
            <Text role="body-md" tone="error">
              {enrolledError}
            </Text>
          )}
          {!enrolledLoading && !enrolledError && enrolledCourses.length === 0 && (
            <Text role="body-md">Henüz kayıtlı bir kursunuz yok.</Text>
          )}
          {!enrolledLoading && !enrolledError && enrolledCourses.length > 0 && (
            <div className={styles.grid}>
              {enrolledCourses.map((course) => (
                <div
                  key={course.id}
                  role="button"
                  tabIndex={0}
                  className={styles.cardButton}
                  onClick={() => navigate(`/kurslarim/${course.id}`)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      navigate(`/kurslarim/${course.id}`);
                    }
                  }}
                >
                  <Card padding="lg" elevation="1" interactive>
                    <div className={styles.courseCard}>
                      <div className={styles.courseHeader}>
                        <div>
                          <Text role="title-md" as="h2" tone="main">
                            {course.title}
                          </Text>
                          <Text role="body-sm" tone="muted">
                            {course.category} · {course.level}
                          </Text>
                        </div>
                        <Badge tone="secondary" variant="soft">
                          {course.accessMode === 'SEQUENTIAL' ? 'Sıralı Erişim' : 'Serbest Erişim'}
                        </Badge>
                      </div>
                      <CourseInstructors instructors={course.instructors} showEmpty={false} />
                      {course.progress && (
                        <div className={styles.progressRow}>
                          <ProgressBar
                            value={course.progress.percent}
                            label={`${course.title} tamamlanma oranı`}
                            size="sm"
                          />
                          <Text role="label-md" tone="muted">
                            %{course.progress.percent}
                          </Text>
                        </div>
                      )}
                    </div>
                  </Card>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {tab === 'all' && (
        <>
          {enrollError && (
            <Text role="body-md" tone="error" className={styles.countLabel}>
              {enrollError}
            </Text>
          )}
          {allLoading && <Text role="body-md">Yükleniyor…</Text>}
          {!allLoading && allError && (
            <Text role="body-md" tone="error">
              {allError}
            </Text>
          )}
          {!allLoading && !allError && allCourses.length === 0 && (
            <Text role="body-md">Yayınlanmış kurs bulunamadı.</Text>
          )}
          {!allLoading && !allError && allCourses.length > 0 && (
            <div className={styles.grid}>
              {allCourses.map((course) => {
                const enrolled = isEnrolled(course.id);
                return (
                  <Card key={course.id} padding="lg" elevation="1">
                    <div className={styles.courseCard}>
                      <div className={styles.courseHeader}>
                        <div>
                          <Text role="title-md" as="h2" tone="main">
                            {course.title}
                          </Text>
                          <Text role="body-sm" tone="muted">
                            {course.category} · {course.level}
                          </Text>
                        </div>
                        <Badge tone="secondary" variant="soft">
                          {course.accessMode === 'SEQUENTIAL' ? 'Sıralı Erişim' : 'Serbest Erişim'}
                        </Badge>
                        {course.priceKurus ? (
                          <Badge tone="brand" variant="soft" icon="sell">
                            {formatPrice(course.priceKurus)}
                          </Badge>
                        ) : null}
                      </div>
                      <CourseInstructors instructors={course.instructors} showEmpty={false} />
                      {enrolled ? (
                        <Button
                          variant="secondary"
                          onClick={() => navigate(`/kurslarim/${course.id}`)}
                        >
                          Devam Et
                        </Button>
                      ) : course.priceKurus ? (
                        <PurchaseButton courseId={course.id} priceKurus={course.priceKurus} />
                      ) : (
                        <Button
                          variant="primary"
                          onClick={() => handleEnroll(course.id)}
                          disabled={enrollingId === course.id}
                        >
                          {enrollingId === course.id ? 'Kaydediliyor…' : 'Kayıt Ol'}
                        </Button>
                      )}
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </>
      )}
    </PageContainer>
  );
}
