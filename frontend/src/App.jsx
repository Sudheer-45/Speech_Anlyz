// frontend/src/App.jsx
import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
// Corrected import paths: changed './pages/' to '../pages/' and './components/' to '../components/'
import Login from '../pages/Login';
import Register from '../pages/Register';
import MainApplication from '../pages/MainApplication';
import Dashboard from '../pages/Dashboard';
import AnalysisResults from '../pages/AnalysisResults';
import Profile from '../pages/Profile';
import ChangePassword from '../pages/ChangePassword';
import NotFound from '../pages/NotFound'; // Assuming you have a NotFound component
import Feedback from '../pages/Feedback';
import AdminDashboard from '../pages/AdminDashboard';
import ResetPassword from '../pages/ResetPassword';
import ForgotPassword from '../pages/ForgotPassword';
import PersonalDevelopmentHub from '../pages/PersonalDevelopmentHub';
import Chatbot from '../components/Chatbot'; // Corrected import for Chatbot component

// Helper component for protected routes
const ProtectedRoute = ({ children, allowedRoles }) => {
    const isAuthenticated = localStorage.getItem('token');
    const userRole = localStorage.getItem('role'); // Assuming you store role in localStorage

    if (!isAuthenticated) {
        return <Navigate to="/login" replace />;
    }

    if (allowedRoles && !allowedRoles.includes(userRole)) {
        return <Navigate to="/unauthorized" replace />; // Redirect to an unauthorized page if roles don't match
    }

    return children;
};

// Component for unauthorized access (you might want to create a dedicated page for this)
const Unauthorized = () => (
    <div className="flex items-center justify-center min-h-screen bg-gray-100">
        <div className="text-center p-8 bg-white rounded-lg shadow-md">
            <h1 className="text-4xl font-bold text-red-600 mb-4">403 - Unauthorized Access</h1>
            <p className="text-gray-700 mb-6">You do not have permission to view this page.</p>
            <button
                onClick={() => window.history.back()}
                className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition duration-200"
            >
                Go Back
            </button>
        </div>
    </div>
);

function App() {
    const [showChatbot, setShowChatbot] = useState(false); // State to control chatbot visibility

    const toggleChatbot = () => {
        setShowChatbot(!showChatbot);
    };

    return (
        <Router>
            <div className="App relative min-h-screen"> {/* Added relative for fixed positioning of chatbot */}
                <Routes>
                    <Route path="/login" element={<Login />} />
                    <Route path="/register" element={<Register />} />
                    <Route path="/forgot-password" element={<ForgotPassword />} />
                    <Route path="/reset-password/:token" element={<ResetPassword />} />
                    <Route path="/unauthorized" element={<Unauthorized />} />

                    {/* Protected Routes */}
                    <Route
                        path="/app"
                        element={
                            <ProtectedRoute allowedRoles={['user', 'admin']}>
                                <MainApplication />
                            </ProtectedRoute>
                        }
                    />
                    <Route
                        path="/app/dashboard"
                        element={
                            <ProtectedRoute allowedRoles={['user', 'admin']}>
                                <Dashboard />
                            </ProtectedRoute>
                        }
                    />
                    <Route
                        path="/app/results"
                        element={
                            <ProtectedRoute allowedRoles={['user', 'admin']}>
                                <AnalysisResults />
                            </ProtectedRoute>
                        }
                    />
                    <Route
                        path="/app/profile"
                        element={
                            <ProtectedRoute allowedRoles={['user', 'admin']}>
                                <Profile />
                            </ProtectedRoute>
                        }
                    />
                     <Route
                        path="/app/change-password"
                        element={
                            <ProtectedRoute allowedRoles={['user', 'admin']}>
                                <ChangePassword />
                            </ProtectedRoute>
                        }
                    />
                     <Route
                        path="/app/feedback"
                        element={
                            <ProtectedRoute allowedRoles={['user', 'admin']}>
                                <Feedback />
                            </ProtectedRoute>
                        }
                    />
                    <Route
                        path="/app/personal-development-hub"
                        element={
                            <ProtectedRoute allowedRoles={['user', 'admin']}>
                                <PersonalDevelopmentHub />
                            </ProtectedRoute>
                        }
                    />
                    {/* Admin Specific Route */}
                    <Route
                        path="/admin/dashboard"
                        element={
                            <ProtectedRoute allowedRoles={['admin']}>
                                <AdminDashboard />
                            </ProtectedRoute>
                        }
                    />

                    {/* Default redirect for root path */}
                    <Route path="/" element={<Navigate to="/login" replace />} />

                    {/* Catch-all for undefined routes */}
                    <Route path="*" element={<NotFound />} />
                </Routes>

                {/* Floating Chatbot Icon */}
                {!showChatbot && ( // Only show icon if chatbot is closed
                    <button
                        onClick={toggleChatbot}
                        className="fixed bottom-4 right-4 z-50 bg-blue-600 text-white rounded-full p-4 shadow-lg hover:bg-blue-700 transition-transform duration-300 ease-in-out transform hover:scale-110 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-75"
                        aria-label="Open Chatbot"
                    >
                        {/* Using a simple SVG icon for the chat button */}
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-message-circle">
                            <path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/>
                        </svg>
                    </button>
                )}

                {/* Chatbot Component (conditionally rendered and positioned) */}
                <Chatbot 
                    isVisible={showChatbot} 
                    onClose={toggleChatbot} 
                />
            </div>
        </Router>
    );
}

export default App;
