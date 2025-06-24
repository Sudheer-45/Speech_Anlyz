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
const POLLING_INTERVAL = 5000; // 5 seconds
const MAX_POLLING_ATTEMPTS = 36; // 3 minutes timeout (36 * 5s)

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
    const [estimatedTimeRemaining, setEstimatedTimeRemaining] = useState(null);

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
        setEstimatedTimeRemaining(null);
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
        const startTime = Date.now();
        
        const poll = async () => {
            try {
                pollingAttemptsRef.current += 1;
                const statusResponse = await checkVideoStatus(videoId);
                
                // Calculate progress and estimated time
                let progress = 0;
                let stageMultiplier = 1;
                let stageMessage = '';
                
                switch (statusResponse.status) {
                    case 'uploading':
                        progress = 15;
                        stageMultiplier = 1.2;
                        stageMessage = 'Uploading video';
                        break;
                    case 'processing':
                        progress = 30;
                        stageMultiplier = 1.5;
                        stageMessage = 'Processing video';
                        break;
                    case 'transcribing':
                        progress = 50;
                        stageMultiplier = 2;
                        stageMessage = 'Transcribing audio';
                        break;
                    case 'analyzing':
                        progress = 75;
                        stageMultiplier = 1;
                        stageMessage = 'Analyzing content with Google AI';
                        break;
                    case 'analyzed':
                        progress = 100;
                        stopPolling();
                        navigate('/app/results', { 
                            state: { 
                                videoRecordId: videoId,
                                videoUrl: statusResponse.videoUrl,
                                videoName,
                                analysisId: statusResponse.analysisId
                            } 
                        });
                        return;
                    case 'failed':
                        stopPolling();
                        setMessage(`Analysis failed: ${statusResponse.error || 'Unknown error'}`);
                        setIsError(true);
                        return;
                }

                setAnalysisProgress(progress);
                
                // Calculate estimated time remaining
                const elapsed = (Date.now() - startTime) / 1000;
                const estimatedTotal = elapsed / (progress / 100);
                const remaining = Math.max(0, Math.round((estimatedTotal - elapsed) / 60);
                setEstimatedTimeRemaining(remaining);

                setMessage(`${stageMessage} (${pollingAttemptsRef.current}/${MAX_POLLING_ATTEMPTS}) - ~${remaining} min remaining`);

                if (pollingAttemptsRef.current >= MAX_POLLING_ATTEMPTS) {
                    stopPolling();
                    setMessage('Analysis is taking longer than expected. We\'ll notify you when complete.');
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
                    setMessage('System busy - we\'ll notify you when complete');
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
            
            setMessage(responseMessage || 'Video uploaded. Analysis in progress...');
            cleanupAfterUpload();
            startPolling(videoId, nameForVideo || fileToUpload.name);

        } catch (error) {
            stopPolling();
            handleUploadError(error);
        } finally {
            setIsLoading(false);
        }
    };

    const cleanupAfterUpload = () => {
        setUploadedFile(null);
        setRecordedVideoBlob(null);
        if (recordedVideoURL) URL.revokeObjectURL(recordedVideoURL);
        setRecordedVideoURL('');
        recordedChunksRef.current = [];
        setShowRecordedControls(false);
        setVideoName('');
    };

    const handleUploadError = (error) => {
        const errorMessage = error.response?.data?.message || 
                          error.response?.data?.error || 
                          error.message || 
                          'Video upload failed. Please try again.';
        setMessage(errorMessage);
        setIsError(true);
        console.error('Upload Error:', error);
    };

    const handleFileChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            setUploadedFile(file);
            if (!videoName) setVideoName(file.name.split('.')[0]);
            resetRecordingState();
            setMessage('');
            setIsError(false);
        }
    };

    const resetRecordingState = () => {
        setRecordedVideoBlob(null);
        if (recordedVideoURL) URL.revokeObjectURL(recordedVideoURL);
        setRecordedVideoURL('');
        recordedChunksRef.current = [];
        setShowRecordedControls(false);
        setShowWebcam(false);
        setIsRecording(false);
        setRecordingAttemptStarted(false);
        clearInterval(timerIntervalRef.current);
        setRecordedTime(0);
    };

    const handleDataAvailable = useCallback(({ data }) => {
        if (data.size > 0) recordedChunksRef.current.push(data);
    }, []);

    const handleUserMedia = useCallback((stream) => {
        setMessage('Camera and microphone ready. Recording started.');
        setIsError(false);

        recordedChunksRef.current = [];
        mediaRecorderRef.current = new MediaRecorder(stream, { mimeType: 'video/webm; codecs=vp8' });

        mediaRecorderRef.current.addEventListener('dataavailable', handleDataAvailable);
        mediaRecorderRef.current.onstop = () => {
            const blob = new Blob(recordedChunksRef.current, { type: 'video/webm' });

            if (blob.size === 0) {
                setMessage('No video data recorded. Please try again.');
                setIsError(true);
                setShowRecordedControls(false);
                setShowWebcam(false);
                setRecordingAttemptStarted(false);
                stream.getTracks().forEach(track => track.stop());
                return;
            }

            setRecordedVideoBlob(blob);
            setRecordedVideoURL(URL.createObjectURL(blob));
            setShowRecordedControls(true);
            setMessage('Recording stopped. Preview available.');
            setIsError(false);

            stream.getTracks().forEach(track => track.stop());
            setShowWebcam(false);
            setRecordingAttemptStarted(false);
        };

        mediaRecorderRef.current.start();
        setIsRecording(true);

        setRecordedTime(0);
        timerIntervalRef.current = setInterval(() => {
            setRecordedTime(prev => prev + 1);
        }, 1000);
    }, [handleDataAvailable]);

    const handleUserMediaError = useCallback((error) => {
        console.error('Webcam access error:', error);
        setMessage(`Camera/mic access failed: ${error.name || error.message}. Check permissions.`);
        setIsError(true);
        setIsRecording(false);
        clearInterval(timerIntervalRef.current);
        setRecordedTime(0);
        setShowWebcam(false);
        setRecordingAttemptStarted(false);
    }, []);

    const startRecording = useCallback(() => {
        setMessage('');
        setIsError(false);
        setUploadedFile(null);
        resetRecordingState();
        setRecordingAttemptStarted(true);
        setShowWebcam(true);
    }, []);

    const stopRecording = useCallback(() => {
        setIsRecording(false);
        clearInterval(timerIntervalRef.current);

        if (mediaRecorderRef.current?.state === 'recording') {
            mediaRecorderRef.current.stop();
        }
    }, []);

    const handleUploadRecordedVideo = () => {
        if (recordedVideoBlob) {
            const defaultName = `recorded_video_${new Date().toISOString().slice(0, 10)}.webm`;
            const recordedFile = new File([recordedVideoBlob], videoName || defaultName, { type: 'video/webm' });
            handleUploadAndAnalyze(recordedFile, videoName);
        } else {
            setMessage('No recorded video available.');
            setIsError(true);
        }
    };

    const handleRerecord = useCallback(() => {
        resetRecordingState();
        setRecordingAttemptStarted(true);
        setShowWebcam(true);
        setMessage('');
        setIsError(false);
    }, [recordedVideoURL]);

    useEffect(() => {
        return () => {
            stopPolling();
            clearInterval(timerIntervalRef.current);
            if (recordedVideoURL) URL.revokeObjectURL(recordedVideoURL);
            if (webcamRef.current?.stream) {
                webcamRef.current.stream.getTracks().forEach(track => track.stop());
            }
        };
    }, [recordedVideoURL]);

    return (
        <div className="main-app-container">
            <AuthenticatedNavbar />
            <main className="main-content">
                <h1>Welcome to Your Comm Analyzer!</h1>
                
                <div className="website-info">
                    <p>
                        This platform uses Google's advanced AI to analyze your communication skills.
                        Upload a video or record directly to receive detailed feedback on your speech patterns,
                        grammar, and overall effectiveness.
                    </p>
                </div>

                {message && (
                    <div className={`status-message ${isError ? 'error' : 'info'}`}>
                        {message}
                        {estimatedTimeRemaining !== null && !isError && (
                            <div className="time-estimate">
                                Estimated time remaining: ~{estimatedTimeRemaining} minute{estimatedTimeRemaining !== 1 ? 's' : ''}
                            </div>
                        )}
                    </div>
                )}

                {analysisProgress > 0 && analysisProgress < 100 && (
                    <div className="progress-container">
                        <div className="progress-track">
                            <div 
                                className="progress-fill" 
                                style={{ width: `${analysisProgress}%` }}
                            ></div>
                        </div>
                        <div className="progress-text">
                            {Math.round(analysisProgress)}% complete
                        </div>
                    </div>
                )}

                <div className="video-input-options">
                    <div className="form-group video-name-group">
                        <label htmlFor="videoName">Video Name</label>
                        <input
                            type="text"
                            id="videoName"
                            value={videoName}
                            onChange={(e) => setVideoName(e.target.value)}
                            placeholder="e.g., Job Interview Practice"
                            disabled={isLoading || isRecording || recordingAttemptStarted}
                        />
                    </div>

                    <div className="upload-record-sections">
                        <section className="upload-section">
                            <h2>Upload Existing Video</h2>
                            <div className="form-group">
                                <label htmlFor="videoFile" className="file-upload-label">
                                    <span>Choose Video File</span>
                                    <input
                                        type="file"
                                        id="videoFile"
                                        accept="video/*"
                                        onChange={handleFileChange}
                                        disabled={isLoading || isRecording || recordingAttemptStarted}
                                    />
                                </label>
                                {uploadedFile && (
                                    <div className="selected-file-info">
                                        <span>Selected: {uploadedFile.name}</span>
                                        <span className="file-size">
                                            {(uploadedFile.size / (1024 * 1024)).toFixed(2)} MB
                                        </span>
                                    </div>
                                )}
                            </div>
                            <button
                                onClick={() => handleUploadAndAnalyze(uploadedFile, videoName)}
                                className={`action-button upload-button ${isLoading ? 'loading' : ''}`}
                                disabled={!uploadedFile || isLoading || isRecording || recordingAttemptStarted || !videoName.trim()}
                            >
                                {isLoading ? (
                                    <>
                                        <span className="spinner"></span>
                                        Uploading...
                                    </>
                                ) : (
                                    'Upload Video'
                                )}
                            </button>
                        </section>

                        <div className="divider">
                            <span>OR</span>
                        </div>

                        <section className="record-section">
                            <h2>Record New Video</h2>
                            <div className="video-area">
                                {showWebcam ? (
                                    <div className="webcam-container">
                                        <Webcam
                                            audio={true}
                                            muted={true}
                                            ref={webcamRef}
                                            videoConstraints={videoConstraints}
                                            className="webcam-preview"
                                            mirrored={true}
                                            onUserMedia={handleUserMedia}
                                            onUserMediaError={handleUserMediaError}
                                        />
                                        {isRecording && (
                                            <div className="recording-indicator">
                                                <div className="recording-dot"></div>
                                                <span>Recording: {formatTime(recordedTime)}</span>
                                            </div>
                                        )}
                                    </div>
                                ) : recordedVideoURL ? (
                                    <div className="recorded-preview-container">
                                        <video 
                                            src={recordedVideoURL} 
                                            controls 
                                            className="recorded-preview" 
                                        />
                                    </div>
                                ) : (
                                    <div className="no-video-placeholder">
                                        <div className="placeholder-icon">
                                            <i className="fas fa-video"></i>
                                        </div>
                                        <p>
                                            {videoName.trim() 
                                                ? 'Click "Start Recording" to begin' 
                                                : 'Enter a video name to enable recording'}
                                        </p>
                                    </div>
                                )}
                            </div>

                            <div className="recording-controls">
                                {!isRecording && !showRecordedControls ? (
                                    <button
                                        onClick={startRecording}
                                        className={`action-button record-button ${!videoName.trim() ? 'disabled' : ''}`}
                                        disabled={isLoading || uploadedFile || !videoName.trim()}
                                    >
                                        <i className="fas fa-circle"></i> Start Recording
                                    </button>
                                ) : isRecording ? (
                                    <button
                                        onClick={stopRecording}
                                        className="action-button stop-record-button"
                                        disabled={isLoading}
                                    >
                                        <i className="fas fa-stop"></i> Stop Recording
                                    </button>
                                ) : showRecordedControls ? (
                                    <div className="recorded-actions">
                                        <button
                                            onClick={handleRerecord}
                                            className="action-button secondary-button"
                                            disabled={isLoading}
                                        >
                                            <i className="fas fa-redo"></i> Re-record
                                        </button>
                                        <button
                                            onClick={handleUploadRecordedVideo}
                                            className={`action-button primary-button ${isLoading ? 'loading' : ''}`}
                                            disabled={!recordedVideoBlob || isLoading || !videoName.trim()}
                                        >
                                            {isLoading ? (
                                                <>
                                                    <span className="spinner"></span>
                                                    Uploading...
                                                </>
                                            ) : (
                                                <>
                                                    <i className="fas fa-cloud-upload-alt"></i> Upload Recording
                                                </>
                                            )}
                                        </button>
                                    </div>
                                ) : null}
                            </div>
                        </section>
                    </div>
                </div>
            </main>
            <Footer />
        </div>
    );
}

export default MainApplication;
