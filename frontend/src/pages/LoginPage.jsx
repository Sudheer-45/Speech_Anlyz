import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import './AuthPage.css';

function LoginPage() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [message, setMessage] = useState('');
    const [isError, setIsError] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const navigate = useNavigate();
    const { login } = useAuth();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setMessage('');
        setIsError(false);
        setIsSubmitting(true);

        try {
            const response = await axios.post('https://comm-analyzer.onrender.com/api/auth/login', {
                email,
                password,
            });
            const { token, user } = response.data;
            login(token, user);
            setMessage('Login successful! Redirecting...');
            setTimeout(() => navigate('/app'), 1500);
        } catch (error) {
            const errorMessage = error.response?.data?.message || 'Login failed. Please check your credentials.';
            setMessage(errorMessage);
            setIsError(true);
            console.error('Login Error:', error);
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
                        <h1 className="auth-heading">Welcome Back</h1>
                        <form onSubmit={handleSubmit} className="auth-form">
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
                                    <span className="button-loading">Logging In...</span>
                                ) : (
                                    'Login'
                                )}
                            </button>
                        </form>
                        {message && (
                            <p className={`auth-message ${isError ? 'error' : 'success'}`}>
                                {message}
                            </p>
                        )}
                        <p className="auth-link">
                            Don't have an account? <Link to="/signup">Sign Up</Link>
                        </p>
                    </div>
                </div>
            </div>
            <Footer />
        </div>
    );
}

export default LoginPage;
