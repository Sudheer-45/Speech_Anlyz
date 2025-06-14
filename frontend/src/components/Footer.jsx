import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './Footer.css';

const LoadingSpinner = () => (
  <div className="loading-overlay" aria-live="polite">
    <div className="spinner"></div>
    <span className="sr-only">Submitting feedback...</span>
  </div>
);

function Footer() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [feedbackType, setFeedbackType] = useState('General');
  const [message, setMessage] = useState('');
  const [rating, setRating] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [responseMessage, setResponseMessage] = useState('');
  const [isError, setIsError] = useState(false);

  const feedbackTypes = ['General', 'Bug', 'Feature Request', 'Support'];

  useEffect(() => {
    const token = localStorage.getItem('token');
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setResponseMessage('');
    setIsError(false);
    setIsSubmitting(true);

    try {
      const token = localStorage.getItem('token');
      if (!token) {
        setResponseMessage('Please log in to submit feedback.');
        setIsError(true);
        setIsSubmitting(false);
        return;
      }

      const response = await axios.post(
        'https://comm-analyzer.onrender.com/api/feedback/submit',
        { feedbackType, message, rating },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setResponseMessage(response.data.message || 'Feedback submitted successfully!');
      setFeedbackType('General');
      setMessage('');
      setRating(0);
      setTimeout(() => {
        setIsModalOpen(false);
        setResponseMessage('');
      }, 2000);
    } catch (err) {
      console.error('Feedback error:', err.response?.status, err.response?.data);
      setResponseMessage(err.response?.data?.message || 'Failed to submit feedback.');
      setIsError(true);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRating = (value) => setRating(value);

  const closeModal = () => {
    setIsModalOpen(false);
    setResponseMessage('');
    setIsError(false);
    setFeedbackType('General');
    setMessage('');
    setRating(0);
  };

  return (
    <>
      <footer className="footer">
        <div className="footer-content">
          <div className="footer-brand" data-tilt>
            <h3>Comm Analyzer</h3>
            <p>Empowering communication insights with AI.</p>
          </div>
          <div className="footer-info" data-tilt>
            <div className="footer-contact">
              <p className="contact-title">Contact Us:</p>
              <div className="contact-details">
                <p>Email: <a href="mailto:commanalyzer@gmail.com">commanalyzer@gmail.com</a></p>
                <p>Phone: <a href="tel:+919505813015">+91 9505813015</a></p>
              </div>
            </div>
            <div className="footer-social">
              <p>Follow Us:</p>
              <div className="social-links">
                <a href="https://x.com/commanalyzer" target="_blank" rel="noopener noreferrer" aria-label="Twitter/X">
                  <i className="fab fa-x-twitter"></i>
                </a>
                <a href="https://www.linkedin.com/in/sai-sudheer-manukonda-2715a4282" target="_blank" rel="noopener noreferrer" aria-label="LinkedIn">
                  <i className="fab fa-linkedin"></i>
                </a>
                <a href="https://github.com/Sudheer-45" target="_blank" rel="noopener noreferrer" aria-label="GitHub">
                  <i className="fab fa-github"></i>
                </a>
              </div>
            </div>
          </div>
          <ul className="footer-links">
            <li><a href="/privacy" data-tilt data-tilt-max="10">Privacy Policy</a></li>
            <li><a href="/terms" data-tilt data-tilt-max="10">Terms of Service</a></li>
            <li><a href="/cookies" data-tilt data-tilt-max="10">Cookie Policy</a></li>
            <li>
              <button
                className="footer-feedback-btn"
                onClick={() => setIsModalOpen(true)}
                aria-label="Open feedback form"
                data-tilt
                data-tilt-max="10"
              >
                Give Feedback
              </button>
            </li>
          </ul>
          <p className="footer-copyright">
            © {new Date().getFullYear()} Comm Analyzer. All rights reserved.
          </p>
        </div>
      </footer>

      {isModalOpen && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} data-tilt>
            {isSubmitting ? (
              <LoadingSpinner />
            ) : (
              <>
                <span className="close-button" onClick={closeModal}>×</span>
                <h2>Send Your Feedback</h2>
                {responseMessage && (
                  <p className={`feedback-message ${isError ? 'error' : 'success'}`}>
                    {responseMessage}
                  </p>
                )}
                <form onSubmit={handleSubmit} className="feedback-form">
                  <div className="form-group">
                    <label htmlFor="feedbackType">Feedback Type:</label>
                    <select
                      id="feedbackType"
                      value={feedbackType}
                      onChange={(e) => setFeedbackType(e.target.value)}
                      disabled={isSubmitting}
                    >
                      {feedbackTypes.map((type) => (
                        <option key={type} value={type}>
                          {type}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label htmlFor="message">Your Feedback:</label>
                    <textarea
                      id="message"
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      required
                      placeholder="Tell us your thoughts..."
                      rows="5"
                      disabled={isSubmitting}
                    />
                  </div>
                  <div className="form-group">
                    <label>Rating (Optional):</label>
                    <div className="star-rating">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <span
                          key={star}
                          className={`star ${rating >= star ? 'filled' : ''}`}
                          onClick={() => !isSubmitting && handleRating(star)}
                          aria-label={`Rate ${star} star${star > 1 ? 's' : ''}`}
                        >
                          ★
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="form-actions">
                    <button
                      type="submit"
                      className="submit-btn"
                      disabled={isSubmitting || !message.trim()}
                      data-tilt
                      data-tilt-max="10"
                    >
                      {isSubmitting ? 'Submitting...' : 'Submit Feedback'}
                    </button>
                    <button
                      type="button"
                      className="cancel-btn"
                      onClick={closeModal}
                      disabled={isSubmitting}
                      data-tilt
                      data-tilt-max="10"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}

export default Footer;
