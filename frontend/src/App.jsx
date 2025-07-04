// frontend/src/App.jsx
import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';

// Assuming your page components are directly inside 'src/pages/'
import HomePage from './pages/HomePage';
import LoginPage from './pages/LoginPage';
import SignupPage from './pages/SignupPage';
import AboutPage from './pages/AboutPage';
import DashboardPage from './pages/DashboardPage';
import ResultsPage from './pages/ResultsPage';
import EditProfilePage from './pages/EditProfilePage';
import ProfilePage from './pages/ProfilePage';
import MainApplication from './pages/MainApplication'; // After login

// Assuming your component is directly inside 'src/components/'
import PrivateRoute from './components/PrivateRoute'; // For protected routes

// Removed: import Chatbot from './components/Chatbot'; // Chatbot is removed

// Assuming AuthContext is in 'src/context/'
import { AuthProvider } from './context/AuthContext'; // Authentication context

import TutoringPage from './pages/TutoringPage';

// Removed: VanillaTilt import and initialization

function App() {
    // Removed: const [showChatbot, setShowChatbot] = useState(false);
    // Removed: const toggleChatbot = () => { setShowChatbot(prev => !prev); };

    // Removed: useEffect hook for VanillaTilt initialization

    return (
        <Router>
            <AuthProvider>
                <div className="App relative min-h-screen">
                    <Routes>
                        <Route path="/" element={<HomePage />} />
                        <Route path="/login" element={<LoginPage />} />
                        <Route path="/signup" element={<SignupPage />} />
                        <Route path="/about" element={<AboutPage />} />

                        <Route element={<PrivateRoute />}>
                            <Route path="/app" element={<MainApplication />} />
                            <Route path="/app/results" element={<ResultsPage />} />
                            <Route path="/app/dashboard" element={<DashboardPage />} />
                            <Route path="/app/profile" element={<ProfilePage />} />
                            <Route path="/profile/edit" element={<EditProfilePage />} />
                            <Route path="/app/tutor" element={<TutoringPage />} />
                        </Route>

                        {/* Optional: Add a catch-all route for 404 Not Found pages */}
                        {/* <Route path="*" element={<NotFoundPage />} /> */}
                    </Routes>

                    {/* Removed: Floating Chatbot Icon JSX */}
                    {/* Removed: Chatbot Component Rendering JSX */}
                </div>
            </AuthProvider>
        </Router>
    );
}

export default App;
