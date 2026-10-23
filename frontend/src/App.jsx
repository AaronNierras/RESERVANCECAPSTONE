import { createBrowserRouter, Navigate, Outlet, RouterProvider } from 'react-router-dom'
import { AuthProvider, RoleRoute } from './context/AuthContext'
import { ActivityFactoryGuardProvider } from './context/ActivityFactoryGuardContext'
import { RealtimeProvider } from './context/RealtimeContext'
import AuthShell from './layouts/AuthShell'
import FacultyShell from './layouts/FacultyShell'
import StudentShell from './layouts/StudentShell'
import SuperadminHomeShell from './layouts/SuperadminHomeShell'
import SuperAdminShell from './layouts/SuperAdminShell'
import ErrorBoundary from './components/ErrorBoundary'
import ErrorPopup from './components/ErrorPopup'
import LoginPage from './pages/LoginPage'
import AchievementsPage from './pages/shared/AchievementsPage'
import AccountHistoryPage from './pages/platform/HistoryPage'
import PlatformDashboardPage from './pages/platform/DashboardPage'
import PlatformErrorsPage from './pages/platform/ErrorsPage'
import PlatformFacultyPage from './pages/platform/FacultyPage'
import PlatformStudentsPage from './pages/platform/StudentsPage'
import RegistrationGatePage from './pages/superadmin/RegistrationGatePage'
import StudentLoginLeaveGuard from './components/StudentLoginLeaveGuard'
import FacultyStudentsPage from './pages/faculty/StudentsPage'
import ActivityFactoryPage from './pages/shared/ActivityFactoryPage'
import AnalyticsPage from './pages/shared/AnalyticsPage'
import TemplatesPage from './pages/shared/TemplatesPage'
import ActivitiesPage from './pages/student/ActivitiesPage'
import ActivityPlayerPage from './pages/student/ActivityPlayerPage'
import SimulationPlayerPage from './pages/student/SimulationPlayerPage'
import BadgesPage from './pages/student/BadgesPage'
import StudentHomePage from './pages/student/HomePage'
import StudentHistoryPage from './pages/student/HistoryPage'
import LeaderboardsPage from './pages/student/LeaderboardsPage'
import ScoresPage from './pages/student/ScoresPage'
import TutorialPage from './pages/student/TutorialPage'
import DashboardPage from './pages/superadmin/DashboardPage'
import FacultyActivitiesPage from './pages/superadmin/FacultyActivitiesPage'
import SuperAdminFacultyPage from './pages/superadmin/FacultyPage'
import ProgramsPage from './pages/superadmin/ProgramsPage'

/** Layout so StudentLoginLeaveGuard runs inside a data router (required for useBlocker). */
function AppLayout() {
  return (
    <ActivityFactoryGuardProvider>
      <StudentLoginLeaveGuard />
      <Outlet />
    </ActivityFactoryGuardProvider>
  )
}

const router = createBrowserRouter([
  {
    element: <AppLayout />,
    children: [
      { path: '/', element: <Navigate to="/login" replace /> },
      {
        element: <AuthShell />,
        children: [
          { path: '/login', element: <LoginPage /> },
        ],
      },
      {
        path: '/program-chair',
        element: <RoleRoute roles={['program_chair']}><SuperAdminShell /></RoleRoute>,
        children: [
          { index: true, element: <Navigate to="dashboard" replace /> },
          { path: 'dashboard', element: <DashboardPage /> },
          { path: 'faculty', element: <SuperAdminFacultyPage /> },
          { path: 'programs', element: <ProgramsPage /> },
          { path: 'students', element: <Navigate to="/program-chair/dashboard" replace /> },
          { path: 'activities', element: <FacultyActivitiesPage /> },
          { path: 'activities-factory', element: <ActivityFactoryPage /> },
          { path: 'templates', element: <TemplatesPage /> },
          { path: 'analytics', element: <AnalyticsPage endpoint="/super-admin/analytics" /> },
          { path: 'lab-rubric', element: <Navigate to="/program-chair/analytics" replace /> },
          { path: 'registration', element: <RegistrationGatePage /> },
          { path: 'history', element: <AccountHistoryPage endpoint="/super-admin/history" title="Recent activity" description="Actions recorded for the Program Chair account." /> },
          { path: 'achievements', element: <AchievementsPage endpoint="/super-admin/achievements" printable /> },
        ],
      },
      {
        path: '/superadmin',
        element: <RoleRoute roles={['super_admin']}><SuperadminHomeShell /></RoleRoute>,
        children: [
          { index: true, element: <PlatformDashboardPage /> },
          { path: 'students', element: <PlatformStudentsPage /> },
          { path: 'faculty', element: <PlatformFacultyPage /> },
          { path: 'history', element: <AccountHistoryPage endpoint="/platform/history" title="History" description="Superadmin history, with Program Chair and Faculty history in the same list." allowRoleFilter /> },
          { path: 'errors', element: <PlatformErrorsPage /> },
        ],
      },
      {
        path: '/faculty',
        element: <RoleRoute roles={['faculty']}><FacultyShell /></RoleRoute>,
        children: [
          { index: true, element: <Navigate to="students" replace /> },
          { path: 'students', element: <FacultyStudentsPage /> },
          { path: 'activities', element: <ActivityFactoryPage /> },
          { path: 'lab-rubric', element: <Navigate to="/faculty/students" replace /> },
          { path: 'achievements', element: <AchievementsPage endpoint="/faculty/achievements" /> },
        ],
      },
      {
        path: '/student',
        element: <RoleRoute roles={['student']}><StudentShell /></RoleRoute>,
        children: [
          { index: true, element: <StudentHomePage /> },
          { path: 'activities', element: <ActivitiesPage /> },
          { path: 'history', element: <StudentHistoryPage /> },
          { path: 'scores', element: <ScoresPage /> },
          { path: 'lab-rubric', element: <Navigate to="/student/scores" replace /> },
          { path: 'leaderboards', element: <LeaderboardsPage /> },
          { path: 'badges', element: <BadgesPage /> },
          { path: 'tutorial', element: <TutorialPage /> },
        ],
      },
      {
        path: '/student/activities/:id/play',
        element: <RoleRoute roles={['student']}><ActivityPlayerPage /></RoleRoute>,
      },
      {
        path: '/student/activities/:id/simulate',
        element: <RoleRoute roles={['student']}><SimulationPlayerPage /></RoleRoute>,
      },
      { path: '*', element: <Navigate to="/login" replace /> },
    ],
  },
])

function App() {
  return (
    <AuthProvider>
      <RealtimeProvider>
        <ErrorBoundary>
          <ErrorPopup />
          <RouterProvider router={router} />
        </ErrorBoundary>
      </RealtimeProvider>
    </AuthProvider>
  )
}

export default App
