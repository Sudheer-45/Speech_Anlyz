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
    const isMounted = useRef(true);

    const formatTime = (totalSeconds) => {
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;
        return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    };

    const handleUploadAndAnalyze = useCallback(async (fileToUpload, nameForVideo) => {
        if (!isMounted.current) return;

        setMessage('');
        setIsError(false);
        setIsLoading(true);

        if (!fileToUpload) {
            if (isMounted.current) {
                setMessage('No video file selected or recorded.');
                setIsError(true);
                setIsLoading(false);
            }
            return;
        }

        const formData = new FormData();
        formData.append('video', fileToUpload);
        formData.append('videoName', nameForVideo || fileToUpload.name);

        try {
            const token = localStorage.getItem('token');
            if (!token) {
                throw new Error('User not authenticated. Please log in.');
            }

            const uploadResponse = await axios.post(`${RENDER_BACKEND_URL}/api/upload`, formData, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'multipart/form-data'
                },
                onUploadProgress: (progressEvent) => {
                    if (isMounted.current) {
                        const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
                        setMessage(`Uploading video: ${percentCompleted}%`);
                    }
                }
            });

            if (isMounted.current) {
                const { videoRecordId, videoUrl, message: responseMessage } = uploadResponse.data;
                
                setMessage(responseMessage || 'Video uploaded successfully. Analysis in progress.');
                setUploadedFile(null);
                setRecordedVideoBlob(null);
                if (recordedVideoURL) URL.revokeObjectURL(recordedVideoURL);
                setRecordedVideoURL('');
                recordedChunksRef.current = [];
                setShowRecordedControls(false);
                setVideoName('');

                navigate('/app/results', { 
                    state: { 
                        videoRecordId, 
                        videoUrl, 
                        videoName: nameForVideo || fileToUpload.name 
                    } 
                });
            }
        } catch (error) {
            if (isMounted.current) {
                const errorMessage = error.response?.data?.message || error.message || 'Video upload failed. Please try again.';
                setMessage(errorMessage);
                setIsError(true);
                console.error('Upload Error:', error);
            }
        } finally {
            if (isMounted.current) {
                setIsLoading(false);
            }
        }
    }, [navigate, recordedVideoURL]);

    const handleFileChange = useCallback((e) => {
        const file = e.target.files[0];
        if (file) {
            if (isMounted.current) {
                setUploadedFile(file);
                if (!videoName) {
                    setVideoName(file.name.split('.')[0]);
                }
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
        }
    }, [recordedVideoURL, videoName]);

    const handleDataAvailable = useCallback(({ data }) => {
        if (data.size > 0) {
            recordedChunksRef.current.push(data);
        }
    }, []);

    const handleUserMedia = useCallback((stream) => {
        if (!isMounted.current) {
            stream.getTracks().forEach(track => track.stop());
            return;
        }

        setMessage('Camera and microphone ready. Recording started.');
        setIsError(false);

        recordedChunksRef.current = [];
        mediaRecorderRef.current = new MediaRecorder(stream, { 
            mimeType: 'video/webm; codecs=vp8',
            audioBitsPerSecond: 128000,
            videoBitsPerSecond: 2500000
        });

        mediaRecorderRef.current.addEventListener('dataavailable', handleDataAvailable);
        mediaRecorderRef.current.onstop = () => {
            const blob = new Blob(recordedChunksRef.current, { type: 'video/webm' });

            if (blob.size === 0) {
                if (isMounted.current) {
                    setMessage('No video data recorded. Please try again.');
                    setIsError(true);
                    setShowRecordedControls(false);
                    setShowWebcam(false);
                    setRecordingAttemptStarted(false);
                }
                stream.getTracks().forEach(track => track.stop());
                return;
            }

            if (isMounted.current) {
                setRecordedVideoBlob(blob);
                const url = URL.createObjectURL(blob);
                setRecordedVideoURL(url);
                setShowRecordedControls(true);
                setMessage('Recording stopped. Preview available.');
                setIsError(false);
                setShowWebcam(false);
                setRecordingAttemptStarted(false);
            }

            stream.getTracks().forEach(track => track.stop());
        };

        mediaRecorderRef.current.start(1000); // Collect data every second
        setIsRecording(true);

        setRecordedTime(0);
        timerIntervalRef.current = setInterval(() => {
            if (isMounted.current) {
                setRecordedTime(prev => prev + 1);
            }
        }, 1000);
    }, [handleDataAvailable]);

    const handleUserMediaError = useCallback((error) => {
        if (isMounted.current) {
            console.error('Webcam access error:', error);
            setMessage(`Camera/mic access failed: ${error.name || error.message}. Check permissions.`);
            setIsError(true);
            setIsRecording(false);
            clearInterval(timerIntervalRef.current);
            setRecordedTime(0);
            setShowWebcam(false);
            setRecordingAttemptStarted(false);
        }
    }, []);

    const startRecording = useCallback(() => {
        if (!isMounted.current) return;

        setMessage('');
        setIsError(false);
        setUploadedFile(null);
        setRecordedVideoBlob(null);
        if (recordedVideoURL) URL.revokeObjectURL(recordedVideoURL);
        setRecordedVideoURL('');
        recordedChunksRef.current = [];
        setShowRecordedControls(false);
        setRecordingAttemptStarted(true);
        setShowWebcam(true);
    }, [recordedVideoURL]);

    const stopRecording = useCallback(() => {
        if (!isMounted.current) return;

        setIsRecording(false);
        clearInterval(timerIntervalRef.current);

        if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
            mediaRecorderRef.current.stop();
        }
    }, []);

    const handleUploadRecordedVideo = useCallback(() => {
        if (!recordedVideoBlob) {
            if (isMounted.current) {
                setMessage('No recorded video available.');
                setIsError(true);
            }
            return;
        }

        const defaultName = `recorded_video_${new Date().toISOString().slice(0, 10)}.webm`;
        const recordedFile = new File([recordedVideoBlob], videoName || defaultName, { 
            type: 'video/webm',
            lastModified: Date.now()
        });

        handleUploadAndAnalyze(recordedFile, videoName);
    }, [recordedVideoBlob, videoName, handleUploadAndAnalyze]);

    const handleRerecord = useCallback(() => {
        if (!isMounted.current) return;

        if (recordedVideoURL) URL.revokeObjectURL(recordedVideoURL);
        setRecordedVideoBlob(null);
        setRecordedVideoURL('');
        recordedChunksRef.current = [];
        setShowRecordedControls(false);
        setRecordedTime(0);
        setRecordingAttemptStarted(true);
        setShowWebcam(true);
        setMessage('');
        setIsError(false);
    }, [recordedVideoURL]);

    useEffect(() => {
        return () => {
            isMounted.current = false;
            clearInterval(timerIntervalRef.current);
            if (recordedVideoURL) URL.revokeObjectURL(recordedVideoURL);
            if (webcamRef.current?.stream) {
                webcamRef.current.stream.getTracks().forEach(track => track.stop());
            }
            if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
                mediaRecorderRef.current.stop();
            }
        };
    }, [recordedVideoURL]);

    return (
        <div className="main-app-container">
            <AuthenticatedNavbar />
            <main className="main-content">
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
                    {message && (
                        <p id="status-message" className={`status-message ${isError ? 'error' : 'success'}`} data-tilt data-tilt-max="10">
                            {message}
                        </p>
                    )}

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
                            maxLength={50}
                        />
                    </div>

                    <div className="upload-record-sections">
                        <section className="upload-section" data-tilt data-tilt-max="10">
                            <h2 data-tilt data-tilt-max="10">Upload Existing Video</h2>
                            <div className="form-group" data-tilt data-tilt-max="10">
                                <label htmlFor="videoFile" className="form-label"></label>
                                <input
                                    type="file"
                                    id="videoFile"
                                    accept="video/*"
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

                        <section className="record-section" data-tilt data-tilt-max="10">
                            <h2 data-tilt data-tilt-max="10">Record New Video</h2>
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
                                        screenshotFormat="image/webp"
                                    />
                                ) : recordedVideoURL ? (
                                    <div className="recorded-preview-container">
                                        <h3>Recorded Preview</h3>
                                        <video src={recordedVideoURL} controls className="recorded-preview" />
                                        <p className="video-size-info">
                                            {(recordedVideoBlob.size / (1024 * 1024)).toFixed(2)} MB
                                        </p>
                                    </div>
                                ) : (
                                    <>
                                        <p className="no-video-message">Click "Start Recording" to begin.</p>
                                        <p className="no-video-message">Enter a video name to enable the button.</p>
                                    </>
                                )}
                            </div>

                            <div className="recording-controls">
                                {!isRecording && !showRecordedControls ? (
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
