import React from 'react';
import { Link } from 'react-router-dom';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import './HomePage.css';

function HomePage() {
  return (
    <div className="home-page">
      <Navbar />
      <div className="hero-section">
        <h1>Enhance Your Communication Skills</h1>
        <p>Get instant feedback on your speech, grammar, and presentation skills</p>
        <Link to="/signup" className="about-signup-btn">Get Started</Link>
      </div>
      <section className="overview-section">
        <h2>Why Choose Comm Analyzer?</h2>
        <div className="features-grid">
          <div className="feature-card">
            <h3>Instant Analysis</h3>
            <p>Get detailed feedback on your speech within minutes</p>
          </div>
          <div className="feature-card">
            <h3>Grammar Check</h3>
            <p>Advanced grammar analysis using LanguageTool API</p>
          </div>
          <div className="feature-card">
            <h3>Filler Word Detection</h3>
            <p>Identify and reduce filler words in your speech</p>
          </div>
          <div className="feature-card">
            <h3>Speaking Rate Analysis</h3>
            <p>Optimize your speaking pace for better communication</p>
          </div>
          <div className="feature-card">
            <h3>Sentiment Analysis</h3>
            <p>Understand the emotional tone of your speech</p>
          </div>
          <div className="feature-card">
            <h3>Progress Tracking</h3>
            <p>Monitor your improvement over time</p>
          </div>
        </div>
      </section>
      <Footer />
    </div>
  );
}

export default HomePage;
