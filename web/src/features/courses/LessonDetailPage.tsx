import { Link, useNavigate, useParams } from 'react-router-dom';
import { Button, Card, Icon, Panel, ProgressBar, Text } from '../../components';
import { PageContainer } from '../../layout/PageContainer';
import { useCourseDetail } from './useCourseDetail';
import { PurchaseButton } from '../payments';
import { useLessonAutoComplete } from './useLessonAutoComplete';
import { useStudyTracker } from './useStudyTracker';
import { useMyLessonGrade } from './useMyLessonGrade';
import { LessonFeedback } from './LessonFeedback';
import { CONTENT_TYPE_ICONS } from './contentType';
import type { CourseLessonSummary, CourseModuleSummary } from '../../types';
import styles from './LessonDetailPage.module.css';

/** `watch?v=ID`, `youtu.be/ID` ve zaten `embed/ID` biçimindeki bağlantılardan YouTube video kimliğini çıkarır. */
function extractYouTubeId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=)([\w-]{6,})/,
    /(?:youtu\.be\/)([\w-]{6,})/,
    /(?:youtube\.com\/embed\/)([\w-]{6,})/,
  ];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) {
      return match[1];
    }
  }
  return null;
}

interface FlatLesson {
  lesson: CourseLessonSummary;
  module: CourseModuleSummary;
}

export function LessonDetailPage() {
  const { courseId, lessonId } = useParams<{ courseId: string; lessonId: string }>();
  const navigate = useNavigate();
  const { course, loading, error, enrolling, enroll, setLessonCompleted, progressError } = useCourseDetail(courseId);

  const lessonExists = Boolean(
    lessonId && course?.modules.some((module) => module.lessons.some((lesson) => lesson.id === lessonId)),
  );
  const alreadyCompleted = Boolean(lessonId && course?.progress?.completedLessonIds.includes(lessonId));
  useLessonAutoComplete(lessonId, Boolean(course?.isEnrolled) && lessonExists && !alreadyCompleted, (id) =>
    setLessonCompleted(id, true),
  );
  useStudyTracker(lessonId, Boolean(course?.isEnrolled) && lessonExists);

  if (loading) {
    return (
      <PageContainer>
        <Text role="body-md">Yükleniyor…</Text>
      </PageContainer>
    );
  }

  if (error || !course) {
    return (
      <PageContainer>
        <Text role="body-md" tone="error">
          {error ?? 'Kurs bulunamadı.'}
        </Text>
        <Link to="/kurslarim" className={styles.backLink}>
          <Text role="label-md" as="span" tone="secondary">
            ← Kurslarıma Dön
          </Text>
        </Link>
      </PageContainer>
    );
  }

  if (!course.isEnrolled) {
    return (
      <PageContainer>
        <div className={styles.header}>
          <Link to={`/kurslarim/${course.id}`} className={styles.backLink}>
            <Text role="label-md" as="span" tone="secondary">
              ← {course.title}
            </Text>
          </Link>
        </div>
        <Card padding="lg" elevation="1" className={styles.lockedCard}>
          <Text role="title-md" as="h2" tone="main">
            İçerik kilitli
          </Text>
          <Text role="body-md" tone="muted" as="p" className={styles.lockedMessage}>
            {course.priceKurus > 0
              ? 'Bu kurs ücretlidir. İçeriğe erişmek için satın almalısınız.'
              : 'Bu kursun içeriğini görüntülemek için kayıt olmalısınız.'}
          </Text>
          {course.priceKurus > 0 ? (
            <PurchaseButton courseId={course.id} priceKurus={course.priceKurus} />
          ) : (
            <Button variant="primary" onClick={enroll} disabled={enrolling}>
              {enrolling ? 'Kaydediliyor…' : 'Kayıt Ol'}
            </Button>
          )}
        </Card>
      </PageContainer>
    );
  }

  const flattened: FlatLesson[] = course.modules
    .slice()
    .sort((a, b) => a.order - b.order)
    .flatMap((module) =>
      module.lessons
        .slice()
        .sort((a, b) => a.order - b.order)
        .map((lesson) => ({ lesson, module })),
    );

  const activeIndex = flattened.findIndex((entry) => entry.lesson.id === lessonId);

  if (activeIndex === -1) {
    return (
      <PageContainer>
        <Text role="body-md" tone="error">
          Ders bulunamadı.
        </Text>
        <Link to={`/kurslarim/${course.id}`} className={styles.backLink}>
          <Text role="label-md" as="span" tone="secondary">
            ← {course.title}
          </Text>
        </Link>
      </PageContainer>
    );
  }

  const active = flattened[activeIndex];
  const previous = activeIndex > 0 ? flattened[activeIndex - 1] : null;
  const next = activeIndex < flattened.length - 1 ? flattened[activeIndex + 1] : null;

  const completedIds = new Set(course.progress?.completedLessonIds ?? []);

  const goTo = (entry: FlatLesson | null) => {
    if (!entry) return;
    navigate(`/kurslarim/${course.id}/ders/${entry.lesson.id}`);
  };

  return (
    <PageContainer>
      <nav className={styles.breadcrumb} aria-label="Sayfa yolu">
        <Link to="/kurslarim">
          <Text role="label-md" as="span" tone="secondary">
            Kurslarım
          </Text>
        </Link>
        <Icon name="chevron_right" size="sm" />
        <Link to={`/kurslarim/${course.id}`}>
          <Text role="label-md" as="span" tone="secondary">
            {course.title}
          </Text>
        </Link>
        <Icon name="chevron_right" size="sm" />
        <Text role="label-md" as="span" tone="muted">
          {active.module.title}
        </Text>
        <Icon name="chevron_right" size="sm" />
        <Text role="label-md" as="span" tone="main">
          {active.lesson.title}
        </Text>
      </nav>

      <div className={styles.layout}>
        <div className={styles.main}>
          <Text role="headline-lg" as="h1">
            {active.lesson.title}
          </Text>
          {active.lesson.description && (
            <Text role="body-md" tone="muted" as="p" className={styles.description}>
              {active.lesson.description}
            </Text>
          )}

          <LessonContent lesson={active.lesson} />

          <LessonFeedback lessonId={active.lesson.id} />

          {progressError && (
            <Text role="body-sm" tone="error" as="p" className={styles.completion}>
              {progressError}
            </Text>
          )}

          <div className={styles.navButtons}>
            <Button variant="secondary" iconStart="chevron_left" onClick={() => goTo(previous)} disabled={!previous}>
              Önceki Ders
            </Button>
            <Button variant="primary" iconEnd="chevron_right" onClick={() => goTo(next)} disabled={!next}>
              Sonraki Ders
            </Button>
          </div>
        </div>

        <Panel title="Müfredat" icon="menu_book" className={styles.curriculum}>
          {course.progress && (
            <div className={styles.progressBlock}>
              <ProgressBar value={course.progress.percent} label="Kurs tamamlanma oranı" size="sm" />
              <Text role="label-md" tone="muted">
                %{course.progress.percent}
              </Text>
            </div>
          )}
          <div className={styles.moduleList}>
            {course.modules
              .slice()
              .sort((a, b) => a.order - b.order)
              .map((module) => (
                <div key={module.id} className={styles.moduleGroup}>
                  <Text role="title-md" as="h3" tone="main">
                    {module.title}
                  </Text>
                  <ul className={styles.lessonList}>
                    {module.lessons
                      .slice()
                      .sort((a, b) => a.order - b.order)
                      .map((lesson) => (
                        <li key={lesson.id}>
                          <Link
                            to={`/kurslarim/${course.id}/ders/${lesson.id}`}
                            className={[
                              styles.lessonLink,
                              lesson.id === active.lesson.id ? styles.lessonLinkActive : null,
                            ]
                              .filter(Boolean)
                              .join(' ')}
                          >
                            <Icon name={CONTENT_TYPE_ICONS[lesson.contentType]} size="sm" />
                            <Text role="body-sm" as="span" className={styles.lessonTitle}>
                              {lesson.title}
                            </Text>
                            {completedIds.has(lesson.id) && (
                              <>
                                <Icon name="check_circle" size="sm" filled className={styles.doneIcon} />
                                <span className={styles.visuallyHidden}>tamamlandı</span>
                              </>
                            )}
                          </Link>
                        </li>
                      ))}
                  </ul>
                </div>
              ))}
          </div>
        </Panel>
      </div>
    </PageContainer>
  );
}

/** Öğrencinin bu quizdeki notu (varsa). Not, eğitmen/yönetici tarafından elle girilir. */
function QuizGrade({ lessonId }: { lessonId: string }) {
  const { grade, loading, error } = useMyLessonGrade(lessonId);

  if (loading) {
    return (
      <Text role="body-md" tone="muted" as="p">
        Not bilgisi yükleniyor…
      </Text>
    );
  }

  if (error) {
    return (
      <Text role="body-md" tone="error" as="p">
        {error}
      </Text>
    );
  }

  if (!grade) {
    return (
      <Text role="body-md" tone="muted" as="p">
        Bu quizin notu henüz girilmedi.
      </Text>
    );
  }

  return (
    <>
      <Text role="title-md" as="p" tone="main">
        {`Notun: ${grade.score} / 100`}
      </Text>
      <Text role="body-sm" tone="muted" as="p">
        {`Girilme tarihi: ${new Date(grade.gradedAt).toLocaleDateString('tr-TR')}`}
      </Text>
    </>
  );
}

function LessonContent({ lesson }: { lesson: CourseLessonSummary }) {
  switch (lesson.contentType) {
    case 'VIDEO_YOUTUBE': {
      const videoId = lesson.contentUrl ? extractYouTubeId(lesson.contentUrl) : null;
      if (!videoId) {
        return (
          <Card padding="md" elevation="1">
            <Text role="body-md" tone="muted">
              Video bağlantısı geçersiz görünüyor.
            </Text>
          </Card>
        );
      }
      return (
        <div className={styles.videoWrapper}>
          <iframe
            className={styles.video}
            src={`https://www.youtube.com/embed/${videoId}`}
            title={lesson.title}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>
      );
    }
    case 'DOCUMENT':
    case 'LINK':
      return (
        <Card padding="lg" elevation="1" className={styles.ctaCard}>
          <Icon name={CONTENT_TYPE_ICONS[lesson.contentType]} size="xl" />
          <Text role="title-md" as="h2" tone="main">
            {lesson.contentType === 'DOCUMENT' ? 'Doküman' : 'Bağlantı'}
          </Text>
          {lesson.contentUrl ? (
            <a href={lesson.contentUrl} target="_blank" rel="noopener noreferrer" className={styles.ctaLink}>
              <Button variant="primary" iconEnd="open_in_new">
                Görüntüle / İndir
              </Button>
            </a>
          ) : (
            <Text role="body-md" tone="muted">
              Bu ders için bağlantı tanımlanmamış.
            </Text>
          )}
        </Card>
      );
    case 'QUIZ':
      return (
        <Card padding="lg" elevation="1" className={styles.quizGrade}>
          <QuizGrade lessonId={lesson.id} />
        </Card>
      );
    case 'TEXT':
    default:
      return (
        <Card padding="lg" elevation="1">
          <Text role="body-md" as="p">
            {lesson.description ?? 'Bu ders için içerik eklenmemiş.'}
          </Text>
        </Card>
      );
  }
}
