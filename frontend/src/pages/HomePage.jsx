import React from 'react';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import './HomePage.css';

function HomePage() {
  return (
    <div className="homepage-container">
      <Navbar />
      <main className="homepage-content">
        <div className="hero-section" data-tilt>
          <h1>Welcome to Comm Analyzer!</h1>
          <p>Your personal assistant for improving speech, grammar, and conversational skills.</p>
          <a href="/signup" className="cta-button" data-tilt data-tilt-max="10">Get Started</a>
        </div>
        <section className="overview-section" data-tilt>
          <div className="section-inner">
            <h2>How It Works</h2>
            <p>
              Comm Analyzer allows you to upload videos or record yourself speaking. Our advanced AI analyzes your audio for clarity, grammar errors, vocabulary usage, and overall conversational flow.
            </p>
            <p>
              Get instant, detailed feedback to identify areas for improvement and track your progress over time. Whether you're preparing for a presentation, an interview, or just want to speak more confidently, we've got you covered.
            </p>
          </div>
        </section>
        <section className="features-section">
          <h2>Key Features</h2>
          <div className="features-grid">
            <div className="feature-card" data-tilt data-tilt-max="10">
              <span className="feature-icon">🎙️</span>
              <h3>Speech Clarity Analysis</h3>
              <p>Evaluate pronunciation and articulation for crystal-clear communication.</p>
            </div>
            <div className="feature-card" data-tilt data-tilt-max="10">
              <span className="feature-icon">✍️</span>
              <h3>Grammar and Syntax Correction</h3>
              <p>Identify and fix grammatical errors to enhance your speech.</p>
            </div>
            <div className="feature-card" data-tilt data-tilt-max="10">
              <span className="feature-icon">📚</span>
              <h3>Vocabulary Enrichment</h3>
              <p>Get suggestions to diversify and strengthen your word choice.</p>
            </div>
            <div className="feature-card" data-tilt data-tilt-max="10">
              <span className="feature-icon">⏱️</span>
              <h3>Fluency and Pace Tracking</h3>
              <p>Monitor your speaking speed and flow for natural delivery.</p>
            </div>
            <div className="feature-card" data-tilt data-tilt-max="10">
              <span className="feature-icon">😊</span>
              <h3>Sentiment and Tone Analysis</h3>
              <p>Understand the emotional impact of your speech.</p>
            </div>
            <div className="feature-card" data-tilt data-tilt-max="10">
              <span className="feature-icon">📊</span>
              <h3>Progress Tracking Dashboard</h3>
              <p>Visualize your improvement with detailed analytics.</p>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}

export default HomePage;