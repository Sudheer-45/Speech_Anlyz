// frontend/src/App.jsx
import React, { useEffect } from 'react'; // Removed useState as showChatbot is no longer needed
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

// Import VanillaTilt. This assumes you have 'vanilla-tilt' installed via npm/yarn.
import VanillaTilt from 'vanilla-tilt';


function App() {
    // Removed: const [showChatbot, setShowChatbot] = useState(false);
    // Removed: const toggleChatbot = () => { setShowChatbot(prev => !prev); };

    // useEffect hook to initialize VanillaTilt after the component mounts.
    useEffect(() => {
        if (typeof VanillaTilt !== 'undefined' && VanillaTilt.init) {
            document.querySelectorAll('[data-tilt]').forEach(element => {
                VanillaTilt.init(element, {
                    max: 15,     
                    speed: 400,  
                    glare: true, 
                    'max-glare': 0.2, 
                    perspective: 1000, 
                });
            });
        } else {
            console.warn("VanillaTilt not found or not initialized. Make sure it's installed and imported correctly.");
        }
    }, []); 

    return (
        <Router>
            <AuthProvider>
                {/* The main application container. 'relative' class is no longer strictly needed for chatbot,
                    but often good practice for overall layout if other elements might be absolutely positioned. */}
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
