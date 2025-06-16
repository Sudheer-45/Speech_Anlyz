import React, { useState, useEffect, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import AuthenticatedNavbar from '../components/AuthenticatedNavbar';
import Footer from '../components/Footer';
import axios from 'axios';
import './ResultsPage.css'; // Ensure this CSS file exists and has your styles

// IMPORTANT: Replace with your actual Render backend URL
const RENDER_BACKEND_URL = "https://comm-analyzer.onrender.com"; 

// --- Custom Modal Components (for Confirm and Alert replacements) ---

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

// --- Spinner component for loading state ---
const LoadingSpinner = () => (
    <div className="loading-overlay" aria-live="polite">
        <div className="spinner" data-tilt data-tilt-max="10"></div>
        <span className="sr-only">Loading content...</span>
    </div>
);

function ResultsPage() {
    const location = useLocation();
    const navigate = useNavigate();

    // State for the list of all results
    const [results, setResults] = useState([]);
    // State for the currently displayed (single) analysis if navigated from upload
    const [currentAnalysisView, setCurrentAnalysisView] = useState(null);
    const [videoUrlForCurrentView, setVideoUrlForCurrentView] = useState(null);
    const [videoNameForCurrentView, setVideoNameForCurrentView] = useState(null);

    // Loading and error states
    const [loading, setLoading] = useState(true); // Initial page load
    const [isLoadingAnalysis, setIsLoadingAnalysis] = useState(false); // For polling a single analysis
    const [error, setError] = useState('');
    const [analysisStatusMessage, setAnalysisStatusMessage] = useState('');

    // Modal states
    const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
    const [analysisToDelete, setAnalysisToDelete] = useState(null);
    const [isAlertOpen, setIsAlertOpen] = useState(false);
    const [alertMessage, setAlertMessage] = useState('');
    const [isViewMoreModalOpen, setIsViewMoreModalOpen] = useState(false);
    const [selectedAnalysisInModal, setSelectedAnalysisInModal] = useState(null);

    // Effect to fetch initial results or a specific analysis
    useEffect(() => {
        const token = localStorage.getItem('token');
        if (!token) {
            setError('Please log in to view results.');
            setLoading(false);
            return;
        }

        const { videoRecordId, videoUrl, videoName } = location.state || {};
        
        // Scenario 1: Just uploaded a video, show its analysis immediately and poll
        if (videoRecordId && videoUrl) {
            console.log('ResultsPage: Navigated from upload, attempting to show specific video.');
            setVideoUrlForCurrentView(videoUrl);
            setVideoNameForCurrentView(videoName);
            setCurrentAnalysisView(null); // Clear previous view if any
            setLoading(false); // Page itself loaded
            pollForSpecificAnalysis(videoRecordId, token);
        } else {
            // Scenario 2: Direct access or refresh, fetch all previous analyses
            console.log('ResultsPage: Direct access or refresh, fetching all analyses.');
            fetchAllAnalyses(token);
        }

        // Cleanup for any URL objects if component unmounts
        return () => {
            if (videoUrlForCurrentView && videoUrlForCurrentView.startsWith('blob:')) {
                URL.revokeObjectURL(videoUrlForCurrentView);
            }
        };
    }, [location.state, navigate]); // Depend on location.state to re-run when state changes (e.g., after upload)

    const fetchAllAnalyses = async (token) => {
        setLoading(true); // Show full page spinner
        setError('');
        try {
            const response = await axios.get(`${RENDER_BACKEND_URL}/api/analysis/my-analyses`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            setResults(response.data);
            setLoading(false);
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to fetch analysis results.');
            setLoading(false);
            console.error('Fetch All Results Error:', err);
        }
    };

    const pollForSpecificAnalysis = useCallback(async (recordId, token) => {
        setIsLoadingAnalysis(true); // Show analysis-specific loading
        setAnalysisStatusMessage('Analysis in progress...');
        setErrorMessage(''); // Clear previous error

        // Polling logic
        const intervalId = setInterval(async () => {
            try {
                // Fetch the Video record to check its status and analysisId
                const videoStatusResponse = await axios.get(`${RENDER_BACKEND_URL}/api/user/videos`, { // Fetch all videos to find by ID
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                const currentVideoRecord = videoStatusResponse.data.videos.find(v => v._id === recordId);

                if (currentVideoRecord) {
                    if (currentVideoRecord.status === 'analyzed' && currentVideoRecord.analysisId) {
                        clearInterval(intervalId); // Stop polling
                        // Now fetch the detailed analysis data using analysisId
                        const analysisResponse = await axios.get(`${RENDER_BACKEND_URL}/api/analysis/${currentVideoRecord.analysisId}`, {
                            headers: { 'Authorization': `Bearer ${token}` }
                        });
                        setCurrentAnalysisView(analysisResponse.data);
                        setIsLoadingAnalysis(false);
                        setAnalysisStatusMessage('Analysis completed!');
                        setError(''); // Clear any lingering error messages
                        // After showing the specific analysis, also update the full list in the background
                        fetchAllAnalyses(token); 

                    } else if (currentVideoRecord.status === 'failed') {
                        clearInterval(intervalId);
                        setErrorMessage(`Analysis failed: ${currentVideoRecord.errorMessage || 'Unknown error.'}`);
                        setIsLoadingAnalysis(false);
                        setAnalysisStatusMessage(''); // Clear status message
                        // After failed analysis, also update the full list to show failed status
                        fetchAllAnalyses(token); 

                    } else {
                        // Still processing, update status message
                        setAnalysisStatusMessage(`Analysis status: ${currentVideoRecord.status}...`);
                    }
                } else {
                    // Video record not found, might be a temporary issue or incorrect ID
                    clearInterval(intervalId);
                    setErrorMessage('Video record not found for analysis.');
                    setIsLoadingAnalysis(false);
                    setAnalysisStatusMessage('');
                }
            } catch (pollError) {
                console.error('Polling for analysis failed:', pollError);
                clearInterval(intervalId);
                setErrorMessage(`Error checking analysis status: ${pollError.response?.data?.message || pollError.message}`);
                setIsLoadingAnalysis(false);
                setAnalysisStatusMessage('');
            }
        }, 5000); // Poll every 5 seconds

        return () => clearInterval(intervalId); // Cleanup on component unmount
    }, []);


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
            setResults(results.filter(analysis => analysis._id !== analysisToDelete._id));
            setAlertMessage('Analysis deleted successfully!');
            setIsAlertOpen(true);
            setAnalysisToDelete(null);

            // If the deleted analysis was the one currently being viewed, clear the view
            if (currentAnalysisView && currentAnalysisView._id === analysisToDelete._id) {
                setCurrentAnalysisView(null);
                setVideoUrlForCurrentView(null);
                setVideoNameForCurrentView(null);
                // Optionally, refetch all to ensure the list is consistent
                fetchAllAnalyses(token);
            }

        } catch (err) {
            setAlertMessage(err.response?.data?.message || 'Failed to delete analysis.');
            setIsAlertOpen(true);
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

    // Render loading spinner for initial page load or when specific analysis is being fetched
    if (loading || (location.state?.videoRecordId && isLoadingAnalysis)) {
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

    // Render the specific analysis view if a video was just uploaded
    if (location.state?.videoRecordId && currentAnalysisView) {
        const analysis = currentAnalysisView;
        return (
            <div className="results-page-container">
                <AuthenticatedNavbar />
                <main className="results-content p-8">
                    <h1 className="text-3xl font-bold mb-6 text-center">Analysis for: {videoNameForCurrentView || 'Your Video'}</h1>

                    {analysisStatusMessage && !analysis && (
                        <p className="text-center text-blue-600 mb-4">{analysisStatusMessage}</p>
                    )}
                     {errorMessage && (
                        <p className="text-center text-red-500 mb-4">{errorMessage}</p>
                    )}

                    {/* Video Playback Section */}
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

                    {/* Analysis Display Section */}
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
                        <p className="text-center text-gray-500">Waiting for analysis results...</p>
                    )}
                </main>
                <Footer />
                {isAlertOpen && <AlertModal message={alertMessage} onClose={closeAlert} />}
            </div>
        );
    }

    // Render the list of all results (default view)
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

            {/* View More Modal */}
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

            {/* Custom Confirmation and Alert Modals */}
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
