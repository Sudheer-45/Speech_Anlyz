// frontend/src/pages/DashboardPage.jsx
import React, { useState, useEffect } from 'react';
import AuthenticatedNavbar from '../components/AuthenticatedNavbar';
import Footer from '../components/Footer';
import axios from 'axios';
import { useNavigate } from 'react-router-dom'; // Import useNavigate
import './DashboardPage.css'; // Ensure your CSS file is correctly linked

// Spinner component for loading state
const LoadingSpinner = () => (
    <div className="loading-overlay" aria-live="polite">
        <div className="spinner" data-tilt data-tilt-max="10"></div>
        <span className="sr-only">Loading content...</span>
    </div>
);

// IMPORTANT: Replace with your actual Render backend URL
// Ensure this environment variable is set in your frontend deployment environment (e.g., Vercel)
const RENDER_BACKEND_URL = process.env.REACT_APP_BACKEND_URL || "https://comm-analyzer.onrender.com";

function DashboardPage() {
    const [summaryData, setSummaryData] = useState(null);
    const [recentAnalyses, setRecentAnalyses] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const navigate = useNavigate(); // Initialize useNavigate hook

    useEffect(() => {
        const fetchDashboardData = async () => {
            const token = localStorage.getItem('token');
            if (!token) {
                setError('Please log in to view dashboard.');
                setLoading(false);
                navigate('/login'); // Redirect to login if not authenticated
                return;
            }

            try {
                // Fetch summary data
                const summaryResponse = await axios.get(`${RENDER_BACKEND_URL}/api/analysis/summary`, {
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                });
                setSummaryData(summaryResponse.data);
                console.log('Fetched dashboard summary:', summaryResponse.data);

                // Fetch recent analyses (e.g., last 5-10)
                const recentResponse = await axios.get(`${RENDER_BACKEND_URL}/api/analysis/recent`, {
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                });
                // Assuming recent response returns { recentAnalyses: [...] }
                setRecentAnalyses(recentResponse.data.recentAnalyses || []);
                console.log('Fetched recent analyses:', recentResponse.data);

                // Simulate a small delay for smoother loading transition if data loads too fast
                setTimeout(() => {
                    setLoading(false);
                }, 200);

            } catch (err) {
                console.error('Error fetching dashboard data:', err.response?.data?.message || err.message);
                setError(err.response?.data?.message || 'Failed to fetch dashboard data.');
                setLoading(false);
                // Redirect to login if it's an authentication/authorization error
                if (err.response && (err.response.status === 401 || err.response.status === 403)) {
                    navigate('/login');
                }
            }
        };
        fetchDashboardData();
    }, [navigate]); // Added navigate to dependency array

    if (loading) {
        return <LoadingSpinner />;
    }

    if (error) {
        return (
            <div className="dashboard-container">
                <AuthenticatedNavbar />
                <main className="dashboard-content">
                    <p className="error-message" data-tilt data-tilt-max="10">{error}</p>
                </main>
                <Footer />
            </div>
        );
    }

    // Determine if there's any data to show (beyond just an empty array)
    const hasAnyAnalysisData = summaryData && summaryData.totalVideos > 0;

    return (
        <div className="dashboard-container">
            <AuthenticatedNavbar />
            <main className="dashboard-content">
                <h1 className="dashboard-title" data-tilt data-tilt-max="10">Your Communication Dashboard</h1>

                {!hasAnyAnalysisData ? (
                    <div className="no-data-message" data-tilt data-tilt-max="10">
                        <p>It looks like you haven't analyzed any videos yet!</p>
                        <p>Upload or record your first video to see your communication insights here.</p>
                        <button onClick={() => navigate('/app')} className="start-analysis-button">
                            Start New Analysis
                        </button>
                    </div>
                ) : (
                    <>
                        <section className="summary-section">
                            <h2 data-tilt data-tilt-max="10">Overall Performance</h2>
                            <div className="summary-cards">
                                <div className="card" data-tilt data-tilt-max="10">
                                    <h3>Total Videos Analyzed</h3>
                                    <p className="metric">{summaryData.totalVideos}</p>
                                </div>
                                <div className="card" data-tilt data-tilt-max="10">
                                    <h3>Average Overall Score</h3>
                                    <p className="metric">{summaryData.averageOverallScore ? summaryData.averageOverallScore.toFixed(1) : 'N/A'}</p>
                                </div>
                                <div className="card" data-tilt data-tilt-max="10">
                                    <h3>Average Speaking Rate (WPM)</h3>
                                    <p className="metric">{summaryData.averageSpeakingRate ? summaryData.averageSpeakingRate.toFixed(1) : 'N/A'}</p>
                                </div>
                                <div className="card" data-tilt data-tilt-max="10">
                                    <h3>Most Common Filler Word</h3>
                                    <p className="metric">{summaryData.mostCommonFillerWord || 'None Identified'}</p>
                                </div>
                            </div>
                            <div className="overall-trends" data-tilt data-tilt-max="10">
                                <h3>Improvement Trends</h3>
                                <p>Overall score trend: <span className={summaryData.scoreTrend === 'improving' ? 'trend-up' : summaryData.scoreTrend === 'declining' ? 'trend-down' : 'trend-stable'}>
                                    {summaryData.scoreTrend === 'improving' ? '↑ Improving' : summaryData.scoreTrend === 'declining' ? '↓ Declining' : '→ Stable'}
                                </span></p>
                                <p>Speaking rate consistency: <span className={summaryData.speakingRateConsistency === 'consistent' ? 'trend-up' : 'trend-stable'}>
                                    {summaryData.speakingRateConsistency === 'consistent' ? '✓ Consistent' : 'Needs Focus'}
                                </span></p>
                                <p>Filler word reduction: <span className={summaryData.fillerWordTrend === 'reducing' ? 'trend-up' : 'trend-stable'}>
                                    {summaryData.fillerWordTrend === 'reducing' ? '↓ Reducing' : 'Needs Focus'}
                                </span></p>
                            </div>
                        </section>

                        <section className="recent-analyses-section">
                            <h2 data-tilt data-tilt-max="10">Your Recent Analyses</h2>
                            {recentAnalyses.length > 0 ? (
                                <div className="recent-analyses-grid">
                                    {recentAnalyses.map((analysis) => (
                                        <div key={analysis._id} className="analysis-card" data-tilt data-tilt-max="10" onClick={() => navigate(`/app/results/${analysis._id}`)}>
                                            <h3>{analysis.videoName}</h3>
                                            <p><strong>Date:</strong> {new Date(analysis.date).toLocaleDateString()}</p>
                                            <p><strong>Overall Score:</strong> {analysis.overallScore || 'N/A'}</p>
                                            <p><strong>Speaking Rate:</strong> {analysis.speakingRate ? analysis.speakingRate.toFixed(1) : 'N/A'} WPM</p>
                                            <p><strong>Filler Words:</strong> {analysis.fillerWords && analysis.fillerWords.length > 0 ? analysis.fillerWords.slice(0, 3).join(', ') + (analysis.fillerWords.length > 3 ? '...' : '') : 'None'}</p>
                                            <p><strong>Sentiment:</strong> {analysis.sentiment || 'N/A'}</p>
                                            <button className="view-details-button">View Details</button>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p className="no-recent-analyses">No recent analyses found. Upload a video to see your latest insights!</p>
                            )}
                        </section>
                    </>
                )}
            </main>
            <Footer />
        </div>
    );
}

export default DashboardPage;
