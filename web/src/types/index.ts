import type { BadgeTone } from '../components';
import type { StatTone } from '../components';

export type UserRole = 'STUDENT' | 'INSTRUCTOR' | 'ADMIN';

export interface UserProfile {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  roles: UserRole[];
  avatarUrl: string | null;
  locale: string;
  createdAt: string;
}

export interface StudentProfile {
  fullName: string;
  studentNumber: string;
  avatarUrl?: string;
}

export interface TermInfo {
  label: string;
  streakDays: number;
  weeklyGoalHours: number;
  minutesCompletedToday: number;
  weeklyGoalProgress: number;
}

/** Haftalık aktivite grafiğinin tek bir günü (GET /api/v1/users/me/activity'den türetilir). */
export interface ActivityDay {
  /** YYYY-MM-DD */
  date: string;
  /** Kısa gün adı; bugün için "Bugün". */
  label: string;
  /** Video derslerde geçen süre, dakika. */
  videoMinutes: number;
  /** Doküman, bağlantı, metin ve quiz derslerinde geçen süre, dakika. */
  otherMinutes: number;
  isToday: boolean;
}

/** GET /api/v1/users/me/activity yanıtındaki tek gün. */
export interface StudyActivityDay {
  date: string;
  videoSeconds: number;
  quizSeconds: number;
  readingSeconds: number;
  totalSeconds: number;
}

/** GET /api/v1/users/me/activity yanıtı. */
export interface StudyActivityReport {
  timezone: string;
  /** YYYY-MM-DD, sunucunun takvimine göre bugün. */
  today: string;
  days: StudyActivityDay[];
  totals: { todaySeconds: number; rangeSeconds: number; monthSeconds: number };
  streakDays: number;
}

/** GET /api/v1/users/me/grades yanıtındaki özet; not yoksa sayısal alanlar null gelir. */
export interface GradeSummary {
  /** Yuvarlanmış tam sayı; hiç not yoksa null. */
  averageScore: number | null;
  /** AA, BA, BB, CB, CC, DC, DD, FD, FF */
  letterGrade: string | null;
  /** Yüksek, İyi, Orta, Düşük */
  level: string | null;
  gradeCount: number;
  lastScore: number | null;
  /** Son not − diğer notların ortalaması; gradeCount < 2 ise null. */
  trend: number | null;
}

/** Öğrencinin tek bir quiz notu (gradedAt'e göre yeniden eskiye sıralı gelir). */
export interface MyGrade {
  lessonId: string;
  lessonTitle: string;
  courseId: string;
  courseTitle: string;
  score: number;
  gradedAt: string;
}

/** GET /api/v1/users/me/grades yanıtı. */
export interface MyGradesReport {
  summary: GradeSummary;
  grades: MyGrade[];
}

export interface KpiMetric {
  id: string;
  label: string;
  value: string;
  unit?: string;
  icon: string;
  iconTone: StatTone;
  /** Değerin altındaki açıklama satırı. */
  footnote?: string;
  footnoteIcon?: string;
  /** Verildiğinde dipnot yerine ilerleme çubuğu çizilir. */
  progress?: number;
}

export type TaskKind = 'assignment' | 'exam' | 'lab';

export interface UpcomingTask {
  id: string;
  kind: TaskKind;
  /** Sol üstteki tür/öncelik etiketi. */
  tagLabel: string;
  tagTone: BadgeTone;
  tagIcon?: string;
  /** Sağ üstteki kalan süre bilgisi. */
  dueLabel: string;
  title: string;
  description: string;
  metaIcon: string;
  metaLabel: string;
  durationLabel?: string;
  actionLabel: string;
}

export interface Announcement {
  id: string;
  title: string;
  source: string;
  timeAgo: string;
  /** Okunmamış/yeni durumunu gösteren nokta rengi. */
  tone: 'secondary' | 'cyan' | 'muted';
}

export interface AiGuide {
  title: string;
  status: string;
  message: string;
  highlight: string;
  ctaLabel: string;
}

export type CourseAccessMode = 'SEQUENTIAL' | 'FREE';

/** Kurs tamamlanma özeti (users/me/courses öğelerinde). */
export interface CourseProgress {
  percent: number;
  completedCount: number;
  totalLessons: number;
}

/** Kurs tamamlanma detayı (courses/:id ve lessons/:id/completion yanıtlarında). */
export interface CourseProgressDetail extends CourseProgress {
  courseId: string;
  completedLessonIds: string[];
}

/** Kursa atanmış eğitmen (position'a göre sıralı; ilk eleman baş eğitmen). */
export interface CourseInstructor {
  id: string;
  name: string;
  avatarUrl: string | null;
  position: number;
}

/** GET /api/v1/courses ve GET /api/v1/users/me/courses ortak kurs özeti. */
export interface CourseSummary {
  id: string;
  title: string;
  category: string;
  level: string;
  accessMode: CourseAccessMode;
  /** Yalnızca users/me/courses yanıtında gelir. */
  progress?: CourseProgress;
  instructors?: CourseInstructor[];
  /** Sıradaki tamamlanmamış ders; hepsi bittiyse null. */
  nextLesson?: CourseNextLesson | null;
  moduleCount?: number;
}

export interface CourseNextLesson {
  id: string;
  title: string;
  contentType: ContentType;
  contentUrl: string | null;
}

export type ContentType = 'VIDEO_YOUTUBE' | 'DOCUMENT' | 'QUIZ' | 'LINK' | 'TEXT';

export interface CourseLessonSummary {
  id: string;
  title: string;
  description: string | null;
  contentType: ContentType;
  contentUrl: string | null;
  order: number;
  status: string;
}

export interface CourseModuleSummary {
  id: string;
  title: string;
  order: number;
  lessons: CourseLessonSummary[];
}

/** GET /api/v1/courses/:id yanıtı. */
export interface CourseDetail {
  id: string;
  title: string;
  description: string;
  category: string;
  level: string;
  tags: string[];
  accessMode: CourseAccessMode;
  status: string;
  /** Öğrenci bu kursa kayıtlı mı; false ise modules boş döner. */
  isEnrolled: boolean;
  modules: CourseModuleSummary[];
  /** Yalnızca isEnrolled true iken gelir. */
  progress?: CourseProgressDetail;
  instructors?: CourseInstructor[];
}

export interface DashboardData {
  student: StudentProfile;
  term: TermInfo;
  weeklyGoalSummary: string;
  kpis: KpiMetric[];
  upcomingTasks: UpcomingTask[];
  aiGuide: AiGuide;
  announcements: Announcement[];
}

export interface MyLessonFeedback {
  liked: boolean;
  rating: number | null;
}

export interface LessonFeedback {
  likeCount: number;
  ratingCount: number;
  ratingAverage: number | null;
  mine: MyLessonFeedback;
}

export interface CourseComment {
  id: string;
  body: string;
  createdAt: string;
  updatedAt: string;
  author: { id: string; name: string; avatarUrl: string | null };
  canDelete: boolean;
  reply: CourseCommentReply | null;
  canReply: boolean;
  canDeleteReply: boolean;
}

export interface CourseCommentReply {
  body: string;
  createdAt: string;
  author: { id: string; name: string; avatarUrl: string | null };
}

/** Takvim etkinliği türü; renk ve simge bu türe göre seçilir. */
export type CalendarEventType = 'lecture' | 'lab' | 'exam' | 'deadline' | 'holiday' | 'event';

/** Akademik takvim etkinliği (GET /api/v1/calendar/events yanıtı). */
export interface CalendarEvent {
  id: string;
  title: string;
  description: string | null;
  type: CalendarEventType;
  /** Tüm gün etkinliklerde YYYY-MM-DD; zamanlı etkinliklerde ISO 8601 UTC. */
  start: string;
  /** Tüm gün etkinliklerde bitiş günü hariçtir (exclusive). */
  end: string | null;
  allDay: boolean;
  location: string | null;
  course: { id: string; title: string } | null;
  /** Mevcut kullanıcı bu etkinliği düzenleyip silebilir mi. */
  canEdit: boolean;
}

/** Duyuru kategorisi; simge ve renk bu kategoriye göre seçilir. */
export type AnnouncementCategory = 'ACADEMIC' | 'COURSE' | 'IT' | 'EVENT' | 'GENERAL';

/** Duyurunun türetilmiş yaşam döngüsü durumu. */
export type AnnouncementState = 'DRAFT' | 'SCHEDULED' | 'PUBLISHED' | 'EXPIRED';

/** Duyuru (GET /api/v1/announcements ve /manage yanıtı). */
export interface AnnouncementItem {
  id: string;
  title: string;
  /** Düz metin; paragraflar boş satırla ayrılır. */
  body: string;
  category: AnnouncementCategory;
  status: 'DRAFT' | 'PUBLISHED';
  state: AnnouncementState;
  /** ISO 8601 UTC; taslakta null olabilir. */
  publishAt: string | null;
  expiresAt: string | null;
  pinned: boolean;
  course: { id: string; title: string } | null;
  author: { id: string; name: string } | null;
  createdAt: string;
  updatedAt: string;
  /** Mevcut kullanıcı bu duyuruyu düzenleyip silebilir mi. */
  canEdit: boolean;
}

/** Yönetim panelindeki kullanıcı (GET /api/v1/admin/users yanıtı). */
export interface AdminUser extends UserProfile {
  status: 'ACTIVE' | 'DISABLED';
  disabledAt: string | null;
  /** Kayıtlı olduğu kurs sayısı. */
  enrollmentCount: number;
  /** Eğitmen olarak atandığı kurs sayısı. */
  teachingCount: number;
}

export interface AdminUserSummary {
  total: number;
  disabled: number;
  students: number;
  instructors: number;
  admins: number;
}

/** Soru tipleri (FR-40). */
export type QuestionType =
  | 'SINGLE_CHOICE'
  | 'MULTIPLE_CHOICE'
  | 'TRUE_FALSE'
  | 'FILL_BLANK'
  | 'MATCHING'
  | 'SHORT_ANSWER'
  | 'ESSAY';

export type QuestionDifficulty = 'EASY' | 'MEDIUM' | 'HARD';

export interface ChoiceOption {
  id: string;
  text: string;
  correct: boolean;
}

export interface MatchingPair {
  id: string;
  left: string;
  right: string;
}

/** Tipe göre soru içeriği (doğru cevaplar dahil; yalnızca yönetim API'sinde gelir). */
export interface QuestionContentMap {
  SINGLE_CHOICE: { options: ChoiceOption[] };
  MULTIPLE_CHOICE: { options: ChoiceOption[] };
  TRUE_FALSE: { correctAnswer: boolean };
  FILL_BLANK: { blanks: { accepted: string[] }[]; caseSensitive: boolean };
  MATCHING: { pairs: MatchingPair[] };
  SHORT_ANSWER: { accepted: string[]; caseSensitive: boolean };
  ESSAY: { rubric: string | null };
}

/** Tip ile içeriği birbirine bağlayan ayrık birleşim. */
export type TypedQuestionContent = {
  [K in QuestionType]: { type: K; content: QuestionContentMap[K] };
}[QuestionType];

/** Soru bankasındaki soru (GET /api/v1/question-banks/:id/questions). */
export type BankQuestion = TypedQuestionContent & {
  id: string;
  bank: { id: string; name: string };
  stem: string;
  explanation: string | null;
  topic: string | null;
  difficulty: QuestionDifficulty;
  points: number;
  /** Sorunun eklendiği sınav sayısı. */
  usageCount: number;
  createdBy: { id: string; name: string } | null;
  createdAt: string;
  updatedAt: string;
  canEdit: boolean;
};

export interface QuestionBank {
  id: string;
  name: string;
  description: string | null;
  /** null = genel banka (tüm kursların sınavlarında kullanılabilir). */
  course: { id: string; title: string } | null;
  questionCount: number;
  createdBy: { id: string; name: string } | null;
  createdAt: string;
  updatedAt: string;
  canEdit: boolean;
}

export type ExamType = 'QUIZ' | 'MIDTERM' | 'FINAL' | 'PRACTICE';
export type ExamStatus = 'DRAFT' | 'PUBLISHED';
/** Sunucu saatine göre sınav penceresinin durumu. */
export type ExamAvailability = 'UPCOMING' | 'OPEN' | 'CLOSED';
/** COURSE = kursa kayıtlı herkes, SELECTED = yalnızca seçilen öğrenciler. */
export type ExamAudience = 'COURSE' | 'SELECTED';

/** Sınav ayarları (FR-42); PATCH gövdesi bunların kısmi halidir. */
export interface ExamSettings {
  title: string;
  description: string | null;
  type: ExamType;
  status: ExamStatus;
  startsAt: string | null;
  endsAt: string | null;
  durationMinutes: number | null;
  maxAttempts: number;
  passingScore: number | null;
  shuffleQuestions: boolean;
  shuffleOptions: boolean;
  randomQuestionCount: number | null;
  showResults: boolean;
  audience: ExamAudience;
}

export interface ManagedExam extends ExamSettings {
  id: string;
  course: { id: string; title: string };
  availability: ExamAvailability;
  questionCount: number;
  totalPoints: number;
  /** Sınava girebilecek (kursa kayıtlı) öğrenci sayısı. */
  candidateCount: number;
  createdBy: { id: string; name: string } | null;
  createdAt: string;
  updatedAt: string;
}

export interface ExamQuestionLink {
  questionId: string;
  position: number;
  /** Bu sınavdaki puanı. */
  points: number;
  question: BankQuestion;
}

export interface ExamDetail {
  exam: ManagedExam;
  questions: ExamQuestionLink[];
}

export interface ExamCandidate {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
  selected: boolean;
}

/** Öğrencinin girebileceği sınav (GET /api/v1/exams/my); soru içermez. */
export interface MyExam {
  id: string;
  title: string;
  description: string | null;
  type: ExamType;
  course: { id: string; title: string };
  startsAt: string | null;
  endsAt: string | null;
  durationMinutes: number | null;
  maxAttempts: number;
  passingScore: number | null;
  questionCount: number;
  availability: ExamAvailability;
}
