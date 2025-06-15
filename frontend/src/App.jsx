// frontend/src/App.jsx
import React, { useState, useEffect } from 'react';
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
import Chatbot from './components/Chatbot'; // Import the Chatbot component

// Assuming AuthContext is in 'src/context/'
import { AuthProvider } from './context/AuthContext'; // Authentication context

import TutoringPage from './pages/TutoringPage';

// Import VanillaTilt. This assumes you have 'vanilla-tilt' installed via npm/yarn.
import VanillaTilt from 'vanilla-tilt';


function App() {
    // State to control the visibility of the chatbot modal
    const [showChatbot, setShowChatbot] = useState(false);

    // Function to toggle the chatbot's visibility
    const toggleChatbot = () => {
        setShowChatbot(prev => !prev);
    };

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
                {/* The main application container. 'relative' class is crucial if
                    any child needs absolute positioning relative to this parent.
                    'min-h-screen' ensures it takes at least the full viewport height. */}
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

                    {/* Floating Chatbot Icon:
                        - 'fixed': Positions the element relative to the viewport.
                        - 'bottom-4 right-4': Places it 1rem (16px) from the bottom and right edges.
                        - 'z-50': Sets a high z-index to ensure it stacks above most other content.
                        - Only shown if 'showChatbot' is false (chatbot is closed). */}
                    {!showChatbot && ( 
                        <button
                            onClick={toggleChatbot}
                            className="fixed bottom-4 right-4 z-50 bg-blue-600 text-white rounded-full p-4 shadow-lg hover:bg-blue-700 transition-transform duration-300 ease-in-out transform hover:scale-110 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-75"
                            aria-label="Open Chatbot"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-message-circle">
                                <path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/>
                            </svg>
                        </button>
                    )}

                    {/* Chatbot Component (Modal):
                        - 'isVisible': Controls the Chatbot component's internal rendering.
                        - 'onClose': Callback to toggle the 'showChatbot' state in App.jsx.
                        - This component also uses 'fixed' positioning and 'z-50' internally
                          to float above other content when visible. */}
                    <Chatbot 
                        isVisible={showChatbot} 
                        onClose={toggleChatbot} 
                    />
                </div>
            </AuthProvider>
        </Router>
    );
}

export default App;
