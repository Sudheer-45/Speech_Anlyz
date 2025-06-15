import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext'; // Fix for useAuth error
import './Chatbot.css';

const RENDER_BACKEND_URL = "https://comm-analyzer.onrender.com";

function Chatbot({ isVisible, onClose }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recognition, setRecognition] = useState(null);
  const [expandedAnalysis, setExpandedAnalysis] = useState({});
  const messagesEndRef = useRef(null);
  const chatbotRef = useRef(null);
  const { recheckAuth } = useAuth(); // Access auth context
  const recordingTimeoutRef = useRef(null); // Timeout for recording

  // Auto-scroll to latest message
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Initialize Web Speech API
  useEffect(() => {
    if ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      const recog = new SpeechRecognition();
      recog.continuous = false;
      recog.interimResults = false;
      recog.lang = 'en-US';
      recog.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        setInput(transcript);
        setIsRecording(false);
        clearTimeout(recordingTimeoutRef.current);
        handleSendMessage(new Event('submit'), true); // Auto-send
      };
      recog.onerror = (event) => {
        console.error('Speech recognition error:', event.error);
        setMessages((prev) => [...prev, { sender: 'bot', text: `Speech recognition failed: ${event.error}. Please try again or type your message.` }]);
        setIsRecording(false);
        clearTimeout(recordingTimeoutRef.current);
      };
      recog.onend = () => {
        setIsRecording(false);
        clearTimeout(recordingTimeoutRef.current);
      };
      setRecognition(recog);
    } else {
      console.warn('Speech recognition not supported in this browser.');
    }
    return () => {
      recognition?.stop();
      clearTimeout(recordingTimeoutRef.current);
    };
  }, []);

  // Welcome message and cleanup
  useEffect(() => {
    if (isVisible && messages.length === 0) {
      setMessages([
        { sender: 'bot', text: "Hello! I'm your Comm Analyzer Chatbot. Ask me about communication, grammar, or record a speech for analysis!" }
      ]);
    }
    if (!isVisible) {
      setMessages([]);
      setInput('');
      setIsLoading(false);
      setIsRecording(false);
      setExpandedAnalysis({});
      recognition?.stop();
      clearTimeout(recordingTimeoutRef.current);
    }
  }, [isVisible, recognition]);

  // Focus management for accessibility
  useEffect(() => {
    if (isVisible) {
      chatbotRef.current?.focus();
    }
  }, [isVisible]);

  const handleSendMessage = async (e, isVoice = false) => {
    e.preventDefault();
    if (input.trim() === '' && !isVoice) return;

    const userMessage = { sender: 'user', text: input.trim() || '(Voice input)' };
    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const token = localStorage.getItem('token');
      if (!token) {
        setMessages((prev) => [...prev, { sender: 'bot', text: "Please log in to use the chatbot." }]);
        recheckAuth();
        setIsLoading(false);
        return;
      }

      const response = await axios.post(
        `${RENDER_BACKEND_URL}/api/chatbot/message`,
        { message: input.trim(), isVoice },
        { headers: { 'Authorization': `Bearer ${token}` } }
      );

      const { reply } = response.data;
      const botResponse = {
        sender: 'bot',
        text: typeof reply === 'string' ? reply : reply.text,
        analysis: typeof reply === 'object' ? reply.analysis : null
      };
      setMessages((prev) => [...prev, botResponse]);

    } catch (error) {
      console.error('Error sending message:', error);
      const errorMessage = error.response?.status === 401
        ? 'Session expired. Please log in again.'
        : error.response?.data?.message || 'Sorry, I am having trouble connecting right now. Please try again later.';
      setMessages((prev) => [...prev, { sender: 'bot', text: errorMessage }]);
      if (error.response?.status === 401) {
        localStorage.removeItem('token');
        recheckAuth();
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleVoiceInput = () => {
    if (!recognition) {
      setMessages((prev) => [...prev, { sender: 'bot', text: "Speech recognition is not supported in your browser. Please type your message." }]);
      return;
    }

    if (isRecording) {
      recognition.stop();
      clearTimeout(recordingTimeoutRef.current);
    } else {
      try {
        recognition.start();
        setIsRecording(true);
        // Set 10-second timeout to prevent infinite recording
        recordingTimeoutRef.current = setTimeout(() => {
          recognition.stop();
          setMessages((prev) => [...prev, { sender: 'bot', text: "Recording timed out. Please try again or type your message." }]);
        }, 10000);
      } catch (error) {
        console.error('Error starting speech recognition:', error);
        setMessages((prev) => [...prev, { sender: 'bot', text: "Failed to start recording. Please try again or type your message." }]);
        setIsRecording(false);
      }
    }
  };

  const toggleAnalysis = (index) => {
    setExpandedAnalysis((prev) => ({ ...prev, [index]: !prev[index] }));
  };

  if (!isVisible) return null;

  return (
    <div
      ref={chatbotRef}
      className="chatbot-container"
      role="dialog"
      aria-label="Comm Analyzer Chatbot"
      tabIndex={-1}
    >
      <div className="chatbot-header">
        <h2 className="chatbot-title">Comm Chatbot</h2>
        <button onClick={onClose} className="chatbot-close" aria-label="Close Chatbot">×</button>
      </div>
      <div className="chatbot-messages" aria-live="polite">
        {messages.map((msg, index) => (
          <div key={index} className={`message ${msg.sender === 'user' ? 'message-user' : 'message-bot'}`}>
            <span className="message-text">
              {msg.text}
              {msg.analysis && (
                <div className="analysis-card-container">
                  <button
                    onClick={() => toggleAnalysis(index)}
                    className="analysis-toggle"
                    aria-label={expandedAnalysis[index] ? 'Collapse analysis' : 'Expand analysis'}
                  >
                    {expandedAnalysis[index] ? 'Hide Analysis' : 'Show Analysis'}
                  </button>
                  {expandedAnalysis[index] && (
                    <div className="analysis-card">
                      <h3>Speech Analysis</h3>
                      {msg.analysis.grammar !== undefined ? (
                        <p><strong>Grammar Score:</strong> {msg.analysis.grammar}/100</p>
                      ) : (
                        <p><strong>Grammar:</strong> Not available</p>
                      )}
                      {msg.analysis.tone ? (
                        <p><strong>Tone:</strong> {msg.analysis.tone}</p>
                      ) : (
                        <p><strong>Tone:</strong> Not detected</p>
                      )}
                      {msg.analysis.tips && msg.analysis.tips.length > 0 ? (
                        <div>
                          <strong>Tips for Improvement:</strong>
                          <ul>
                            {msg.analysis.tips.map((tip, i) => <li key={i}>{tip}</li>)}
                          </ul>
                        </div>
                      ) : (
                        <p><strong>Tips:</strong> No suggestions available</p>
                      )}
                    </div>
                  )}
                </div>
              )}
            </span>
          </div>
        ))}
        {isLoading && (
          <div className="message message-bot">
            <span className="message-text animate-pulse">Analyzing...</span>
          </div>
        )}
        {isRecording && (
          <div className="message message-bot">
            <span className="message-text animate-pulse">Recording...</span>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>
      <form onSubmit={(e) => handleSendMessage(e, false)} className="chatbot-form">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type your message..."
          className="chatbot-input"
          disabled={isLoading || isRecording}
          aria-label="Type your message"
        />
        <button
          type="button"
          onClick={handleVoiceInput}
          className={`chatbot-voice ${isRecording ? 'recording' : ''}`}
          disabled={isLoading}
          aria-label={isRecording ? 'Stop recording' : 'Start voice input'}
        >
          🎙️
        </button>
        <button
          type="submit"
          className="chatbot-send"
          disabled={isLoading || isRecording || input.trim() === ''}
          aria-label="Send message"
        >
          Send
        </button>
      </form>
    </div>
  );
}

export default Chatbot;
