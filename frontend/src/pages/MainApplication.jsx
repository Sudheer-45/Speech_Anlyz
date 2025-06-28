import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import AuthenticatedNavbar from '../components/AuthenticatedNavbar'; // Ensure this path is correct
import Footer from '../components/Footer'; // Ensure this path is correct
import axios from 'axios';
import Webcam from 'react-webcam';
import './MainApplication.css'; // Ensure this path is correct for your CSS

const videoConstraints = {
    width: 1280,
    height: 720,
    facingMode: "user"
};

const RENDER_BACKEND_URL = "https://comm-analyzer.onrender.com";
const POLLING_INTERVAL = 3000; // 3 seconds
const MAX_POLLING_ATTEMPTS = 60; // Max attempts (60 * 3 seconds = 180 seconds = 3 minutes)

function MainApplication() {
    const navigate = useNavigate();
    const [message, setMessage] = useState('');
    const [isError, setIsError] = useState(false);
    const [isLoading, setIsLoading] = useState(false); // For upload/analysis initiation
    const [videoName, setVideoName] = useState('');
    const [uploadedFile, setUploadedFile] = useState(null); // For manual file upload
    
    // Webcam/Recording states
    const webcamRef = useRef(null);
    const mediaRecorderRef = useRef(null);
    const [isRecording, setIsRecording] = useState(false);
    const recordedChunksRef = useRef([]);
    const [recordedVideoBlob, setRecordedVideoBlob] = useState(null);
    const [recordedVideoURL, setRecordedVideoURL] = useState('');
    const [showRecordedControls, setShowRecordedControls] = useState(false);
    const [showWebcam, setShowWebcam] = useState(false);
    const [recordingAttemptStarted, setRecordingAttemptStarted] = useState(false); // To manage camera initiation
    const [recordedTime, setRecordedTime] = useState(0); // For recording timer
    const timerIntervalRef = useRef(null); // Ref for recording timer interval

    // Polling states and refs
    const pollingRef = useRef(null); // Ref for polling interval
    const pollingAttemptsRef = useRef(0); // Counter for polling attempts

    // Utility function to format time for display
    const formatTime = (totalSeconds) => {
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;
        return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    };

    // Function to stop any active polling interval
    const stopPolling = useCallback(() => {
        if (pollingRef.current) {
            clearInterval(pollingRef.current);
            pollingRef.current = null;
            console.log('Polling stopped.');
        }
        pollingAttemptsRef.current = 0; // Reset attempts counter
    }, []);

    // Function to check video status with the backend
    const checkVideoStatus = async (videoId) => {
        if (!videoId) {
            console.error('checkVideoStatus called with null/undefined videoId.');
            throw new Error('Video ID is missing for status check.');
        }
        try {
            const token = localStorage.getItem('token');
            if (!token) throw new Error('User not authenticated');

            // FIX: Corrected the polling URL to match backend route /api/status/:videoId
            const response = await axios.get(`${RENDER_BACKEND_URL}/api/status/${videoId}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            console.log(`Status for video ${videoId}:`, response.data.status);
            return response.data; // Returns { _id, videoName, status, videoUrl, errorMessage, analysisId, analysisData }
        } catch (error) {
            console.error('Status check API error:', error.response?.data?.message || error.message);
            throw error; // Re-throw to be caught by startPolling
        }
    };

    // Function to start the polling mechanism
    const startPolling = useCallback((videoId, videoName) => {
        stopPolling(); // Stop any pre-existing polling to prevent duplicates
        console.log(`Starting polling for video ID: ${videoId}`);

        pollingRef.current = setInterval(async () => {
            try {
                pollingAttemptsRef.current += 1;
                
                if (pollingAttemptsRef.current > MAX_POLLING_ATTEMPTS) {
                    stopPolling();
                    setMessage('Analysis is taking longer than expected. Please check back later or view your videos on the dashboard.');
                    setIsError(true);
                    return; // Exit polling loop
                }

                const statusResponse = await checkVideoStatus(videoId);
                setMessage(`Processing video (Status: ${statusResponse.status}). Attempt ${pollingAttemptsRef.current}/${MAX_POLLING_ATTEMPTS}...`);

                // Check final statuses
                if (statusResponse.status === 'analyzed') {
                    stopPolling();
                    setMessage('Video analysis completed!');
                    setIsError(false); // Clear error state on success
                    // Navigate to results page with all necessary data
                    navigate('/app/results', { 
                        state: { 
                            videoRecordId: videoId,
                            videoUrl: statusResponse.videoUrl, // Pass the final Cloudinary URL
                            videoName, // Pass the video name
                            analysisId: statusResponse.analysisId,
                            analysisData: statusResponse.analysisData // Pass the full analysis data object
                        } 
                    });
                } else if (statusResponse.status === 'failed') {
                    stopPolling();
                    setMessage(`Analysis failed: ${statusResponse.errorMessage || 'Unknown error'}. Please try again.`);
                    setIsError(true);
                } 
                // Display specific progress messages based on backend status
                else if (statusResponse.status === 'Cloudinary Uploading') {
                    setMessage(`Cloudinary Uploading (Attempt ${pollingAttemptsRef.current}/${MAX_POLLING_ATTEMPTS})...`);
                } else if (statusResponse.status === 'processing') {
                    setMessage(`Cloudinary Processing (Attempt ${pollingAttemptsRef.current}/${MAX_POLLING_ATTEMPTS})...`);
                } else if (statusResponse.status === 'analyzing') {
                    setMessage(`Analyzing Video (Attempt ${pollingAttemptsRef.current}/${MAX_POLLING_ATTEMPTS})...`);
                }
            } catch (error) {
                console.error('Polling error caught by interval:', error);
                // Stop polling definitively if max attempts reached or critical HTTP errors occur
                if (pollingAttemptsRef.current >= MAX_POLLING_ATTEMPTS || error.response?.status === 404 || error.response?.status === 403 || error.message === 'Video ID is missing for status check.') {
                    stopPolling();
                    setMessage(`Failed to check status: ${error.response?.data?.message || error.message}. Please refresh the page.`);
                    setIsError(true);
                } else {
                    setMessage(`Retrying status check... Attempt ${pollingAttemptsRef.current}/${MAX_POLLING_ATTEMPTS}`);
                }
            }
        }, POLLING_INTERVAL);
    }, [navigate, stopPolling]); // Include navigate and stopPolling in dependencies

    // Main function to handle both uploaded files and recorded videos for analysis
    const handleUploadAndAnalyze = async (fileToUpload, nameForVideo) => {
        setMessage('');
        setIsError(false);
        setIsLoading(true); // Start loading state

        if (!fileToUpload) {
            setMessage('No video file selected or recorded.');
            setIsError(true);
            setIsLoading(false);
            return;
        }

        const formData = new FormData();
        formData.append('video', fileToUpload); // 'video' must match Multer field name in backend
        formData.append('videoName', nameForVideo || fileToUpload.name);

        try {
            const token = localStorage.getItem('token');
            if (!token) throw new Error('User not authenticated. Please log in.');

            // Initial POST request to your backend's upload endpoint
            const uploadResponse = await axios.post(`${RENDER_BACKEND_URL}/api/upload`, formData, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'multipart/form-data' // Important for file uploads
                },
                // Progress event handler for upload percentage display
                onUploadProgress: (progressEvent) => {
                    const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
                    setMessage(`Uploading video: ${percentCompleted}%`);
                }
            });

            // FIX: Ensure videoRecordId is correctly destructured and captured
            const { videoRecordId, message: responseMessage } = uploadResponse.data;
            
            if (!videoRecordId) {
                // If backend doesn't return videoRecordId, it's a critical failure
                throw new Error('Backend did not return a video record ID after upload initiation.');
            }

            setMessage(responseMessage || 'Video upload initiated. Processing may take a few minutes...');
            cleanupAfterUpload(); // Reset UI elements after successful initiation
            
            // FIX: Pass the captured videoRecordId to startPolling
            startPolling(videoRecordId, nameForVideo || fileToUpload.name);

        } catch (error) {
            stopPolling(); // Always stop polling if initial upload fails
            handleUploadError(error); // Centralized error handling for upload
        } finally {
            setIsLoading(false); // End loading state
        }
    };

    // Resets states related to file upload and recorded video for a clean slate
    const cleanupAfterUpload = useCallback(() => {
        setUploadedFile(null);
        setRecordedVideoBlob(null);
        if (recordedVideoURL) URL.revokeObjectURL(recordedVideoURL); // Clean up Blob URL
        setRecordedVideoURL('');
        recordedChunksRef.current = []; // Clear recorded video chunks
        setShowRecordedControls(false); // Hide recorded video controls
        setVideoName(''); // Clear video name input
    }, [recordedVideoURL]); // Depend on recordedVideoURL for cleanup

    // Handles and displays errors encountered during upload or analysis initiation
    const handleUploadError = useCallback((error) => {
        const errorMessage = error.response?.data?.message || 
                             error.response?.data?.error || 
                             error.message || 
                             'Video operation failed. Please try again.';
        setMessage(errorMessage);
        setIsError(true);
        console.error('Upload/Analysis Error:', error);
    }, []);

    // Handles file selection for manual upload
    const handleFileChange = useCallback((e) => {
        const file = e.target.files[0];
        if (file) {
            setUploadedFile(file);
            if (!videoName) setVideoName(file.name.split('.')[0]); // Auto-fill video name
            resetRecordingState(); // Clear any recording states
            setMessage('');
            setIsError(false);
        }
    }, [videoName, resetRecordingState]);

    // Resets all recording-related states
    const resetRecordingState = useCallback(() => {
        setRecordedVideoBlob(null);
        if (recordedVideoURL) URL.revokeObjectURL(recordedVideoURL);
        setRecordedVideoURL('');
        recordedChunksRef.current = [];
        setShowRecordedControls(false);
        setShowWebcam(false);
        setIsRecording(false);
        setRecordingAttemptStarted(false);
        clearInterval(timerIntervalRef.current); // Stop recording timer
        setRecordedTime(0);
        stopPolling(); // Ensure polling is stopped if user starts new recording
    }, [recordedVideoURL, stopPolling]); // Include stopPolling in dependencies

    // Callback for when MediaRecorder has video data available
    const handleDataAvailable = useCallback(({ data }) => {
        if (data.size > 0) recordedChunksRef.current.push(data);
    }, []);

    // Callback for when webcam stream is successfully obtained
    const handleUserMedia = useCallback((stream) => {
        setMessage('Camera and microphone ready. Recording started.');
        setIsError(false);

        recordedChunksRef.current = [];
        mediaRecorderRef.current = new MediaRecorder(stream, { mimeType: 'video/webm; codecs=vp8' }); // Specify MIME type

        mediaRecorderRef.current.addEventListener('dataavailable', handleDataAvailable);
        mediaRecorderRef.current.onstop = () => {
            const blob = new Blob(recordedChunksRef.current, { type: 'video/webm' });

            if (blob.size === 0) {
                setMessage('No video data recorded. Please try again.');
                setIsError(true);
                setShowRecordedControls(false);
                setShowWebcam(false);
                setRecordingAttemptStarted(false);
                stream.getTracks().forEach(track => track.stop()); // Stop all media tracks
                return;
            }

            setRecordedVideoBlob(blob);
            setRecordedVideoURL(URL.createObjectURL(blob)); // Create URL for preview
            setShowRecordedControls(true); // Show preview controls
            setMessage('Recording stopped. Preview available.');
            setIsError(false);

            stream.getTracks().forEach(track => track.stop()); // Stop all media tracks
            setShowWebcam(false); // Hide webcam preview
            setRecordingAttemptStarted(false);
        };

        mediaRecorderRef.current.start(); // Start recording
        setIsRecording(true);

        // Start recording timer
        setRecordedTime(0);
        timerIntervalRef.current = setInterval(() => {
            setRecordedTime(prev => prev + 1);
        }, 1000);
    }, [handleDataAvailable]);

    // Callback for webcam access errors
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

    // Function to start recording via webcam
    const startRecording = useCallback(() => {
        setMessage('');
        setIsError(false);
        setUploadedFile(null); // Clear any uploaded file
        resetRecordingState(); // Reset recording state for a fresh start
        setRecordingAttemptStarted(true); // Indicate attempt to start webcam
        setShowWebcam(true); // Show webcam component
    }, [resetRecordingState]);

    // Function to stop recording via webcam
    const stopRecording = useCallback(() => {
        setIsRecording(false);
        clearInterval(timerIntervalRef.current); // Stop recording timer

        if (mediaRecorderRef.current?.state === 'recording') {
            mediaRecorderRef.current.stop(); // Stop MediaRecorder
        }
    }, []);

    // Handles uploading the recorded video blob
    const handleUploadRecordedVideo = useCallback(() => {
        if (recordedVideoBlob) {
            // Create a File object from the Blob for upload
            const defaultName = `recorded_video_${new Date().toISOString().slice(0, 10)}.webm`;
            const recordedFile = new File([recordedVideoBlob], videoName || defaultName, { type: 'video/webm' });
            handleUploadAndAnalyze(recordedFile, videoName);
        } else {
            setMessage('No recorded video available to upload.');
            setIsError(true);
        }
    }, [recordedVideoBlob, videoName, handleUploadAndAnalyze]);

    // Allows user to re-record
    const handleRerecord = useCallback(() => {
        resetRecordingState(); // Reset all states
        setRecordingAttemptStarted(true); // Start new recording attempt
        setShowWebcam(true); // Show webcam
        setMessage('');
        setIsError(false);
    }, [resetRecordingState]);

    // useEffect for cleanup on component unmount or URL changes
    useEffect(() => {
        return () => {
            stopPolling(); // Ensure polling stops when component unmounts
            clearInterval(timerIntervalRef.current); // Clear recording timer
            if (recordedVideoURL) URL.revokeObjectURL(recordedVideoURL); // Revoke recorded video object URL
            // Stop webcam tracks if active
            if (webcamRef.current?.stream) {
                webcamRef.current.stream.getTracks().forEach(track => track.stop());
            }
        };
    }, [recordedVideoURL, stopPolling]); // Dependencies for cleanup

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
                    {/* Message display for status/errors */}
                    {message && (
                        <p className={`status-message ${isError ? 'error' : 'success'}`}>
                            {message}
                        </p>
                    )}

                    {/* Video Name Input */}
                    <div className="form-group video-name-group">
                        <label htmlFor="videoName">Video Name</label>
                        <input
                            type="text"
                            id="videoName"
                            value={videoName}
                            onChange={(e) => setVideoName(e.target.value)}
                            placeholder="e.g., Google Interview Practice"
                            disabled={isLoading || isRecording || recordingAttemptStarted} // Disable while processing
                        />
                    </div>

                    {/* Upload and Record Sections */}
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
                                {/* Webcam Live Preview */}
                                {showWebcam ? (
                                    <Webcam
                                        audio={true}
                                        muted={true}
                                        ref={webcamRef}
                                        videoConstraints={videoConstraints}
                                        className="webcam-preview"
                                        mirrored={true} // Usually desired for self-view
                                        onUserMedia={handleUserMedia} // Callback for successful media access
                                        onUserMediaError={handleUserMediaError} // Callback for media access errors
                                    />
                                ) : recordedVideoURL ? (
                                    // Recorded Video Preview
                                    <div className="recorded-preview-container">
                                        <video src={recordedVideoURL} controls className="recorded-preview" />
                                    </div>
                                ) : (
                                    // Initial message when no video is uploaded/recorded
                                    <p className="no-video-message">
                                        {videoName.trim() ? 'Click "Start Recording" to begin' : 'Enter a video name to enable recording'}
                                    </p>
                                )}
                            </div>

                            {/* Recording Controls */}
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
