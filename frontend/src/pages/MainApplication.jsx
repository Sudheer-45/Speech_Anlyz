// frontend/src/pages/MainApplication.jsx
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import AuthenticatedNavbar from '../components/AuthenticatedNavbar';
import Footer from '../components/Footer';
import axios from 'axios';
import Webcam from 'react-webcam';
import './MainApplication.css'; // Ensure your CSS file is correctly linked

// Define video constraints for webcam
const videoConstraints = {
    width: 1280,
    height: 720,
    facingMode: "user" // 'user' for front camera, 'environment' for rear
};

// IMPORTANT: Replace with your actual Render backend URL
// Ensure this environment variable is set in your frontend deployment environment (e.g., Vercel)
const RENDER_BACKEND_URL = process.env.REACT_APP_BACKEND_URL || "https://comm-analyzer.onrender.com";

function MainApplication() {
    const navigate = useNavigate();
    const [message, setMessage] = useState('');
    const [isError, setIsError] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [videoName, setVideoName] = useState('');
    const [uploadedFile, setUploadedFile] = useState(null);

    // Webcam related states and refs
    const webcamRef = useRef(null);
    const mediaRecorderRef = useRef(null);
    const [isRecording, setIsRecording] = useState(false);
    const recordedChunksRef = useRef([]); // Stores chunks of recorded video
    const [recordedVideoBlob, setRecordedVideoBlob] = useState(null); // Final recorded video blob
    const [recordedVideoURL, setRecordedVideoURL] = useState(''); // URL for previewing recorded video
    const [showRecordedControls, setShowRecordedControls] = useState(false); // Shows preview/upload buttons for recorded video
    const [showWebcam, setShowWebcam] = useState(false); // Controls webcam visibility
    const [recordingAttemptStarted, setRecordingAttemptStarted] = useState(false); // Flag for user initiating recording
    const [recordedTime, setRecordedTime] = useState(0); // For recording timer
    const timerIntervalRef = useRef(null); // Ref for timer interval

    // Utility function to format time for the recording timer
    const formatTime = (totalSeconds) => {
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;
        return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    };

    /**
     * Handles the upload of a file (either from file input or recorded webcam video)
     * and navigates to the results page upon successful initiation of analysis.
     * @param {File} fileToUpload The File object to upload.
     * @param {string} nameForVideo The desired name for the video.
     */
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
        formData.append('video', fileToUpload); // 'video' matches the Multer field name in backend
        formData.append('videoName', nameForVideo || fileToUpload.name);

        try {
            const token = localStorage.getItem('token');
            if (!token) {
                // If token is missing, redirect to login
                setMessage('User not authenticated. Please log in.');
                setIsError(true);
                setIsLoading(false);
                navigate('/login');
                return;
            }

            console.log('Attempting to upload video to backend...');
            const uploadResponse = await axios.post(`${RENDER_BACKEND_URL}/api/upload`, formData, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'multipart/form-data' // Important for file uploads
                },
                onUploadProgress: (progressEvent) => {
                    const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
                    setMessage(`Uploading video: ${percentCompleted}%`);
                }
            });

            // Expected response contains videoRecordId and possibly videoUrl/publicId
            const { videoRecordId, videoUrl, videoName: uploadedVideoName, publicId, message: responseMessage, status: videoStatus } = uploadResponse.data;
            
            setMessage(responseMessage || 'Video upload initiated. Analysis will begin shortly.');
            
            // Clean up states after successful upload initiation
            setUploadedFile(null);
            setRecordedVideoBlob(null);
            if (recordedVideoURL) URL.revokeObjectURL(recordedVideoURL); // Revoke temporary URL
            setRecordedVideoURL('');
            recordedChunksRef.current = [];
            setShowRecordedControls(false);
            setVideoName(''); // Clear video name input

            // Navigate to results page, passing necessary data as state
            // The results page will then poll the backend for status updates
            console.log('Navigating to results with state:', { videoRecordId, videoUrl, videoName: uploadedVideoName, publicId, status: videoStatus });
            navigate('/app/results', { 
                state: { 
                    videoRecordId, 
                    videoUrl, // This might be null initially if webhook is used
                    videoName: uploadedVideoName, 
                    publicId, // This is key for webhook lookup
                    status: videoStatus // Initial status from backend
                } 
            });

        } catch (error) {
            console.error('Upload Error:', error);
            // Extract a more user-friendly error message
            const errorMessage = error.response?.data?.message || error.message || 'Video upload failed. Please try again.';
            setMessage(errorMessage);
            setIsError(true);
        } finally {
            setIsLoading(false); // Always set loading to false in finally block
        }
    };

    /**
     * Handles selection of a file from the file input.
     * @param {Event} e The change event from the file input.
     */
    const handleFileChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            setUploadedFile(file);
            // Set video name default if not already provided
            if (!videoName) {
                setVideoName(file.name.split('.')[0]);
            }
            // Reset recording states
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
            setMessage('');
            setIsError(false);
        }
    };

    /**
     * Callback for MediaRecorder when data is available (video chunks).
     * @param {BlobEvent} param0 Contains the Blob of recorded data.
     */
    const handleDataAvailable = useCallback(({ data }) => {
        if (data.size > 0) {
            recordedChunksRef.current.push(data);
            console.log('Data available:', data.size, 'bytes. Current chunks:', recordedChunksRef.current.length);
        }
    }, []);

    /**
     * Callback for Webcam component when user media (camera/mic) is successfully accessed.
     * @param {MediaStream} stream The media stream from the webcam.
     */
    const handleUserMedia = useCallback((stream) => {
        console.log('Webcam stream acquired:', stream);
        setMessage('Camera and microphone ready. Recording started.');
        setIsError(false);

        recordedChunksRef.current = []; // Clear previous chunks
        mediaRecorderRef.current = new MediaRecorder(stream, { mimeType: 'video/webm; codecs=vp8' }); // Standard WebM format

        mediaRecorderRef.current.addEventListener('dataavailable', handleDataAvailable);
        
        mediaRecorderRef.current.onstop = () => {
            console.log('MediaRecorder stopped. Processing chunks:', recordedChunksRef.current.length);
            const blob = new Blob(recordedChunksRef.current, { type: 'video/webm' });
            console.log('Blob created, size:', blob.size, 'bytes');

            if (blob.size === 0) {
                setMessage('No video data recorded. Please try again.');
                setIsError(true);
                setShowRecordedControls(false);
                setShowWebcam(false);
                setRecordingAttemptStarted(false);
                stream.getTracks().forEach(track => track.stop()); // Stop all tracks
                return;
            }

            setRecordedVideoBlob(blob);
            const url = URL.createObjectURL(blob); // Create a temporary URL for preview
            setRecordedVideoURL(url);
            setShowRecordedControls(true); // Show preview/upload buttons
            setMessage('Recording stopped. Preview available.');
            setIsError(false);

            stream.getTracks().forEach(track => track.stop()); // Stop all media tracks to release camera/mic
            setShowWebcam(false); // Hide webcam preview
            setRecordingAttemptStarted(false); // Reset recording attempt flag
        };

        mediaRecorderRef.current.start(); // Start recording
        setIsRecording(true); // Update recording state

        // Start recording timer
        setRecordedTime(0);
        timerIntervalRef.current = setInterval(() => {
            setRecordedTime(prev => prev + 1);
        }, 1000);
    }, [handleDataAvailable]);

    /**
     * Callback for Webcam component when user media access fails.
     * @param {DOMException} error The error object.
     */
    const handleUserMediaError = useCallback((error) => {
        console.error('Webcam access error:', error);
        setMessage(`Camera/mic access failed: ${error.name || error.message}. Please check permissions and try again.`);
        setIsError(true);
        setIsRecording(false);
        clearInterval(timerIntervalRef.current);
        setRecordedTime(0);
        setShowWebcam(false);
        setRecordingAttemptStarted(false);
    }, []);

    /**
     * Initiates webcam recording.
     */
    const startRecording = useCallback(() => {
        setMessage('');
        setIsError(false);
        setUploadedFile(null); // Clear any previously uploaded file
        setRecordedVideoBlob(null);
        if (recordedVideoURL) URL.revokeObjectURL(recordedVideoURL); // Clear previous recorded video URL
        setRecordedVideoURL('');
        recordedChunksRef.current = [];
        setShowRecordedControls(false);
        setRecordingAttemptStarted(true); // Indicate recording attempt has started
        setShowWebcam(true); // Show webcam component which will trigger user media access
    }, [recordedVideoURL]);

    /**
     * Stops the current webcam recording.
     */
    const stopRecording = useCallback(() => {
        setIsRecording(false);
        clearInterval(timerIntervalRef.current); // Stop the timer

        if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
            mediaRecorderRef.current.stop(); // Stop the media recorder
        }
    }, []);

    /**
     * Handles uploading the recorded video blob.
     */
    const handleUploadRecordedVideo = () => {
        if (recordedVideoBlob) {
            // Create a File object from the Blob
            const defaultName = `recorded_video_${new Date().toISOString().slice(0, 10)}.webm`;
            const recordedFile = new File([recordedVideoBlob], videoName || defaultName, { type: 'video/webm' });
            
            console.log('Uploading recorded file:', {
                name: recordedFile.name,
                type: recordedFile.type,
                size: recordedFile.size
            });

            handleUploadAndAnalyze(recordedFile, videoName); // Call the general upload function
        } else {
            setMessage('No recorded video available to upload.');
            setIsError(true);
        }
    };

    /**
     * Resets recording states to allow re-recording.
     */
    const handleRerecord = useCallback(() => {
        if (recordedVideoURL) URL.revokeObjectURL(recordedVideoURL); // Revoke old URL
        setRecordedVideoBlob(null);
        setRecordedVideoURL('');
        recordedChunksRef.current = [];
        setShowRecordedControls(false);
        setRecordedTime(0);
        setRecordingAttemptStarted(true); // Indicate new recording attempt
        setShowWebcam(true); // Show webcam again
        setMessage('');
        setIsError(false);
    }, [recordedVideoURL]);

    // Cleanup effect: Revoke object URLs and stop webcam tracks on component unmount
    useEffect(() => {
        return () => {
            clearInterval(timerIntervalRef.current); // Clear timer
            if (recordedVideoURL) {
                URL.revokeObjectURL(recordedVideoURL); // Clean up recorded video URL
            }
            // Stop webcam tracks if active
            if (webcamRef.current && webcamRef.current.stream) {
                webcamRef.current.stream.getTracks().forEach(track => track.stop());
            }
        };
    }, [recordedVideoURL]); // Dependency on recordedVideoURL to clean up old URLs

    return (
        <div className="main-app-container">
            <AuthenticatedNavbar />
            <main className="main-content">
                {/* Data-tilt attributes assumed to be handled by an external library like vanilla-tilt.js */}
                <h1 data-tilt data-tilt-max="10">Welcome to Your Comm Analyzer!</h1>
                
                <div className="website-info" data-tilt data-tilt-max="10">
                    <p>
                        This platform helps you enhance your communication skills by providing detailed analysis of your spoken English.
                        Whether you're preparing for an important interview, practicing a presentation, or just aiming for better fluency,
                        our intelligent analyzer offers insights into your grammar, filler words, speaking rate, and overall sentiment.
                    </p>
                    <p>
                        Simply upload a video of yourself speaking or record one directly using your webcam. You can even name your videos
                        to easily categorize your practice sessions (e.g., "Mock Interview - Google", "Presentation Rehearsal").
                        After analysis, you'll receive a comprehensive report that highlights areas for improvement, helping you speak
                        with more confidence and clarity.
                    </p>
                </div>

                <div className="video-input-options">
                    {/* Status Message Display */}
                    {message && (
                        <p id="status-message" className={`status-message ${isError ? 'error' : 'success'}`} data-tilt data-tilt-max="10">
                            {message}
                        </p>
                    )}

                    {/* Video Name Input */}
                    <div className="form-group video-name-group" data-tilt data-tilt-max="10">
                        <label htmlFor="videoName" className="form-label">Video Name</label>
                        <input
                            type="text"
                            id="videoName"
                            className="form-input"
                            value={videoName}
                            onChange={(e) => setVideoName(e.target.value)}
                            placeholder="e.g., Google Interview Practice"
                            disabled={isLoading || isRecording || recordingAttemptStarted}
                            aria-describedby={message ? 'status-message' : undefined}
                        />
                    </div>

                    <div className="upload-record-sections">
                        {/* Upload Existing Video Section */}
                        <section className="upload-section" data-tilt data-tilt-max="10">
                            <h2 data-tilt data-tilt-max="10">Upload Existing Video</h2>
                            <div className="form-group" data-tilt data-tilt-max="10">
                                <label htmlFor="videoFile" className="form-label"></label> {/* Label for file input */}
                                <input
                                    type="file"
                                    id="videoFile"
                                    accept="video/*" // Accept any video type
                                    onChange={handleFileChange}
                                    className={`file-input ${uploadedFile ? 'has-file' : ''}`}
                                    disabled={isLoading || isRecording || recordingAttemptStarted}
                                    aria-describedby={uploadedFile ? 'selected-file-info' : message ? 'status-message' : undefined}
                                />
                                {uploadedFile && (
                                    <p id="selected-file-info" className="selected-file-info">
                                        Selected: {uploadedFile.name} ({(uploadedFile.size / (1024 * 1024)).toFixed(2)} MB)
                                    </p>
                                )}
                            </div>
                            <button
                                type="button"
                                onClick={() => handleUploadAndAnalyze(uploadedFile, videoName)}
                                className="action-button upload-button"
                                disabled={!uploadedFile || isLoading || isRecording || recordingAttemptStarted || !videoName.trim()}
                                data-tilt
                                data-tilt-max="10"
                            >
                                {isLoading ? 'Uploading...' : 'Upload Video'}
                            </button>
                        </section>

                        {/* Record New Video Section */}
                        <section className="record-section" data-tilt data-tilt-max="10">
                            <h2 data-tilt data-tilt-max="10">Record New Video</h2>
                            <div className="video-area">
                                {showWebcam ? (
                                    // Webcam preview area
                                    <Webcam
                                        audio={true}
                                        muted={true} // Muting locally, audio will be in recorded blob
                                        ref={webcamRef}
                                        videoConstraints={videoConstraints}
                                        className="webcam-preview"
                                        mirrored={true} // Mirror the video for a more natural self-view
                                        onUserMedia={handleUserMedia} // Callback when webcam is ready
                                        onUserMediaError={handleUserMediaError} // Callback for webcam errors
                                    />
                                ) : recordedVideoURL ? (
                                    // Recorded video preview area
                                    <div className="recorded-preview-container">
                                        <h3>Recorded Preview</h3>
                                        <video src={recordedVideoURL} controls className="recorded-preview" />
                                    </div>
                                ) : (
                                    // Placeholder message when no video is selected/recorded
                                    <>
                                        <p className="no-video-message">Click "Start Recording" to begin.</p>
                                        <p className="no-video-message">Enter a video name to enable the record button.</p>
                                    </>
                                )}
                            </div>

                            <div className="recording-controls">
                                {/* Conditional rendering for recording buttons */}
                                {!isRecording && !showRecordedControls ? (
                                    // Start Recording button
                                    <button
                                        type="button"
                                        onClick={startRecording}
                                        className="action-button record-button"
                                        disabled={isLoading || uploadedFile || !videoName.trim()}
                                        data-tilt
                                        data-tilt-max="10"
                                        aria-label="Start recording video"
                                    >
                                        Start Recording
                                    </button>
                                ) : isRecording ? (
                                    // Stop Recording button and timer during recording
                                    <>
                                        <button
                                            type="button"
                                            onClick={stopRecording}
                                            className="action-button stop-record-button"
                                            disabled={isLoading}
                                            data-tilt
                                            data-tilt-max="10"
                                            aria-label="Stop recording video"
                                        >
                                            Stop Recording
                                        </button>
                                        <div className="recording-timer" data-tilt data-tilt-max="10">
                                            <span className="timer-icon">⏺️</span> Recording: {formatTime(recordedTime)}
                                        </div>
                                    </>
                                ) : showRecordedControls ? (
                                    // Re-record and Upload Recorded Video buttons after recording
                                    <>
                                        <button
                                            type="button"
                                            onClick={handleRerecord}
                                            className="action-button rerecord-button"
                                            disabled={isLoading}
                                            data-tilt
                                            data-tilt-max="10"
                                            aria-label="Re-record video"
                                        >
                                            Re-record
                                        </button>
                                        <button
                                            type="button"
                                            onClick={handleUploadRecordedVideo}
                                            className="action-button upload-recorded-button"
                                            disabled={!recordedVideoBlob || isLoading || !videoName.trim()}
                                            data-tilt
                                            data-tilt-max="10"
                                            aria-label="Upload recorded video"
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
