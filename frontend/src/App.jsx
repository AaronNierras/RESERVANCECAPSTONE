import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider, RoleRoute } from './context/AuthContext'
import { ActivityFactoryGuardProvider } from './context/ActivityFactoryGuardContext'
import { RealtimeProvider } from './context/RealtimeContext'
import AuthShell from './layouts/AuthShell'
import FacultyShell from './layouts/FacultyShell'
import StudentShell from './layouts/StudentShell'
import SuperAdminShell from './layouts/SuperAdminShell'
import LoginPage from './pages/LoginPage'
import MonitorPage from './pages/faculty/MonitorPage'
import FacultyStudentsPage from './pages/faculty/StudentsPage'
import ActivityFactoryPage from './pages/shared/ActivityFactoryPage'
import AnalyticsPage from './pages/shared/AnalyticsPage'
import TemplatesPage from './pages/shared/TemplatesPage'
import ActivitiesPage from './pages/student/ActivitiesPage'
import ActivityPlayerPage from './pages/student/ActivityPlayerPage'
import SimulationPlayerPage from './pages/student/SimulationPlayerPage'
import BadgesPage from './pages/student/BadgesPage'
import StudentHomePage from './pages/student/HomePage'
import HistoryPage from './pages/student/HistoryPage'
import LeaderboardsPage from './pages/student/LeaderboardsPage'
import ScoresPage from './pages/student/ScoresPage'
import TutorialPage from './pages/student/TutorialPage'
import DashboardPage from './pages/superadmin/DashboardPage'
import FacultyActivitiesPage from './pages/superadmin/FacultyActivitiesPage'
import SuperAdminFacultyPage from './pages/superadmin/FacultyPage'
import ProgramsPage from './pages/superadmin/ProgramsPage'
import SuperAdminStudentsPage from './pages/superadmin/StudentsPage'

function App() {
  return (
    <AuthProvider>
      <RealtimeProvider>
      <BrowserRouter>
        <ActivityFactoryGuardProvider>
        <Routes>
          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route element={<AuthShell />}>
            <Route path="/login" element={<LoginPage />} />
          </Route>

          <Route path="/superadmin" element={<RoleRoute roles={['super_admin']}><SuperAdminShell /></RoleRoute>}>
            <Route index element={<Navigate to="dashboard" replace />} />
            <Route path="dashboard" element={<DashboardPage />} />
            <Route path="students" element={<SuperAdminStudentsPage />} />
            <Route path="faculty" element={<SuperAdminFacultyPage />} />
            <Route path="programs" element={<ProgramsPage />} />
            <Route path="activities" element={<FacultyActivitiesPage />} />
            <Route path="activities-factory" element={<ActivityFactoryPage />} />
            <Route path="templates" element={<TemplatesPage />} />
            <Route path="analytics" element={<AnalyticsPage endpoint="/super-admin/analytics" />} />
          </Route>

          <Route path="/faculty" element={<RoleRoute roles={['faculty']}><FacultyShell /></RoleRoute>}>
            <Route index element={<Navigate to="students" replace />} />
            <Route path="students" element={<FacultyStudentsPage />} />
            <Route path="activities" element={<ActivityFactoryPage />} />
            <Route path="templates" element={<TemplatesPage />} />
            <Route path="analytics" element={<AnalyticsPage endpoint="/faculty/analytics" />} />
            <Route path="monitor" element={<MonitorPage />} />
          </Route>

          <Route path="/student" element={<RoleRoute roles={['student']}><StudentShell /></RoleRoute>}>
            <Route index element={<StudentHomePage />} />
            <Route path="activities" element={<ActivitiesPage />} />
            <Route path="history" element={<HistoryPage />} />
            <Route path="scores" element={<ScoresPage />} />
            <Route path="leaderboards" element={<LeaderboardsPage />} />
            <Route path="badges" element={<BadgesPage />} />
            <Route path="tutorial" element={<TutorialPage />} />
          </Route>

          <Route
            path="/student/activities/:id/play"
            element={<RoleRoute roles={['student']}><ActivityPlayerPage /></RoleRoute>}
          />

          <Route
            path="/student/activities/:id/simulate"
            element={<RoleRoute roles={['student']}><SimulationPlayerPage /></RoleRoute>}
          />

          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
        </ActivityFactoryGuardProvider>
      </BrowserRouter>
      </RealtimeProvider>
    </AuthProvider>
  )
}

export default App
