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
// If it's loaded as a global script in your index.html, you might not need this import
// but using it via import is generally better practice for React.
import VanillaTilt from 'vanilla-tilt';


function App() {
    // State to control the visibility of the chatbot modal
    const [showChatbot, setShowChatbot] = useState(false);

    // Function to toggle the chatbot's visibility
    const toggleChatbot = () => {
        setShowChatbot(prev => !prev);
    };

    // useEffect hook to initialize VanillaTilt after the component mounts.
    // This is crucial for React, as direct DOM manipulation outside useEffect
    // can lead to unexpected behavior and is not recommended.
    useEffect(() => {
        // Ensure VanillaTilt is available before trying to initialize it.
        // This check helps prevent errors if VanillaTilt somehow fails to load.
        if (typeof VanillaTilt !== 'undefined' && VanillaTilt.init) {
            // Select all elements that have the 'data-tilt' attribute
            // and initialize VanillaTilt on them.
            document.querySelectorAll('[data-tilt]').forEach(element => {
                VanillaTilt.init(element, {
                    max: 15,     // Max tilt rotation in degrees
                    speed: 400,  // Speed of the tilt effect
                    glare: true, // Enable glare effect
                    'max-glare': 0.2, // Max glare opacity (0 to 1)
                    perspective: 1000, // Perspective value, lower values make the effect more pronounced
                });
            });
        } else {
            console.warn("VanillaTilt not found or not initialized. Make sure it's installed and imported correctly.");
        }

        // No cleanup function is explicitly needed for VanillaTilt.init
        // as it modifies elements directly and doesn't create subscriptions
        // that need to be torn down on unmount for this simple usage.
        // If elements with data-tilt are dynamically added/removed,
        // you might need more advanced setup or re-initialization.
    }, []); // Empty dependency array ensures this effect runs only once after the initial render

    return (
        <Router>
            <AuthProvider>
                {/* The main application container. 'relative' class is needed for the
                    'fixed' positioning of the chatbot button and modal to work correctly
                    relative to the viewport. */}
                <div className="App relative min-h-screen">
                    <Routes>
                        <Route path="/" element={<HomePage />} />
                        <Route path="/login" element={<LoginPage />} />
                        <Route path="/signup" element={<SignupPage />} />
                        <Route path="/about" element={<AboutPage />} />

                        {/* Protected Routes: These routes are only accessible if the user is authenticated.
                            The PrivateRoute component will handle the redirection if not authenticated. */}
                        <Route element={<PrivateRoute />}>
                            <Route path="/app" element={<MainApplication />} />
                            <Route path="/app/results" element={<ResultsPage />} />
                            <Route path="/app/dashboard" element={<DashboardPage />} />
                            <Route path="/app/profile" element={<ProfilePage />} />
                            <Route path="/profile/edit" element={<EditProfilePage />} />
                            <Route path="/app/tutor" element={<TutoringPage />} />
                        </Route>

                        {/* You might want to add a NotFoundPage for unmatched routes, e.g.:
                        <Route path="*" element={<NotFoundPage />} />
                        Make sure to create a NotFoundPage component if you add this. */}
                    </Routes>

                    {/* Floating Chatbot Icon:
                        This button is absolutely positioned at the bottom-right of the screen.
                        It's only visible when the chatbot is NOT shown. */}
                    {!showChatbot && (
                        <button
                            onClick={toggleChatbot}
                            className="fixed bottom-4 right-4 z-50 bg-blue-600 text-white rounded-full p-4 shadow-lg hover:bg-blue-700 transition-transform duration-300 ease-in-out transform hover:scale-110 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-75"
                            aria-label="Open Chatbot"
                        >
                            {/* SVG icon for the chat button. Lucide icons are simple and effective. */}
                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-message-circle">
                                <path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/>
                            </svg>
                        </button>
                    )}

                    {/* Chatbot Component:
                        Conditionally rendered based on 'showChatbot' state.
                        It receives 'isVisible' to control its own display and 'onClose' to allow
                        it to trigger the closing action from within the component. */}
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
