import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import AuthenticatedNavbar from '../components/AuthenticatedNavbar';
import Footer from '../components/Footer';
import axios from 'axios';
import './ResultsPage.css';

const RENDER_BACKEND_URL = "https://comm-analyzer.onrender.com";

// --- Custom Components ---
const VideoPlayer = ({ src, title, className = '', onError }) => {
  const videoRef = useRef(null);

  useEffect(() => {
    const video = videoRef.current;
    return () => {
      if (video) {
        video.pause();
        video.removeAttribute('src');
        video.load();
      }
    };
  }, [src]);

  if (!src) {
    return <p className="text-center text-gray-500">Video preview not available</p>;
  }

  return (
    <div className={`video-player-container ${className}`}>
      <video
        ref={videoRef}
        controls
        src={src}
        className="analysis-video w-full"
        aria-label={`Video: ${title || 'Analysis video'}`}
        onError={onError}
      >
        Your browser does not support the video tag.
        <track kind="captions" src="" default />
      </video>
    </div>
  );
};

const ErrorDisplay = ({ error, onRetry }) => (
  <div className="error-display">
    <p className="text-red-500">{error}</p>
    {onRetry && (
      <button 
        onClick={onRetry}
        className="retry-btn"
      >
        Retry
      </button>
    )}
  </div>
);

const LoadingSpinner = () => (
  <div className="loading-overlay" aria-live="polite">
    <div className="spinner" data-tilt data-tilt-max="10"></div>
    <span className="sr-only">Loading content...</span>
  </div>
);

const AnalysisCard = React.memo(({ analysis, onViewMore, onDelete }) => (
  <div className="analysis-card" data-tilt data-tilt-max="10">
    <h2>{analysis.videoName || `Analysis ${analysis._id.substring(analysis._id.length - 4)}`}</h2>
    <p><strong>Date:</strong> {new Date(analysis.date).toLocaleDateString()}</p>
    <p><strong>Overall Score:</strong> {analysis.overallScore || 'N/A'}</p>
    <div className="card-actions">
      <button
        onClick={() => onViewMore(analysis)}
        className="view-more-btn"
        aria-label={`View details for ${analysis.videoName || 'analysis'}`}
      >
        View More
      </button>
      <button
        onClick={() => onDelete(analysis)}
        className="delete-btn"
        aria-label={`Delete ${analysis.videoName || 'analysis'}`}
      >
        Delete
      </button>
    </div>
  </div>
));

const ConfirmationModal = ({ message, onConfirm, onCancel }) => (
  <div className="modal-overlay-custom" onClick={onCancel}>
    <div className="modal-content-custom" onClick={e => e.stopPropagation()}>
      <h3>Confirm Action</h3>
      <p>{message}</p>
      <div className="modal-actions-custom">
        <button className="modal-button-confirm" onClick={onConfirm}>Yes</button>
        <button className="modal-button-cancel" onClick={onCancel}>No</button>
      </div>
    </div>
  </div>
);

const AlertModal = ({ message, onClose }) => (
  <div className="modal-overlay-custom" onClick={onClose}>
    <div className="modal-content-custom" onClick={e => e.stopPropagation()}>
      <h3>Notification</h3>
      <p>{message}</p>
      <div className="modal-actions-custom">
        <button className="modal-button-ok" onClick={onClose}>OK</button>
      </div>
    </div>
  </div>
);

function ResultsPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const isMounted = useRef(true);

  // State management
  const [results, setResults] = useState([]);
  const [videoState, setVideoState] = useState({
    currentAnalysis: null,
    videoUrl: null,
    videoName: null,
    status: 'idle',
    message: '',
    error: null
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [analysisToDelete, setAnalysisToDelete] = useState(null);
  const [alertMessage, setAlertMessage] = useState('');
  const [selectedAnalysisInModal, setSelectedAnalysisInModal] = useState(null);

  // Modal states
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [isAlertOpen, setIsAlertOpen] = useState(false);
  const [isViewMoreModalOpen, setIsViewMoreModalOpen] = useState(false);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isMounted.current = false;
      if (videoState.videoUrl && videoState.videoUrl.startsWith('blob:')) {
        URL.revokeObjectURL(videoState.videoUrl);
      }
    };
  }, [videoState.videoUrl]);

  const fetchAllAnalyses = useCallback(async (token) => {
    try {
      setLoading(true);
      setError('');
      const response = await axios.get(`${RENDER_BACKEND_URL}/api/analysis/my-analyses`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (isMounted.current) {
        setResults(response.data);
        setLoading(false);
      }
    } catch (err) {
      if (isMounted.current) {
        setError(err.response?.data?.message || 'Failed to fetch analysis results.');
        setLoading(false);
      }
      console.error('Fetch All Results Error:', err);
    }
  }, []);

  const pollForAnalysis = useCallback(async (recordId, token) => {
    const poll = async () => {
      try {
        const response = await axios.get(`${RENDER_BACKEND_URL}/api/user/videos`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        
        const video = response.data.videos.find(v => v._id === recordId);
        
        if (!video) {
          throw new Error('Video record not found');
        }

        switch (video.status) {
          case 'analyzed':
            const analysisRes = await axios.get(`${RENDER_BACKEND_URL}/api/analysis/${video.analysisId}`, {
              headers: { 'Authorization': `Bearer ${token}` }
            });
            return { done: true, data: analysisRes.data, video };
          
          case 'failed':
            throw new Error(video.errorMessage || 'Analysis failed');
          
          default:
            return { done: false, status: video.status };
        }
      } catch (error) {
        throw error;
      }
    };

    const pollInterval = setInterval(async () => {
      if (!isMounted.current) {
        clearInterval(pollInterval);
        return;
      }

      try {
        const result = await poll();
        if (result.done) {
          clearInterval(pollInterval);
          setVideoState({
            currentAnalysis: result.data,
            videoUrl: result.video.videoUrl,
            videoName: result.video.videoName,
            status: 'success',
            message: 'Analysis complete!'
          });
          fetchAllAnalyses(token);
        } else {
          setVideoState(prev => ({
            ...prev,
            status: 'loading',
            message: `Status: ${result.status}...`
          }));
        }
      } catch (error) {
        clearInterval(pollInterval);
        setVideoState(prev => ({
          ...prev,
          status: 'error',
          error: error.message
        }));
      }
    }, 5000);

    return () => clearInterval(pollInterval);
  }, [fetchAllAnalyses]);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      setError('Please log in to view results.');
      setLoading(false);
      return;
    }

    const { videoRecordId, videoUrl, videoName } = location.state || {};
    
    if (videoRecordId && videoUrl) {
      setVideoState({
        currentAnalysis: null,
        videoUrl,
        videoName,
        status: 'loading',
        message: 'Starting analysis for your video...',
        error: null
      });
      setLoading(false);
      pollForAnalysis(videoRecordId, token);
    } else {
      fetchAllAnalyses(token);
    }
  }, [location.state, navigate, pollForAnalysis, fetchAllAnalyses]);

  const handleDeleteClick = (analysis) => {
    setAnalysisToDelete(analysis);
    setIsDeleteConfirmOpen(true);
  };

  const confirmDelete = async () => {
    setIsDeleteConfirmOpen(false);
    if (!analysisToDelete) return;

    try {
      const token = localStorage.getItem('token');
      await axios.delete(`${RENDER_BACKEND_URL}/api/analysis/${analysisToDelete._id}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (isMounted.current) {
        setResults(results.filter(analysis => analysis._id !== analysisToDelete._id));
        setAlertMessage('Analysis deleted successfully!');
        setIsAlertOpen(true);
        setAnalysisToDelete(null);

        if (videoState.currentAnalysis && videoState.currentAnalysis._id === analysisToDelete._id) {
          setVideoState({
            currentAnalysis: null,
            videoUrl: null,
            videoName: null,
            status: 'idle',
            message: '',
            error: null
          });
          fetchAllAnalyses(token);
        }
      }
    } catch (err) {
      if (isMounted.current) {
        setAlertMessage(err.response?.data?.message || 'Failed to delete analysis.');
        setIsAlertOpen(true);
      }
      console.error('Delete Error:', err);
    }
  };

  const cancelDelete = () => {
    setIsDeleteConfirmOpen(false);
    setAnalysisToDelete(null);
  };

  const closeAlert = () => {
    setIsAlertOpen(false);
    setAlertMessage('');
  };

  const handleViewMore = (analysis) => {
    setSelectedAnalysisInModal(analysis);
    setIsViewMoreModalOpen(true);
  };

  const closeViewMoreModal = () => {
    setIsViewMoreModalOpen(false);
    setSelectedAnalysisInModal(null);
  };

  const handleVideoError = (e) => {
    console.error('Video load error:', e);
    e.target.parentElement.innerHTML = '<p class="text-red-500">Failed to load video</p>';
  };

  const handleDownload = (videoUrl, videoName) => {
    const link = document.createElement('a');
    link.href = videoUrl;
    link.download = videoName || 'communication-analysis-video';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (loading || (location.state?.videoRecordId && videoState.status === 'loading' && !videoState.currentAnalysis && !videoState.error)) {
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

  if (location.state?.videoRecordId && (videoState.currentAnalysis || videoState.error)) {
    return (
      <div className="results-page-container">
        <AuthenticatedNavbar />
        <main className="results-content p-8">
          <h1 className="text-3xl font-bold mb-6 text-center">Analysis for: {videoState.videoName || 'Your Video'}</h1>

          {videoState.message && !videoState.currentAnalysis && !videoState.error && (
            <p className="text-center text-blue-600 mb-4">{videoState.message}</p>
          )}
          {videoState.error && (
            <ErrorDisplay 
              error={videoState.error} 
              onRetry={() => {
                const token = localStorage.getItem('token');
                pollForAnalysis(location.state?.videoRecordId, token);
              }}
            />
          )}

          <VideoPlayer 
            src={videoState.videoUrl} 
            title={videoState.videoName}
            onError={handleVideoError}
          />

          {videoState.currentAnalysis ? (
            <div className="analysis-details">
              <div className="flex justify-between items-center mb-4">
                <h3>Summary</h3>
                {videoState.videoUrl && (
                  <button 
                    onClick={() => handleDownload(videoState.videoUrl, videoState.videoName)}
                    className="download-btn"
                  >
                    Download Video
                  </button>
                )}
              </div>
              
              <p><strong>Date:</strong> {new Date(videoState.currentAnalysis.date).toLocaleDateString()}</p>
              <p><strong>Overall Score:</strong> {videoState.currentAnalysis.overallScore || 'N/A'}</p>
              <p><strong>Filler Words:</strong> {videoState.currentAnalysis.fillerWords?.join(', ') || 'None'}</p>
              <p><strong>Speaking Rate:</strong> {videoState.currentAnalysis.speakingRate || 'N/A'} words/minute</p>
              <p><strong>Sentiment:</strong> {videoState.currentAnalysis.sentiment || 'N/A'}</p>
              
              <h3>Grammar Insights</h3>
              {videoState.currentAnalysis.grammarErrors?.length > 0 ? (
                <ul>
                  {videoState.currentAnalysis.grammarErrors.map((error, index) => (
                    <li key={index}>
                      <strong>Error:</strong> {error.message} - <em>"{error.text}"</em>
                      {error.replacements?.length > 0 && (
                        <span className="text-gray-600 ml-2">(Suggestions: {error.replacements.join(', ')})</span>
                      )}
                    </li>
                  ))}
                </ul>
              ) : (
                <p>No significant grammar errors detected.</p>
              )}

              <h3>Fluency and Pacing</h3>
              <p>{videoState.currentAnalysis.fluencyFeedback || 'No specific fluency feedback available.'}</p>
              
              {videoState.currentAnalysis.areasForImprovement?.length > 0 && (
                <>
                  <h3>Areas for Improvement</h3>
                  <ul>
                    {videoState.currentAnalysis.areasForImprovement.map((tip, index) => (
                      <li key={index}>{tip}</li>
                    ))}
                  </ul>
                </>
              )}
              <button 
                onClick={() => navigate('/app/results', { state: {} })} 
                className="back-to-list-btn"
              >
                View All Analyses
              </button>
            </div>
          ) : (
            !videoState.error && <p className="text-center text-gray-500">Waiting for analysis results...</p>
          )}
        </main>
        <Footer />
        {isAlertOpen && <AlertModal message={alertMessage} onClose={closeAlert} />}
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
              <AnalysisCard
                key={analysis._id}
                analysis={analysis}
                onViewMore={handleViewMore}
                onDelete={handleDeleteClick}
              />
            ))}
          </div>
        )}
      </main>

      {isViewMoreModalOpen && selectedAnalysisInModal && (
        <div className="modal-overlay" onClick={closeViewMoreModal}>
          <div className="modal-content" onClick={e => e.stopPropagation()} data-tilt data-tilt-max="10">
            <span
              className="close-button"
              onClick={closeViewMoreModal}
              aria-label="Close modal"
              role="button"
              tabIndex={0}
              onKeyDown={(e) => e.key === 'Enter' && closeViewMoreModal()}
            >
              ×
            </span>
            <h2>{selectedAnalysisInModal.videoName || `Analysis ${selectedAnalysisInModal._id.substring(selectedAnalysisInModal._id.length - 4)}`}</h2>
            
            <VideoPlayer 
              src={selectedAnalysisInModal.videoUrl} 
              title={selectedAnalysisInModal.videoName}
              className="modal-video-container"
              onError={handleVideoError}
            />

            <div className="analysis-details">
              <h3>Summary</h3>
              <p><strong>Date:</strong> {new Date(selectedAnalysisInModal.date).toLocaleDateString()}</p>
              <p><strong>Overall Score:</strong> {selectedAnalysisInModal.overallScore || 'N/A'}</p>
              <p><strong>Filler Words:</strong> {selectedAnalysisInModal.fillerWords?.join(', ') || 'None'}</p>
              <p><strong>Speaking Rate:</strong> {selectedAnalysisInModal.speakingRate || 'N/A'} words/minute</p>
              <p><strong>Sentiment:</strong> {selectedAnalysisInModal.sentiment || 'N/A'}</p>
              
              <h3>Grammar Insights</h3>
              {selectedAnalysisInModal.grammarErrors?.length > 0 ? (
                <ul>
                  {selectedAnalysisInModal.grammarErrors.map((error, index) => (
                    <li key={index}>
                      <strong>Error:</strong> {error.message} - <em>"{error.text}"</em>
                      {error.replacements?.length > 0 && (
                        <span className="text-gray-600 ml-2">(Suggestions: {error.replacements.join(', ')})</span>
                      )}
                    </li>
                  ))}
                </ul>
              ) : (
                <p>No significant grammar errors detected.</p>
              )}

              <h3>Fluency and Pacing</h3>
              <p>{selectedAnalysisInModal.fluencyFeedback || 'No specific fluency feedback available.'}</p>
              
              {selectedAnalysisInModal.areasForImprovement?.length > 0 && (
                <>
                  <h3>Areas for Improvement</h3>
                  <ul>
                    {selectedAnalysisInModal.areasForImprovement.map((tip, index) => (
                      <li key={index}>{tip}</li>
                    ))}
                  </ul>
                </>
              )}
            </div>
            <button
              onClick={closeViewMoreModal}
              className="modal-close-btn"
              aria-label="Close detailed analysis"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {isDeleteConfirmOpen && (
        <ConfirmationModal
          message={`Are you sure you want to delete analysis "${analysisToDelete?.videoName || 'this video'}"?`}
          onConfirm={confirmDelete}
          onCancel={cancelDelete}
        />
      )}
      {isAlertOpen && <AlertModal message={alertMessage} onClose={closeAlert} />}

      <Footer />
    </div>
  );
}

export default ResultsPage;
