import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { DefaultProviders } from "./components/providers/default.tsx";
import { useServiceWorker } from "@/hooks/use-service-worker.ts";
import InstallGateGuard from "@/components/install-gate-guard.tsx";
import InstallGatePage from "./pages/install/page.tsx";
import AuthCallback from "./pages/auth/Callback.tsx";
import Index from "./pages/Index.tsx";
import NotFound from "./pages/NotFound.tsx";
import DashboardLayout from "./pages/dashboard/_components/DashboardLayout.tsx";
import DashboardHome from "./pages/dashboard/page.tsx";
import DirectoryPage from "./pages/directory/page.tsx";
import DirectoryEmployeeDetailPage from "./pages/directory/DetailPage.tsx";
import MyProfilePage from "./pages/my-profile/page.tsx";
import ProfileVerificationPage from "./pages/profile-verification/page.tsx";
import LeavePage from "./pages/leave/page.tsx";
import CalendarPage from "./pages/calendar/page.tsx";
import EventDetailPage from "./pages/calendar/DetailPage.tsx";
import DocumentsPage from "./pages/documents/page.tsx";
import MyDocumentsPage from "./pages/my-documents/page.tsx";
import ForumPage from "./pages/forum/page.tsx";
import ThreadDetailPage from "./pages/forum/ThreadDetailPage.tsx";
import SuggestionsPage from "./pages/suggestions/page.tsx";
import SupportPage from "./pages/support/page.tsx";
import TicketDetailPage from "./pages/support/TicketDetailPage.tsx";
import GalleryPage from "./pages/gallery/page.tsx";
import AlbumDetailPage from "./pages/gallery/AlbumDetailPage.tsx";
import CelebrationsPage from "./pages/celebrations/page.tsx";
import RecognitionsPage from "./pages/recognitions/page.tsx";
import PollsPage from "./pages/polls/page.tsx";
import RoomsPage from "./pages/rooms/page.tsx";
import OrganizationPage from "./pages/organization/page.tsx";
import BillingPage from "./pages/billing/page.tsx";
import DepartmentDetailPage from "./pages/organization/DepartmentDetailPage.tsx";
import TeamsPage from "./pages/teams/page.tsx";
import AdminPage from "./pages/admin/page.tsx";
import NotificationsPage from "./pages/notifications/page.tsx";
import NotificationSettingsPage from "./pages/notification-settings/page.tsx";
import AttendancePage from "./pages/attendance/page.tsx";
import ProjectsPage from "./pages/projects/page.tsx";
import ProjectDetailPage from "./pages/projects/ProjectDetailPage.tsx";
import MessagesPage from "./pages/messages/page.tsx";
import WikiPage from "./pages/wiki/page.tsx";
import WikiSpaceDetailPage from "./pages/wiki/SpaceDetailPage.tsx";
import WikiArticleDetailPage from "./pages/wiki/ArticleDetailPage.tsx";
import ExpensesPage from "./pages/expenses/page.tsx";
import FundRequestsPage from "./pages/fund-requests/page.tsx";
import LettersPage from "./pages/letters/page.tsx";
import TravelPage from "./pages/travel/page.tsx";
import TravelDetailPage from "./pages/travel/DetailPage.tsx";
import OnboardingPage from "./pages/onboarding/page.tsx";
import TrainingPage from "./pages/training/page.tsx";
import CourseDetailPage from "./pages/training/CourseDetailPage.tsx";
import LearningPathDetailPage from "./pages/training/LearningPathDetailPage.tsx";
import FlashcardDeckDetailPage from "./pages/training/FlashcardDeckDetailPage.tsx";
import MentorshipPage from "./pages/mentorship/page.tsx";
import MentorshipDetailPage from "./pages/mentorship/MentorshipDetailPage.tsx";
import PeerGroupDetailPage from "./pages/mentorship/PeerGroupDetailPage.tsx";
import JobsPage from "./pages/jobs/page.tsx";
import JobDetailPage from "./pages/jobs/JobDetailPage.tsx";
import PerformancePage from "./pages/performance/page.tsx";
import PerformanceDetailPage from "./pages/performance/DetailPage.tsx";
import NewsPage from "./pages/news/page.tsx";
import NewsDetailPage from "./pages/news/DetailPage.tsx";
import AssetsPage from "./pages/assets/page.tsx";
import AssetDetailPage from "./pages/assets/DetailPage.tsx";
import AwardsPage from "./pages/awards/page.tsx";
import AwardDetailPage from "./pages/awards/DetailPage.tsx";
import ReportsPage from "./pages/reports/page.tsx";
import AnalyticsPage from "./pages/analytics/page.tsx";
import PoliciesPage from "./pages/policies/page.tsx";
import PolicyDetailPage from "./pages/policies/DetailPage.tsx";
import PayrollPage from "./pages/payroll/page.tsx";
import RecruitmentPage from "./pages/recruitment/page.tsx";
import OkrPage from "./pages/okr/page.tsx";
import EngagementPage from "./pages/engagement/page.tsx";
import PulsePage from "./pages/pulse/page.tsx";
import Feedback360Page from "./pages/feedback360/page.tsx";
import Feedback360DetailPage from "./pages/feedback360/DetailPage.tsx";
import GradingPage from "./pages/grading/page.tsx";
import GradingDetailPage from "./pages/grading/DetailPage.tsx";
import TalentPage from "./pages/talent/page.tsx";
import TalentDetailPage from "./pages/talent/DetailPage.tsx";
import OffboardingPage from "./pages/offboarding/page.tsx";
import EventsPage from "./pages/events/page.tsx";
import CareerPathPage from "./pages/career-path/page.tsx";
import CareerPathDetailPage from "./pages/career-path/DetailPage.tsx";
import CareerPlanningPage from "./pages/career-planning/page.tsx";
import ChatbotPage from "./pages/chatbot/page.tsx";
import UserSettingsPage from "./pages/settings/users/page.tsx";
import QaExportPage from "./pages/qa-export/page.tsx";
import LogoDownloadPage from "./pages/logo-download/page.tsx";
import SuperAdminPage from "./pages/super-admin/page.tsx";
import OrganizationsManagementPage from "./pages/super-admin/organizations/page.tsx";
import DownloadPricingPdf from "./pages/download-pricing/page.tsx";
import HomePage from "./pages/home/page.tsx";
import FinanceDashboardPage from "./pages/finance-dashboard/page.tsx";
import FinanceAuditPage from "./pages/finance-audit/page.tsx";
import FinanceSettingsPage from "./pages/finance-settings/page.tsx";
import PresentationPage from "./pages/presentation/page.tsx";
import ProfileEditPage from "./pages/profile/page.tsx";
import LetterVerifyPage from "./pages/letter-verify/page.tsx";
import DocumentArchivePage from "./pages/document-archive/page.tsx";
import DataPrivacyPage from "./pages/data-privacy/page.tsx";
import CallsPage from "./pages/calls/page.tsx";

export default function App() {
  useServiceWorker();
  return (
    <DefaultProviders>
      <BrowserRouter>
        <InstallGateGuard>
        <Routes>
          <Route path="/install" element={<InstallGatePage />} />
          <Route path="/" element={<Index />} />
          <Route path="/presentation" element={<PresentationPage />} />
          <Route path="/download-pricing" element={<DownloadPricingPdf />} />
          <Route path="/auth/callback" element={<AuthCallback />} />
          <Route path="/verifikasi-surat" element={<LetterVerifyPage />} />
          <Route path="/verifikasi-surat/:code" element={<LetterVerifyPage />} />
          <Route element={<DashboardLayout />}>
            <Route path="/home" element={<HomePage />} />
            <Route path="/dashboard" element={<DashboardHome />} />
            <Route path="/my-profile" element={<MyProfilePage />} />
            <Route path="/profile-verification" element={<ProfileVerificationPage />} />
            <Route path="/directory" element={<DirectoryPage />} />
            <Route
              path="/directory/:userId"
              element={<DirectoryEmployeeDetailPage />}
            />
            <Route path="/leave" element={<LeavePage />} />
            <Route path="/calendar" element={<CalendarPage />} />
            <Route path="/calendar/:eventId" element={<EventDetailPage />} />
            <Route path="/documents" element={<DocumentsPage />} />
            <Route path="/my-documents" element={<MyDocumentsPage />} />
            <Route path="/forum" element={<ForumPage />} />
            <Route path="/forum/:threadId" element={<ThreadDetailPage />} />
            <Route path="/suggestions" element={<SuggestionsPage />} />
            <Route path="/support" element={<SupportPage />} />
            <Route path="/support/:ticketId" element={<TicketDetailPage />} />
            <Route path="/gallery" element={<GalleryPage />} />
            <Route path="/gallery/:albumId" element={<AlbumDetailPage />} />
            <Route path="/celebrations" element={<CelebrationsPage />} />
            <Route path="/recognitions" element={<RecognitionsPage />} />
            <Route path="/polls" element={<PollsPage />} />
            <Route path="/rooms" element={<RoomsPage />} />
            <Route path="/calls" element={<CallsPage />} />
            <Route path="/organization" element={<OrganizationPage />} />
            <Route path="/billing" element={<BillingPage />} />
            <Route
              path="/organization/department/:departmentId"
              element={<DepartmentDetailPage />}
            />
            <Route path="/teams" element={<TeamsPage />} />
            <Route path="/admin" element={<AdminPage />} />
            <Route path="/notifications" element={<NotificationsPage />} />
            <Route path="/notification-settings" element={<NotificationSettingsPage />} />
            <Route path="/attendance" element={<AttendancePage />} />
            <Route path="/projects" element={<ProjectsPage />} />
            <Route
              path="/projects/:projectId"
              element={<ProjectDetailPage />}
            />
            <Route path="/messages" element={<MessagesPage />} />
            <Route
              path="/messages/:conversationId"
              element={<MessagesPage />}
            />
            <Route path="/wiki" element={<WikiPage />} />
            <Route
              path="/wiki/space/:spaceId"
              element={<WikiSpaceDetailPage />}
            />
            <Route
              path="/wiki/article/:articleId"
              element={<WikiArticleDetailPage />}
            />
            <Route path="/expenses" element={<ExpensesPage />} />
            <Route path="/fund-requests" element={<FundRequestsPage />} />
            <Route path="/finance-dashboard" element={<FinanceDashboardPage />} />
            <Route path="/finance-audit" element={<FinanceAuditPage />} />
            <Route path="/finance-settings" element={<FinanceSettingsPage />} />
            <Route path="/letters" element={<LettersPage />} />
            <Route path="/document-archive" element={<DocumentArchivePage />} />
            <Route path="/data-privacy" element={<DataPrivacyPage />} />
            <Route path="/travel" element={<TravelPage />} />
            <Route
              path="/travel/:requestId"
              element={<TravelDetailPage />}
            />
            <Route path="/onboarding" element={<OnboardingPage />} />
            <Route path="/training" element={<TrainingPage />} />
            <Route
              path="/training/path/:pathId"
              element={<LearningPathDetailPage />}
            />
            <Route
              path="/training/flashcards/:deckId"
              element={<FlashcardDeckDetailPage />}
            />
            <Route
              path="/training/:courseId"
              element={<CourseDetailPage />}
            />
            <Route path="/mentorship" element={<MentorshipPage />} />
            <Route
              path="/mentorship/group/:groupId"
              element={<PeerGroupDetailPage />}
            />
            <Route
              path="/mentorship/:mentorshipId"
              element={<MentorshipDetailPage />}
            />
            <Route path="/jobs" element={<JobsPage />} />
            <Route path="/jobs/:jobId" element={<JobDetailPage />} />
            <Route path="/performance" element={<PerformancePage />} />
            <Route
              path="/performance/:reviewId"
              element={<PerformanceDetailPage />}
            />
            <Route path="/news" element={<NewsPage />} />
            <Route path="/news/:newsId" element={<NewsDetailPage />} />
            <Route path="/assets" element={<AssetsPage />} />
            <Route path="/assets/:assetId" element={<AssetDetailPage />} />
            <Route path="/awards" element={<AwardsPage />} />
            <Route path="/awards/:awardId" element={<AwardDetailPage />} />
            <Route path="/reports" element={<ReportsPage />} />
            <Route path="/analytics" element={<AnalyticsPage />} />
            <Route path="/policies" element={<PoliciesPage />} />
            <Route path="/policies/:policyId" element={<PolicyDetailPage />} />
            <Route path="/payroll" element={<PayrollPage />} />
            <Route path="/recruitment" element={<RecruitmentPage />} />
            <Route path="/okr" element={<OkrPage />} />
            <Route path="/engagement" element={<EngagementPage />} />
            <Route path="/pulse" element={<PulsePage />} />
            <Route path="/feedback360" element={<Feedback360Page />} />
            <Route
              path="/feedback360/:cycleId"
              element={<Feedback360DetailPage />}
            />
            <Route path="/grading" element={<GradingPage />} />
            <Route
              path="/grading/:positionId"
              element={<GradingDetailPage />}
            />
            <Route path="/talent" element={<TalentPage />} />
            <Route path="/talent/:cycleId" element={<TalentDetailPage />} />
            <Route path="/offboarding" element={<OffboardingPage />} />
            <Route path="/events" element={<EventsPage />} />
            <Route path="/career-path" element={<CareerPathPage />} />
            <Route
              path="/career-path/:pathId"
              element={<CareerPathDetailPage />}
            />
            <Route
              path="/career-planning"
              element={<CareerPlanningPage />}
            />
            <Route path="/chatbot" element={<ChatbotPage />} />
            <Route path="/settings/users" element={<UserSettingsPage />} />
            <Route path="/qa-export" element={<QaExportPage />} />
            <Route path="/logo-download" element={<LogoDownloadPage />} />

            <Route path="/super-admin" element={<SuperAdminPage />} />
            <Route path="/super-admin/organizations" element={<OrganizationsManagementPage />} />
            <Route path="/membership-settings" element={<Navigate to="/super-admin?tab=plans" replace />} />
            <Route path="/promo-settings" element={<Navigate to="/super-admin?tab=promos" replace />} />
            <Route path="/membership-dashboard" element={<Navigate to="/super-admin?tab=monitoring" replace />} />
            <Route path="/profile/edit" element={<ProfileEditPage />} />
          </Route>
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
        </InstallGateGuard>
      </BrowserRouter>
    </DefaultProviders>
  );
}
