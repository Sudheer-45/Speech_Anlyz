import React from 'react';

import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import HomePage from './pages/HomePage';
import LoginPage from './pages/LoginPage';
import SignupPage from './pages/SignupPage';
import AboutPage from './pages/AboutPage';
import DashboardPage from './pages/DashboardPage';
import ResultsPage from './pages/ResultsPage';
import EditProfilePage from './pages/EditProfilePage';
import ProfilePage from './pages/ProfilePage';
import MainApplication from './pages/MainApplication'; // After login
import PrivateRoute from './components/PrivateRoute'; // For protected routes
import { AuthProvider } from './context/AuthContext'; // Authentication context
import TutoringPage from './pages/TutoringPage';
import VanillaTilt from 'vanilla-tilt';

function App() {

  document.querySelectorAll('[data-tilt]').forEach(element => {
    VanillaTilt.init(element, {
        max: 15,
        speed: 400,
        glare: true,
        'max-glare': 0.2,
        perspective: 1000,
    });
});
    
  return (
    <Router>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignupPage />} />
          <Route path="/about" element={<AboutPage />} />

          {/* Protected Routes */}

          <Route element={<PrivateRoute />}>
            <Route path="/app" element={<MainApplication />} />
            <Route path="/app/results" element={<ResultsPage />} />
            <Route path="/app/dashboard" element={<DashboardPage />} />
            <Route path="/app/profile" element={<ProfilePage />} />
            <Route path="/profile/edit" element={<EditProfilePage />} />
            <Route path="/app/tutor" element={<TutoringPage/>}/>
          </Route>
        </Routes>
      </AuthProvider>
    </Router>
  );
}
export default App;
