import React, { useState, useEffect } from 'react';
import AuthenticatedNavbar from '../components/AuthenticatedNavbar';
import Footer from '../components/Footer';
import axios from 'axios';
import './DashboardPage.css';

// Spinner component for loading state
const LoadingSpinner = () => (
  <div className="loading-overlay" aria-live="polite">
    <div className="spinner" data-tilt data-tilt-max="10"></div>
    <span className="sr-only">Loading content...</span>
  </div>
);

function DashboardPage() {
  const [dashboardData, setDashboardData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        const token = localStorage.getItem('token');
        if (!token) {
          setError('Please log in to view dashboard.');
          setLoading(false);
          return;
        }
        const response = await axios.get('http://localhost:5000/api/user/dashboard', {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        setDashboardData(response.data);
        setTimeout(() => {
          setLoading(false);
        }, 200);
      } catch (err) {
        setError(err.response?.data?.message || 'Failed to fetch dashboard data.');
        setLoading(false);
      }
    };
    fetchDashboardData();
  }, []);

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

  return (
    <div className="dashboard-container">
      <AuthenticatedNavbar />
      <main className="dashboard-content">
        <h1 data-tilt data-tilt-max="10">Your Dashboard</h1>
        {dashboardData ? (
          <div className="dashboard-grid">
            <div className="dashboard-card" data-tilt data-tilt-max="10">
              <h3>Total Videos Analyzed</h3>
              <p>{dashboardData.totalVideosAnalyzed}</p>
            </div>
            <div className="dashboard-card" data-tilt data-tilt-max="10">
              <h3>Average Overall Score</h3>
              <p>{dashboardData.averageOverallScore ? dashboardData.averageOverallScore.toFixed(2) : 'N/A'}</p>
            </div>
            <div className="dashboard-card" data-tilt data-tilt-max="10">
              <h3>Latest Analysis Date</h3>
              <p>{dashboardData.latestAnalysisDate ? new Date(dashboardData.latestAnalysisDate).toLocaleDateString() : 'N/A'}</p>
            </div>
            <div className="dashboard-card full-width" data-tilt data-tilt-max="10">
              <h3>Recent Feedback Highlights</h3>
              {dashboardData.recentFeedback && dashboardData.recentFeedback.length > 0 ? (
                <ul>
                  {dashboardData.recentFeedback.map((feedback, index) => (
                    <li key={index} data-tilt data-tilt-max="5">
                      <p><strong>Grammar:</strong> {feedback.grammarFeedback}</p>
                      <p><strong>Fluency:</strong> {feedback.fluencyFeedback}</p>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="no-feedback">No recent feedback available.</p>
              )}
            </div>
          </div>
        ) : (
          <p className="no-data" data-tilt data-tilt-max="10">No dashboard data available yet.</p>
        )}
      </main>
      <Footer />
    </div>
  );
}

export default DashboardPage;