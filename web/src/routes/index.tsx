import { lazy, Suspense } from 'react';
import { createBrowserRouter } from 'react-router-dom';
import { AppShell } from '../layout/AppShell';
import { RequireAuth } from './RequireAuth';
import { RequireRole } from './RequireRole';
import { RedirectIfAuthed } from './RedirectIfAuthed';
import { DashboardPage } from '../features/dashboard';
import { CoursesPage, CourseDetailPage, LessonDetailPage } from '../features/courses';
import { AnnouncementsPage, AnnouncementDetailPage, AnnouncementsAdminPage } from '../features/announcements';
import { AssignmentsPage } from '../features/assignments';
import { ExamsPage } from '../features/exams';
import { LoginPage, RegisterPage } from '../features/auth';
import { ProfilePage } from '../features/profile';
import { CheckoutPage, PaymentResultPage } from '../features/payments';
import {
  AdminCoursesPage,
  CourseStudentsPage,
  CourseContentPage,
  QuizGradesPage,
} from '../features/admin/courses';
import { AdminNavItemsPage } from '../features/admin/nav-items';
import { AdminUsersPage } from '../features/admin/users';
import { AdminExamsPage, ExamEditorPage } from '../features/admin/exams';
import { QuestionBanksPage, QuestionBankDetailPage } from '../features/admin/question-banks';

// Takvim, FullCalendar'ı ana pakete eklememek için ayrı parça (chunk) olarak yüklenir.
const CalendarPage = lazy(() => import('../features/calendar').then((m) => ({ default: m.CalendarPage })));
const CalendarAdminPage = lazy(() =>
  import('../features/calendar').then((m) => ({ default: m.CalendarAdminPage })),
);

/**
 * Yollar layout/Sidebar/navItems.ts ile birebir eşleşir.
 * Yeni sayfa eklerken iki dosyayı birlikte güncelle.
 */
export const router = createBrowserRouter([
  {
    element: <RequireAuth />,
    children: [
      {
        path: '/',
        element: <AppShell />,
        children: [
          { index: true, element: <DashboardPage /> },
          { path: 'kurslarim', element: <CoursesPage /> },
          { path: 'kurslarim/:id', element: <CourseDetailPage /> },
          { path: 'kurslarim/:courseId/ders/:lessonId', element: <LessonDetailPage /> },
          { path: 'duyurular', element: <AnnouncementsPage /> },
          { path: 'duyurular/:id', element: <AnnouncementDetailPage /> },
          {
            path: 'takvim',
            element: (
              <Suspense fallback={null}>
                <CalendarPage />
              </Suspense>
            ),
          },
          { path: 'notlar-ve-gorevler', element: <AssignmentsPage /> },
          { path: 'sinavlar', element: <ExamsPage /> },
          { path: 'profil', element: <ProfilePage /> },
          { path: 'odeme/sonuc', element: <PaymentResultPage /> },
          { path: 'odeme/:courseId', element: <CheckoutPage /> },
          {
            element: <RequireRole allow={['ADMIN']} />,
            children: [
              { path: 'yonetim/kurslar', element: <AdminCoursesPage /> },
              { path: 'yonetim/kurslar/:id/ogrenciler', element: <CourseStudentsPage /> },
              { path: 'yonetim/kurslar/:id/icerik', element: <CourseContentPage /> },
              { path: 'yonetim/menu', element: <AdminNavItemsPage /> },
              { path: 'yonetim/kullanicilar', element: <AdminUsersPage /> },
            ],
          },
          {
            // Quiz notlarını yöneticiler ve kursa atanmış eğitmenler girer (sunucu ayrıca yetki denetler).
            element: <RequireRole allow={['ADMIN', 'INSTRUCTOR']} />,
            children: [
              { path: 'yonetim/kurslar/:courseId/dersler/:lessonId/notlar', element: <QuizGradesPage /> },
              { path: 'yonetim/duyurular', element: <AnnouncementsAdminPage /> },
              { path: 'yonetim/sinavlar', element: <AdminExamsPage /> },
              { path: 'yonetim/sinavlar/:examId', element: <ExamEditorPage /> },
              { path: 'yonetim/soru-bankasi', element: <QuestionBanksPage /> },
              { path: 'yonetim/soru-bankasi/:bankId', element: <QuestionBankDetailPage /> },
              {
                path: 'yonetim/takvim',
                element: (
                  <Suspense fallback={null}>
                    <CalendarAdminPage />
                  </Suspense>
                ),
              },
            ],
          },
        ],
      },
    ],
  },
  {
    element: <RedirectIfAuthed />,
    children: [
      { path: 'giris', element: <LoginPage /> },
      { path: 'kayit', element: <RegisterPage /> },
    ],
  },
]);
