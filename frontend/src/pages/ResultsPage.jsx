import React, { useState, useEffect } from 'react';
import AuthenticatedNavbar from '../components/AuthenticatedNavbar';
import Footer from '../components/Footer';
import axios from 'axios';
import './ResultsPage.css';

// Spinner component for loading state
const LoadingSpinner = () => (
  <div className="loading-overlay" aria-live="polite">
    <div className="spinner" data-tilt data-tilt-max="10"></div>
    <span className="sr-only">Loading content...</span>
  </div>
);

function ResultsPage() {
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedAnalysis, setSelectedAnalysis] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    const fetchResults = async () => {
      try {
        const token = localStorage.getItem('token');
        if (!token) {
          setError('Please log in to view results.');
          setLoading(false);
          return;
        }

        const response = await axios.get('https://comm-analyzer.onrender.com/api/analysis/my-analyses', {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        setResults(response.data);
        setTimeout(() => {
          setLoading(false);
        }, 200);
      } catch (err) {
        setError(err.response?.data?.message || 'Failed to fetch analysis results.');
        setLoading(false);
        console.error('Fetch Results Error:', err);
      }
    };

    fetchResults();
  }, []);

  const handleDelete = async (analysisId) => {
    if (window.confirm('Are you sure you want to delete this analysis?')) {
      try {
        const token = localStorage.getItem('token');
        await axios.delete(`http://localhost:5000/api/analysis/${analysisId}`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        setResults(results.filter(analysis => analysis._id !== analysisId));
        alert('Analysis deleted successfully!');
      } catch (err) {
        alert(err.response?.data?.message || 'Failed to delete analysis.');
        console.error('Delete Error:', err);
      }
    }
  };

  const handleViewMore = (analysis) => {
    setSelectedAnalysis(analysis);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setSelectedAnalysis(null);
  };

  if (loading) {
    return <LoadingSpinner />;
  }

  if (error) {
    return (
      <div className="results-page-container">
        <AuthenticatedNavbar />
        <main className="results-content">
          <p className="error-message" data-tilt data-tilt-max="10">{error}</p>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="results-page-container">
      <AuthenticatedNavbar />
      <main className="results-content">
        <h1 data-tilt data-tilt-max="10">Your Analysis Results</h1>
        {results.length === 0 ? (
          <p className="no-results" data-tilt data-tilt-max="10">No analysis results found. Upload a video to get started!</p>
        ) : (
          <div className="results-grid">
            {results.map((analysis) => (
              <div key={analysis._id} className="analysis-card" data-tilt data-tilt-max="10">
                <h2>{analysis.videoName || `Analysis ${analysis._id.substring(analysis._id.length - 4)}`}</h2>
                <p><strong>Date:</strong> {new Date(analysis.date).toLocaleDateString()}</p>
                <p><strong>Overall Score:</strong> {analysis.overallScore || 'N/A'}</p>
                <div className="card-actions">
                  <button
                    onClick={() => handleViewMore(analysis)}
                    className="view-more-btn"
                    data-tilt
                    data-tilt-max="10"
                    aria-label={`View details for ${analysis.videoName || 'analysis'}`}
                  >
                    View More
                  </button>
                  <button
                    onClick={() => handleDelete(analysis._id)}
                    className="delete-btn"
                    data-tilt
                    data-tilt-max="10"
                    aria-label={`Delete ${analysis.videoName || 'analysis'}`}
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {isModalOpen && selectedAnalysis && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal-content" onClick={e => e.stopPropagation()} data-tilt data-tilt-max="10">
            <span
              className="close-button"
              onClick={closeModal}
              aria-label="Close modal"
              role="button"
              tabIndex={0}
              onKeyDown={(e) => e.key === 'Enter' && closeModal()}
            >
              ×
            </span>
            <h2>{selectedAnalysis.videoName || `Analysis ${selectedAnalysis._id.substring(selectedAnalysis._id.length - 4)}`}</h2>
            
            {selectedAnalysis.videoUrl && (
              <div className="modal-video-container" data-tilt data-tilt-max="10">
                <video controls src={selectedAnalysis.videoUrl} className="analysis-video">
                  Your browser does not support the video tag.
                </video>
              </div>
            )}

            <div className="analysis-details">
              <h3>Summary</h3>
              <p><strong>Date:</strong> {new Date(selectedAnalysis.date).toLocaleDateString()}</p>
              <p><strong>Overall Score:</strong> {selectedAnalysis.overallScore || 'N/A'}</p>
              <p><strong>Filler Words:</strong> {selectedAnalysis.fillerWords?.join(', ') || 'None'}</p>
              <p><strong>Speaking Rate:</strong> {selectedAnalysis.speakingRate || 'N/A'} words/minute</p>
              
              <h3>Grammar Insights</h3>
              {selectedAnalysis.grammarErrors && selectedAnalysis.grammarErrors.length > 0 ? (
                <ul>
                  {selectedAnalysis.grammarErrors.map((error, index) => (
                    <li key={index}>
                      <strong>Error:</strong> {error.message} - <em>{error.text}</em>
                    </li>
                  ))}
                </ul>
              ) : (
                <p>No significant grammar errors detected.</p>
              )}

              <h3>Fluency and Pacing</h3>
              <p>{selectedAnalysis.fluencyFeedback || 'No specific fluency feedback available.'}</p>
              
              <h3>Sentiment Analysis</h3>
              <p>Overall sentiment: {selectedAnalysis.sentiment || 'N/A'}</p>
            </div>
            <button
              onClick={closeModal}
              className="modal-close-btn"
              data-tilt
              data-tilt-max="10"
              aria-label="Close detailed analysis"
            >
              Close
            </button>
          </div>
        </div>
      )}
      <Footer />
    </div>
  );
}

export default ResultsPage;
