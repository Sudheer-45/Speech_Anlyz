import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import AuthenticatedNavbar from '../components/AuthenticatedNavbar';
import Footer from '../components/Footer';
import axios from 'axios';
import './ResultsPage.css';

const RENDER_BACKEND_URL = "https://comm-analyzer.onrender.com";

// --- Custom Modal Components ---
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

const LoadingSpinner = () => (
    <div className="loading-overlay" aria-live="polite">
        <div className="spinner" data-tilt data-tilt-max="10"></div>
        <span className="sr-only">Loading content...</span>
    </div>
);

function ResultsPage() {
    const location = useLocation();
    const navigate = useNavigate();
    const isMounted = useRef(true);

    // State management
    const [results, setResults] = useState([]);
    const [currentAnalysisView, setCurrentAnalysisView] = useState(null);
    const [videoUrlForCurrentView, setVideoUrlForCurrentView] = useState(null);
    const [videoNameForCurrentView, setVideoNameForCurrentView] = useState(null);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(true);
    const [isLoadingAnalysis, setIsLoadingAnalysis] = useState(false);
    const [errorMessage, setErrorMessage] = useState('');
    const [analysisStatusMessage, setAnalysisStatusMessage] = useState('');

    // Modal states
    const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
    const [analysisToDelete, setAnalysisToDelete] = useState(null);
    const [isAlertOpen, setIsAlertOpen] = useState(false);
    const [alertMessage, setAlertMessage] = useState('');
    const [isViewMoreModalOpen, setIsViewMoreModalOpen] = useState(false);
    const [selectedAnalysisInModal, setSelectedAnalysisInModal] = useState(null);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            isMounted.current = false;
            if (videoUrlForCurrentView && videoUrlForCurrentView.startsWith('blob:')) {
                URL.revokeObjectURL(videoUrlForCurrentView);
            }
        };
    }, [videoUrlForCurrentView]);

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

    const pollForSpecificAnalysis = useCallback(async (recordId, token) => {
        if (!isMounted.current) return;

        setIsLoadingAnalysis(true);
        setAnalysisStatusMessage('Analysis in progress...');
        setErrorMessage('');

        const intervalId = setInterval(async () => {
            if (!isMounted.current) {
                clearInterval(intervalId);
                return;
            }

            try {
                const videoStatusResponse = await axios.get(`${RENDER_BACKEND_URL}/api/user/videos`, { 
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                const currentVideoRecord = videoStatusResponse.data.videos.find(v => v._id === recordId);

                if (!currentVideoRecord) {
                    clearInterval(intervalId);
                    if (isMounted.current) {
                        setErrorMessage('Video record not found for analysis.');
                        setIsLoadingAnalysis(false);
                    }
                    return;
                }

                if (currentVideoRecord.status === 'analyzed' && currentVideoRecord.analysisId) {
                    clearInterval(intervalId);
                    const analysisResponse = await axios.get(`${RENDER_BACKEND_URL}/api/analysis/${currentVideoRecord.analysisId}`, {
                        headers: { 'Authorization': `Bearer ${token}` }
                    });
                    
                    if (isMounted.current) {
                        setAnalysisStatusMessage('Analysis completed!');
                        setCurrentAnalysisView(analysisResponse.data);
                        setIsLoadingAnalysis(false);
                        fetchAllAnalyses(token);
                    }
                } else if (currentVideoRecord.status === 'failed') {
                    clearInterval(intervalId);
                    if (isMounted.current) {
                        setErrorMessage(`Analysis failed: ${currentVideoRecord.errorMessage || 'Unknown error.'}`);
                        setIsLoadingAnalysis(false);
                        fetchAllAnalyses(token);
                    }
                } else if (isMounted.current) {
                    setAnalysisStatusMessage(`Analysis status: ${currentVideoRecord.status}...`);
                }
            } catch (pollError) {
                console.error('Polling for analysis failed:', pollError);
                clearInterval(intervalId);
                if (isMounted.current) {
                    setErrorMessage(`Error checking analysis status: ${pollError.response?.data?.message || pollError.message}`);
                    setIsLoadingAnalysis(false);
                }
            }
        }, 5000);

        return () => clearInterval(intervalId);
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
            setVideoUrlForCurrentView(videoUrl);
            setVideoNameForCurrentView(videoName);
            setLoading(false);
            setAnalysisStatusMessage('Starting analysis for your video...');
            pollForSpecificAnalysis(videoRecordId, token);
        } else {
            fetchAllAnalyses(token);
        }
    }, [location.state, navigate, pollForSpecificAnalysis, fetchAllAnalyses]);

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

                if (currentAnalysisView && currentAnalysisView._id === analysisToDelete._id) {
                    setCurrentAnalysisView(null);
                    setVideoUrlForCurrentView(null);
                    setVideoNameForCurrentView(null);
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

    if (loading || (location.state?.videoRecordId && isLoadingAnalysis && !currentAnalysisView && !errorMessage)) {
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

    if (location.state?.videoRecordId && (currentAnalysisView || errorMessage)) {
        const analysis = currentAnalysisView;

        return (
            <div className="results-page-container">
                <AuthenticatedNavbar />
                <main className="results-content p-8">
                    <h1 className="text-3xl font-bold mb-6 text-center">Analysis for: {videoNameForCurrentView || 'Your Video'}</h1>

                    {analysisStatusMessage && !analysis && !errorMessage && (
                        <p className="text-center text-blue-600 mb-4">{analysisStatusMessage}</p>
                    )}
                    {errorMessage && (
                        <p className="text-center text-red-500 mb-4">{errorMessage}</p>
                    )}

                    {videoUrlForCurrentView && (
                        <div className="video-player-container">
                            <video controls src={videoUrlForCurrentView} className="analysis-video">
                                Your browser does not support the video tag.
                            </video>
                        </div>
                    )}
                    {!videoUrlForCurrentView && (
                        <p className="text-center text-gray-500">Video preview not available.</p>
                    )}

                    {analysis ? (
                        <div className="analysis-details">
                            <h3>Summary</h3>
                            <p><strong>Date:</strong> {new Date(analysis.date).toLocaleDateString()}</p>
                            <p><strong>Overall Score:</strong> {analysis.overallScore || 'N/A'}</p>
                            <p><strong>Filler Words:</strong> {analysis.fillerWords?.join(', ') || 'None'}</p>
                            <p><strong>Speaking Rate:</strong> {analysis.speakingRate || 'N/A'} words/minute</p>
                            <p><strong>Sentiment:</strong> {analysis.sentiment || 'N/A'}</p>
                            
                            <h3>Grammar Insights</h3>
                            {analysis.grammarErrors && analysis.grammarErrors.length > 0 ? (
                                <ul>
                                    {analysis.grammarErrors.map((error, index) => (
                                        <li key={index}>
                                            <strong>Error:</strong> {error.message} - <em>"{error.text}"</em>
                                            {error.replacements && error.replacements.length > 0 && (
                                                <span className="text-gray-600 ml-2">(Suggestions: {error.replacements.join(', ')})</span>
                                            )}
                                        </li>
                                    ))}
                                </ul>
                            ) : (
                                <p>No significant grammar errors detected.</p>
                            )}

                            <h3>Fluency and Pacing</h3>
                            <p>{analysis.fluencyFeedback || 'No specific fluency feedback available.'}</p>
                            
                            {analysis.areasForImprovement && analysis.areasForImprovement.length > 0 && (
                                <>
                                    <h3>Areas for Improvement</h3>
                                    <ul>
                                        {analysis.areasForImprovement.map((tip, index) => (
                                            <li key={index}>{tip}</li>
                                        ))}
                                    </ul>
                                </>
                            )}
                            <button onClick={() => navigate('/app/results', { state: {} })} className="back-to-list-btn">
                                View All Analyses
                            </button>
                        </div>
                    ) : (
                        !errorMessage && <p className="text-center text-gray-500">Waiting for analysis results...</p>
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
                                        onClick={() => handleDeleteClick(analysis)}
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
                        
                        {selectedAnalysisInModal.videoUrl && (
                            <div className="modal-video-container" data-tilt data-tilt-max="10">
                                <video controls src={selectedAnalysisInModal.videoUrl} className="analysis-video">
                                    Your browser does not support the video tag.
                                </video>
                            </div>
                        )}

                        <div className="analysis-details">
                            <h3>Summary</h3>
                            <p><strong>Date:</strong> {new Date(selectedAnalysisInModal.date).toLocaleDateString()}</p>
                            <p><strong>Overall Score:</strong> {selectedAnalysisInModal.overallScore || 'N/A'}</p>
                            <p><strong>Filler Words:</strong> {selectedAnalysisInModal.fillerWords?.join(', ') || 'None'}</p>
                            <p><strong>Speaking Rate:</strong> {selectedAnalysisInModal.speakingRate || 'N/A'} words/minute</p>
                            <p><strong>Sentiment:</strong> {selectedAnalysisInModal.sentiment || 'N/A'}</p>
                            
                            <h3>Grammar Insights</h3>
                            {selectedAnalysisInModal.grammarErrors && selectedAnalysisInModal.grammarErrors.length > 0 ? (
                                <ul>
                                    {selectedAnalysisInModal.grammarErrors.map((error, index) => (
                                        <li key={index}>
                                            <strong>Error:</strong> {error.message} - <em>"{error.text}"</em>
                                            {error.replacements && error.replacements.length > 0 && (
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
                            
                            {selectedAnalysisInModal.areasForImprovement && selectedAnalysisInModal.areasForImprovement.length > 0 && (
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
                            data-tilt
                            data-tilt-max="10"
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
