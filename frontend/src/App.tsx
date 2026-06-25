import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from './contexts/ThemeContext';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ProtectedRoute } from './routes/ProtectedRoute';
import { RoleRoute } from './routes/RoleRoute';
import { DashboardLayout } from './layouts/DashboardLayout';

// Pages
import { Login } from './pages/Login';
import { Register } from './pages/Register';
import { Dashboard } from './pages/Dashboard';
import { Insights } from './pages/Insights';
import { JobsList } from './pages/JobsList';
import { JobDetail } from './pages/JobDetail';
import { UploadResume } from './pages/UploadResume';
import { MyResumes } from './pages/MyResumes';
import { AllResumes } from './pages/AllResumes';
import { ResumeScoreDetail } from './pages/ResumeScoreDetail';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

// Root path director that routes users based on their role after login
const RootRedirect: React.FC = () => {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  return user.role === 'recruiter' ? (
    <Navigate to="/dashboard" replace />
  ) : (
    <Navigate to="/my-resumes" replace />
  );
};

const App: React.FC = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AuthProvider>
          <BrowserRouter>
            <Routes>
              {/* Public Routes */}
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />

              {/* Protected Routes */}
              <Route element={<ProtectedRoute />}>
                <Route element={<DashboardLayout />}>
                  {/* Shared Role Routes */}
                  <Route element={<RoleRoute allowedRoles={['recruiter', 'candidate']} />}>
                    <Route path="/" element={<RootRedirect />} />
                    <Route path="/jobs" element={<JobsList />} />
                    <Route path="/jobs/:jobId" element={<JobDetail />} />
                    <Route path="/resumes/:resumeId" element={<ResumeScoreDetail />} />
                    <Route path="/resumes/:resumeId/job/:jobId" element={<ResumeScoreDetail />} />
                  </Route>

                  {/* Recruiter Only Routes */}
                  <Route element={<RoleRoute allowedRoles={['recruiter']} />}>
                    <Route path="/dashboard" element={<Dashboard />} />
                    <Route path="/insights" element={<Insights />} />
                    <Route path="/all-resumes" element={<AllResumes />} />
                  </Route>

                  {/* Candidate Only Routes */}
                  <Route element={<RoleRoute allowedRoles={['candidate']} />}>
                    <Route path="/upload" element={<UploadResume />} />
                    <Route path="/my-resumes" element={<MyResumes />} />
                  </Route>
                </Route>
              </Route>

              {/* Wildcard Fallback */}
              <Route path="*" element={<Navigate to="/login" replace />} />
            </Routes>
          </BrowserRouter>
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
};

export default App;
