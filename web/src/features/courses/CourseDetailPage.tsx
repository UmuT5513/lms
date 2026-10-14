import { Link, useParams } from 'react-router-dom';
import { Badge, Button, Card, Icon, Panel, ProgressBar, Text } from '../../components';
import { PageContainer } from '../../layout/PageContainer';
import { useCurrentUser } from '../../data/useCurrentUser';
import { CourseComments } from './CourseComments';
import { CourseInstructors } from './CourseInstructors';
import { useCourseDetail } from './useCourseDetail';
import { CONTENT_TYPE_BADGE_TONES, CONTENT_TYPE_ICONS, CONTENT_TYPE_LABELS } from './contentType';
import styles from './CourseDetailPage.module.css';

export function CourseDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { course, loading, error, enrolling, enroll } = useCourseDetail(id);
  const { user, loading: userLoading } = useCurrentUser();
  const completedIds = new Set(course?.progress?.completedLessonIds ?? []);

  // Aktif rol ADMIN ya da bu kursa atanmış INSTRUCTOR ise kurs yönetilebilir (sunucudaki canManageCourse ile aynı).
  const canManage = Boolean(
    user &&
      course &&
      (user.role === 'ADMIN' ||
        (user.role === 'INSTRUCTOR' && course.instructors?.some((instructor) => instructor.id === user.id))),
  );

  // Sunucu yönetici/eğitmen için isEnrolled=false döner ama modülleri (taslaklar dahil) gönderir;
  // bu yüzden quiz dersleri ayrı bir "Quiz Notları" panelinde listelenir.
  const quizLessons =
    canManage && course
      ? course.modules
          .slice()
          .sort((a, b) => a.order - b.order)
          .flatMap((module) =>
            module.lessons
              .slice()
              .sort((a, b) => a.order - b.order)
              .filter((lesson) => lesson.contentType === 'QUIZ')
              .map((lesson) => ({ lesson, moduleTitle: module.title })),
          )
      : [];

  return (
    <PageContainer>
      <div className={styles.header}>
        <Link to="/kurslarim" className={styles.backLink}>
          <Text role="label-md" as="span" tone="secondary">
            ← Kurslarıma Dön
          </Text>
        </Link>
      </div>

      {loading && <Text role="body-md">Yükleniyor…</Text>}
      {!loading && error && (
        <Text role="body-md" tone="error">
          {error}
        </Text>
      )}

      {!loading && !error && course && (
        <>
          <div className={styles.titleRow}>
            <div>
              <Text role="headline-lg" as="h1">
                {course.title}
              </Text>
              <Text role="body-sm" tone="muted" as="p" className={styles.meta}>
                {course.category} · {course.level}
              </Text>
              <CourseInstructors instructors={course.instructors} />
            </div>
            <Badge tone="secondary" variant="soft">
              {course.accessMode === 'SEQUENTIAL' ? 'Sıralı Erişim' : 'Serbest Erişim'}
            </Badge>
          </div>

          <Text role="body-lg" as="p" className={styles.description}>
            {course.description}
          </Text>

          {course.isEnrolled && course.progress && (
            <div className={styles.progressBlock}>
              <ProgressBar value={course.progress.percent} label="Kurs tamamlanma oranı" />
              <Text role="body-sm" tone="muted" as="p">
                {course.progress.completedCount} / {course.progress.totalLessons} ders tamamlandı
              </Text>
            </div>
          )}

          {canManage && (
            <Panel title="Quiz Notları" icon="grading" className={styles.gradesPanel}>
              {quizLessons.length === 0 ? (
                <Text role="body-md" tone="muted" as="p">
                  Bu kursta henüz quiz dersi yok.
                </Text>
              ) : (
                <ul className={styles.gradeList}>
                  {quizLessons.map(({ lesson, moduleTitle }) => (
                    <li key={lesson.id} className={styles.gradeItem}>
                      <div className={styles.gradeInfo}>
                        <Text role="body-md" as="p" tone="main">
                          {lesson.title}
                        </Text>
                        <Text role="body-sm" as="p" tone="muted">
                          {moduleTitle}
                          {lesson.status !== 'PUBLISHED' ? ' · Taslak' : ''}
                        </Text>
                      </div>
                      <Link
                        to={`/yonetim/kurslar/${course.id}/dersler/${lesson.id}/notlar`}
                        className={styles.gradeLink}
                        aria-label={`Notları gir: ${lesson.title}`}
                      >
                        <Icon name="grading" size="sm" />
                        <Text role="label-md" as="span" tone="secondary">
                          Notları gir
                        </Text>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          )}

          {!course.isEnrolled && !canManage && !userLoading && (
            <Card padding="lg" elevation="1" className={styles.lockedCard}>
              <Text role="title-md" as="h2" tone="main">
                İçerik kilitli
              </Text>
              <Text role="body-md" tone="muted" as="p" className={styles.lockedMessage}>
                Bu kursun içeriğini görüntülemek için kayıt olmalısınız.
              </Text>
              <Button variant="primary" onClick={enroll} disabled={enrolling}>
                {enrolling ? 'Kaydediliyor…' : 'Kayıt Ol'}
              </Button>
            </Card>
          )}

          {course.isEnrolled && (
            <Panel title="Modüller ve Dersler" icon="menu_book">
              {course.modules.length === 0 && (
                <Text role="body-md" tone="muted">
                  Bu kurs için henüz modül eklenmemiş.
                </Text>
              )}
              <div className={styles.moduleList}>
                {course.modules.map((module) => (
                  <Card key={module.id} padding="md" elevation="1">
                    <Text role="title-md" as="h3" tone="main">
                      {module.title}
                    </Text>
                    <ul className={styles.lessonList}>
                      {module.lessons.map((lesson) => (
                        <li key={lesson.id} className={styles.lessonItem}>
                          <Link to={`/kurslarim/${course.id}/ders/${lesson.id}`} className={styles.lessonLink}>
                            <div className={styles.lessonHeader}>
                              <Icon name={CONTENT_TYPE_ICONS[lesson.contentType]} size="sm" />
                              <Text role="body-md" as="span">
                                {lesson.title}
                              </Text>
                              <Badge tone={CONTENT_TYPE_BADGE_TONES[lesson.contentType]} variant="soft">
                                {CONTENT_TYPE_LABELS[lesson.contentType]}
                              </Badge>
                              {completedIds.has(lesson.id) && (
                                <>
                                  <Icon name="check_circle" size="sm" filled className={styles.doneIcon} />
                                  <span className={styles.visuallyHidden}>tamamlandı</span>
                                </>
                              )}
                            </div>
                            {lesson.description && (
                              <Text role="body-sm" tone="muted" as="p" className={styles.lessonDescription}>
                                {lesson.description}
                              </Text>
                            )}
                          </Link>
                        </li>
                      ))}
                      {module.lessons.length === 0 && (
                        <li className={styles.lessonItem}>
                          <Text role="body-sm" tone="muted">
                            Bu modülde henüz ders yok.
                          </Text>
                        </li>
                      )}
                    </ul>
                  </Card>
                ))}
              </div>
            </Panel>
          )}

          {(course.isEnrolled || canManage) && <CourseComments courseId={course.id} />}
        </>
      )}
    </PageContainer>
  );
}
