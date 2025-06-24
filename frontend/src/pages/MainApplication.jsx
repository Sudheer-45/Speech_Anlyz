import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import AuthenticatedNavbar from '../components/AuthenticatedNavbar';
import Footer from '../components/Footer';
import axios from 'axios';
import Webcam from 'react-webcam';
import './MainApplication.css';

const videoConstraints = {
    width: 1280,
    height: 720,
    facingMode: "user"
};

const RENDER_BACKEND_URL = "https://comm-analyzer.onrender.com";
const POLLING_INTERVAL = 5000; // 5 seconds (reduced from 3s to prevent rate limiting)
const MAX_POLLING_ATTEMPTS = 30; // ~2.5 minutes timeout (increased from 1 minute)

function MainApplication() {
    const navigate = useNavigate();
    const [message, setMessage] = useState('');
    const [isError, setIsError] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [videoName, setVideoName] = useState('');
    const [uploadedFile, setUploadedFile] = useState(null);
    const webcamRef = useRef(null);
    const mediaRecorderRef = useRef(null);
    const [isRecording, setIsRecording] = useState(false);
    const recordedChunksRef = useRef([]);
    const [recordedVideoBlob, setRecordedVideoBlob] = useState(null);
    const [recordedVideoURL, setRecordedVideoURL] = useState('');
    const [showRecordedControls, setShowRecordedControls] = useState(false);
    const [showWebcam, setShowWebcam] = useState(false);
    const [recordingAttemptStarted, setRecordingAttemptStarted] = useState(false);
    const [recordedTime, setRecordedTime] = useState(0);
    const timerIntervalRef = useRef(null);
    const pollingRef = useRef(null);
    const pollingAttemptsRef = useRef(0);
    const [analysisProgress, setAnalysisProgress] = useState(0);

    const formatTime = (totalSeconds) => {
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;
        return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    };

    const stopPolling = () => {
        if (pollingRef.current) {
            clearInterval(pollingRef.current);
            pollingRef.current = null;
        }
        pollingAttemptsRef.current = 0;
        setAnalysisProgress(0);
    };

    const checkVideoStatus = async (videoId) => {
        try {
            const token = localStorage.getItem('token');
            if (!token) throw new Error('User not authenticated');

            const response = await axios.get(`${RENDER_BACKEND_URL}/api/videos/status/${videoId}`, {
                headers: { 
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });
            
            if (response.status === 404) {
                throw new Error('Video not found');
            }
            
            return response.data;
        } catch (error) {
            console.error('Status check error:', error);
            
            if (error.response?.status === 404) {
                throw new Error('Video not found - please try uploading again');
            } else if (error.response?.status === 401) {
                throw new Error('Session expired - please login again');
            }
            
            throw error;
        }
    };

    const startPolling = (videoId, videoName) => {
        stopPolling();
        
        const poll = async () => {
            try {
                pollingAttemptsRef.current += 1;
                const statusResponse = await checkVideoStatus(videoId);
                
                // Calculate progress based on status
                let progress = 0;
                switch (statusResponse.status) {
                    case 'uploading':
                        progress = 10;
                        break;
                    case 'processed':
                        progress = 30;
                        break;
                    case 'transcribing':
                        progress = 50;
                        break;
                    case 'analyzing':
                        progress = 75;
                        break;
                    case 'analyzed':
                        progress = 100;
                        break;
                }
                setAnalysisProgress(progress);

                switch (statusResponse.status) {
                    case 'analyzed':
                        stopPolling();
                        navigate('/app/results', { 
                            state: { 
                                videoRecordId: videoId,
                                videoUrl: statusResponse.videoUrl,
                                videoName,
                                analysisId: statusResponse.analysisId
                            } 
                        });
                        break;
                        
                    case 'failed':
                        stopPolling();
                        setMessage(`Analysis failed: ${statusResponse.error || 'Unknown error'}`);
                        setIsError(true);
                        break;
                        
                    default:
                        setMessage(`Processing (${pollingAttemptsRef.current}/${MAX_POLLING_ATTEMPTS}): ${statusResponse.message || statusResponse.status}`);
                }

                if (pollingAttemptsRef.current >= MAX_POLLING_ATTEMPTS) {
                    stopPolling();
                    setMessage('Analysis is taking longer than expected. We\'ll notify you when it\'s ready.');
                    setIsError(false);
                }
                
            } catch (error) {
                console.error('Polling error:', error);
                
                if (error.message.includes('not found')) {
                    stopPolling();
                    setMessage('Video not found - please try uploading again');
                    setIsError(true);
                } else if (pollingAttemptsRef.current >= MAX_POLLING_ATTEMPTS) {
                    stopPolling();
                    setMessage('System busy - we\'ll notify you when your analysis is ready');
                    setIsError(false);
                }
            }
        };

        poll();
        pollingRef.current = setInterval(poll, POLLING_INTERVAL);
    };

    const handleUploadAndAnalyze = async (fileToUpload, nameForVideo) => {
        setMessage('');
        setIsError(false);
        setIsLoading(true);

        if (!fileToUpload) {
            setMessage('No video file selected or recorded.');
            setIsError(true);
            setIsLoading(false);
            return;
        }

        const formData = new FormData();
        formData.append('video', fileToUpload);
        formData.append('videoName', nameForVideo || fileToUpload.name);

        try {
            const token = localStorage.getItem('token');
            if (!token) throw new Error('User not authenticated. Please log in.');

            const uploadResponse = await axios.post(`${RENDER_BACKEND_URL}/api/videos/upload`, formData, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'multipart/form-data'
                },
                onUploadProgress: (progressEvent) => {
                    const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
                    setMessage(`Uploading video: ${percentCompleted}%`);
                    setAnalysisProgress(percentCompleted / 2); // Upload is first half of progress
                }
            });

            const { videoId, message: responseMessage } = uploadResponse.data;
            
            setMessage(responseMessage || 'Video uploaded. Processing may take a few minutes...');
            cleanupAfterUpload();
            startPolling(videoId, nameForVideo || fileToUpload.name);

        } catch (error) {
            stopPolling();
            handleUploadError(error);
        } finally {
            setIsLoading(false);
        }
    };

    // ... (keep all other helper functions the same: cleanupAfterUpload, handleUploadError, etc.)

    return (
        <div className="main-app-container">
            <AuthenticatedNavbar />
            <main className="main-content">
                <h1>Welcome to Your Comm Analyzer!</h1>
                
                <div className="website-info">
                    <p>
                        This platform helps you enhance your communication skills using Google's AI technology.
                        Upload a video or record directly to receive insights into your speech patterns,
                        grammar, and overall communication effectiveness.
                    </p>
                </div>

                {/* Progress bar for upload/analysis */}
                {analysisProgress > 0 && (
                    <div className="progress-container">
                        <div 
                            className="progress-bar" 
                            style={{ width: `${analysisProgress}%` }}
                        ></div>
                        <span className="progress-text">{Math.round(analysisProgress)}%</span>
                    </div>
                )}

                {/* ... (rest of your JSX remains the same) ... */}
            </main>
            <Footer />
        </div>
    );
}

export default MainApplication;
