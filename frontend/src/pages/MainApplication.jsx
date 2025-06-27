import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import AuthenticatedNavbar from './components/AuthenticatedNavbar';
import Footer from './components/Footer';
import axios from 'axios';
import Webcam from 'react-webcam';
import './MainApplication.css';

const videoConstraints = {
    width: 1280,
    height: 720,
    facingMode: "user"
};

const RENDER_BACKEND_URL = "https://comm-analyzer.onrender.com";
const POLLING_INTERVAL = 3000; // 3 seconds
const MAX_POLLING_ATTEMPTS = 60; // Increased to 3 minutes (60 * 3 seconds) for longer processing

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
        pollingAttemptsRef.current = 0; // Reset attempts when stopping
    };

    const checkVideoStatus = async (videoId) => {
        try {
            const token = localStorage.getItem('token');
            if (!token) throw new Error('User not authenticated');

            // FIX: Corrected the polling URL to match backend route /api/status/:videoId
            const response = await axios.get(`${RENDER_BACKEND_URL}/api/status/${videoId}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            return response.data;
        } catch (error) {
            console.error('Status check error:', error);
            throw error;
        }
    };

    const startPolling = (videoId, videoName) => {
        stopPolling(); // Ensure any previous polling is stopped
        pollingRef.current = setInterval(async () => {
            try {
                pollingAttemptsRef.current += 1;
                
                if (pollingAttemptsRef.current > MAX_POLLING_ATTEMPTS) {
                    stopPolling();
                    setMessage('Analysis is taking longer than expected. Please check back later or view your videos on the dashboard.');
                    setIsError(true);
                    return;
                }

                const statusResponse = await checkVideoStatus(videoId);
                setMessage(`Processing video (Status: ${statusResponse.status}). Attempt ${pollingAttemptsRef.current}/${MAX_POLLING_ATTEMPTS}...`);

                if (statusResponse.status === 'analyzed') {
                    stopPolling();
                    setMessage('Video analysis completed!');
                    setIsError(false); // Clear error state on success
                    navigate('/app/results', { 
                        state: { 
                            videoRecordId: videoId,
                            videoUrl: statusResponse.videoUrl, // Make sure this is passed
                            videoName,
                            analysisId: statusResponse.analysisId,
                            analysisData: statusResponse.analysisData // Pass the full analysis data
                        } 
                    });
                } else if (statusResponse.status === 'failed') {
                    stopPolling();
                    setMessage(`Analysis failed: ${statusResponse.errorMessage || 'Unknown error'}. Please try again.`);
                    setIsError(true);
                } else if (statusResponse.status === 'Cloudinary Uploading') {
                    setMessage(`Cloudinary Uploading (Attempt ${pollingAttemptsRef.current}/${MAX_POLLING_ATTEMPTS})...`);
                } else if (statusResponse.status === 'processing') {
                    setMessage(`Cloudinary Processing (Attempt ${pollingAttemptsRef.current}/${MAX_POLLING_ATTEMPTS})...`);
                } else if (statusResponse.status === 'analyzing') {
                    setMessage(`Analyzing Video (Attempt ${pollingAttemptsRef.current}/${MAX_POLLING_ATTEMPTS})...`);
                }
            } catch (error) {
                console.error('Polling error:', error);
                // Only stop polling definitively if max attempts reached or specific critical error
                if (pollingAttemptsRef.current >= MAX_POLLING_ATTEMPTS || error.response?.status === 404 || error.response?.status === 403) {
                    stopPolling();
                    setMessage(`Failed to check status: ${error.response?.data?.message || error.message}. Please refresh the page.`);
                    setIsError(true);
                } else {
                    setMessage(`Retrying status check... Attempt ${pollingAttemptsRef.current}/${MAX_POLLING_ATTEMPTS}`);
                }
            }
        }, POLLING_INTERVAL);
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

            const uploadResponse = await axios.post(`${RENDER_BACKEND_URL}/api/upload`, formData, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'multipart/form-data'
                },
                onUploadProgress: (progressEvent) => {
                    const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
                    setMessage(`Uploading video: ${percentCompleted}%`);
                }
            });

            // Capture videoRecordId from the backend response
            const { videoRecordId, message: responseMessage } = uploadResponse.data;
            
            if (!videoRecordId) {
                throw new Error('Backend did not return a video record ID.');
            }

            setMessage(responseMessage || 'Video uploaded. Processing may take a few minutes...');
            cleanupAfterUpload();
            // Pass the captured videoRecordId to startPolling
            startPolling(videoRecordId, nameForVideo || fileToUpload.name);

        } catch (error) {
            stopPolling(); // Stop polling if initial upload fails
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
        stopPolling(); // Also stop any lingering polling
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
    }, []);

    useEffect(() => {
        // Cleanup function for when component unmounts
        return () => {
            stopPolling(); // Stop polling if component unmounts
            clearInterval(timerIntervalRef.current); // Clear recording timer
            if (recordedVideoURL) URL.revokeObjectURL(recordedVideoURL); // Revoke recorded video URL
            // Stop webcam tracks if they are still active
            if (webcamRef.current?.stream) {
                webcamRef.current.stream.getTracks().forEach(track => track.stop());
            }
        };
    }, [recordedVideoURL]); // Dependency on recordedVideoURL for object URL cleanup

    return (
        <div className="main-app-container">
            <AuthenticatedNavbar />
            <main className="main-content">
                <h1>Welcome to Your Comm Analyzer!</h1>
                
                <div className="website-info">
                    <p>
                        This platform helps you enhance your communication skills by analyzing your spoken English.
                        Upload a video or record directly using your webcam to receive insights into your grammar,
                        filler words, speaking rate, and overall sentiment.
                    </p>
                </div>

                <div className="video-input-options">
                    {message && (
                        <p className={`status-message ${isError ? 'error' : 'success'}`}>
                            {message}
                        </p>
                    )}

                    <div className="form-group video-name-group">
                        <label htmlFor="videoName">Video Name</label>
                        <input
                            type="text"
                            id="videoName"
                            value={videoName}
                            onChange={(e) => setVideoName(e.target.value)}
                            placeholder="e.g., Google Interview Practice"
                            disabled={isLoading || isRecording || recordingAttemptStarted}
                        />
                    </div>

                    <div className="upload-record-sections">
                        <section className="upload-section">
                            <h2>Upload Existing Video</h2>
                            <div className="form-group">
                                <input
                                    type="file"
                                    id="videoFile"
                                    accept="video/*"
                                    onChange={handleFileChange}
                                    disabled={isLoading || isRecording || recordingAttemptStarted}
                                />
                                {uploadedFile && (
                                    <p className="selected-file-info">
                                        Selected: {uploadedFile.name}
                                    </p>
                                )}
                            </div>
                            <button
                                onClick={() => handleUploadAndAnalyze(uploadedFile, videoName)}
                                className="action-button upload-button"
                                disabled={!uploadedFile || isLoading || isRecording || recordingAttemptStarted || !videoName.trim()}
                            >
                                {isLoading ? 'Uploading...' : 'Upload Video'}
                            </button>
                        </section>

                        <section className="record-section">
                            <h2>Record New Video</h2>
                            <div className="video-area">
                                {showWebcam ? (
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
                                ) : recordedVideoURL ? (
                                    <div className="recorded-preview-container">
                                        <video src={recordedVideoURL} controls className="recorded-preview" />
                                    </div>
                                ) : (
                                    <p className="no-video-message">
                                        {videoName.trim() ? 'Click "Start Recording" to begin' : 'Enter a video name to enable recording'}
                                    </p>
                                )}
                            </div>

                            <div className="recording-controls">
                                {!isRecording && !showRecordedControls ? (
                                    <button
                                        onClick={startRecording}
                                        className="action-button record-button"
                                        disabled={isLoading || uploadedFile || !videoName.trim()}
                                    >
                                        Start Recording
                                    </button>
                                ) : isRecording ? (
                                    <>
                                        <button
                                            onClick={stopRecording}
                                            className="action-button stop-record-button"
                                            disabled={isLoading}
                                        >
                                            Stop Recording
                                        </button>
                                        <div className="recording-timer">
                                            <span className="timer-icon">⏺️</span> Recording: {formatTime(recordedTime)}
                                        </div>
                                    </>
                                ) : showRecordedControls ? (
                                    <>
                                        <button
                                            onClick={handleRerecord}
                                            className="action-button rerecord-button"
                                            disabled={isLoading}
                                        >
                                            Re-record
                                        </button>
                                        <button
                                            onClick={handleUploadRecordedVideo}
                                            className="action-button upload-recorded-button"
                                            disabled={!recordedVideoBlob || isLoading || !videoName.trim()}
                                        >
                                            {isLoading ? 'Uploading...' : 'Upload Recorded Video'}
                                        </button>
                                    </>
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
