import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import './AuthPage.css';

function SignupPage() {
    const [username, setUsername] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [message, setMessage] = useState('');
    const [isError, setIsError] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setMessage('');
        setIsError(false);
        setIsSubmitting(true);

        try {
            const response = await axios.post('http://localhost:5000/api/auth/signup', {
                username,
                email,
                password,
            });
            
            setMessage(response.data.message || 'Registration successful! Redirecting to login...');
            setIsError(false);

            setTimeout(() => {
                navigate('/login');
            }, 500);

        } catch (error) {
            const errorMessage = error.response?.data?.message || 'Registration failed. Please try again.';
            setMessage(errorMessage);
            setIsError(true);
            console.error('Signup Error:', error);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="page-wrapper">
            <Navbar />
            <div className="auth-page-container">
                <div className="auth-form-wrapper" data-tilt>
                    <div className="auth-form-inner">
                        <h1 className="auth-heading">Create Account</h1>
                        <form onSubmit={handleSubmit} className="auth-form">
                            <div className="form-group">
                                <label htmlFor="username" className="form-label">Username</label>
                                <div className="input-container" data-tilt data-tilt-max="10" data-tilt-speed="200">
                                    <input
                                        type="text"
                                        id="username"
                                        className="form-input"
                                        value={username}
                                        onChange={(e) => setUsername(e.target.value)}
                                        required
                                        disabled={isSubmitting}
                                        placeholder="Enter your username"
                                    />
                                </div>
                            </div>
                            <div className="form-group">
                                <label htmlFor="email" className="form-label">Email</label>
                                <div className="input-container" data-tilt data-tilt-max="10" data-tilt-speed="200">
                                    <input
                                        type="email"
                                        id="email"
                                        className="form-input"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        required
                                        disabled={isSubmitting}
                                        placeholder="Enter your email"
                                    />
                                </div>
                            </div>
                            <div className="form-group">
                                <label htmlFor="password" className="form-label">Password</label>
                                <div className="input-container" data-tilt data-tilt-max="10" data-tilt-speed="200">
                                    <input
                                        type="password"
                                        id="password"
                                        className="form-input"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        required
                                        disabled={isSubmitting}
                                        placeholder="Enter your password"
                                    />
                                </div>
                            </div>
                            <button 
                                type="submit" 
                                className="auth-button" 
                                disabled={isSubmitting}
                                data-tilt data-tilt-max="15" data-tilt-speed="300"
                            >
                                {isSubmitting ? (
                                    <span className="button-loading">Signing Up...</span>
                                ) : (
                                    'Sign Up'
                                )}
                            </button>
                        </form>
                        {message && (
                            <p className={`auth-message ${isError ? 'error' : 'success'}`}>
                                {message}
                            </p>
                        )}
                        <p className="auth-link">
                            Already have an account? <Link to="/login">Login</Link>
                        </p>
                    </div>
                </div>
            </div>
            <Footer />
        </div>
    );
}

export default SignupPage;