import React from 'react';
import { Link } from 'react-router-dom';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import './AboutPage.css';

function AboutPage() {
  return (
    <div className="about-page-container">
      <Navbar />
      <main className="about-content">
        <h1 data-tilt data-tilt-max="10">About Comm Analyzer</h1>
        <section className="about-section">
          <h2 data-tilt data-tilt-max="10">Our Mission</h2>
          <p>
            At Comm Analyzer, our mission is to empower individuals to communicate with confidence and clarity. We believe that effective communication is a cornerstone of success in every aspect of life, from personal relationships to professional endeavors. Our tool is designed to provide insightful and actionable feedback, helping you refine your speech, grammar, and conversational abilities.
          </p>
        </section>

        <section className="about-section">
          <h2 data-tilt data-tilt-max="10">Who We Are</h2>
          <p>
            We are a team passionate about leveraging technology to solve real-world problems. With backgrounds in artificial intelligence, linguistics, and user experience design, we built Comm Analyzer to be an intuitive and powerful platform for speech improvement. We are committed to continuous innovation, ensuring our analysis remains cutting-edge and beneficial for all users.
          </p>
        </section>

        <section className="about-section">
          <h2 data-tilt data-tilt-max="10">How We Help You Improve</h2>
          <ul>
            <li data-tilt data-tilt-max="10">
              <strong>Grammar & Syntax Correction:</strong> Identify and learn from grammatical errors, sentence structure issues, and word usage.
            </li>
            <li data-tilt data-tilt-max="10">
              <strong>Fluency & Pacing Analysis:</strong> Get insights into your speech rate, pauses, and filler words to achieve a smoother delivery.
            </li>
            <li data-tilt data-tilt-max="10">
              <strong>Vocabulary Enrichment:</strong> Receive suggestions to expand your lexicon and use more precise language.
            </li>
            <li data-tilt data-tilt-max="10">
              <strong>Conversational Skills:</strong> Understand nuances of tone, sentiment, and overall conversational flow to enhance engagement.
            </li>
            <li data-tilt data-tilt-max="10">
              <strong>Pronunciation Feedback:</strong> (Future Feature / Advanced AI) Get feedback on specific word pronunciations for clearer articulation.
            </li>
          </ul>
          <p>
            Our AI-powered analysis provides detailed reports, highlighting strengths and areas for improvement, enabling targeted practice and measurable progress.
          </p>
        </section>

        <section className="about-section">
          <h2 data-tilt data-tilt-max="10">Our Technology</h2>
          <p>
            Comm Analyzer is built using modern web technologies: a <strong>React + Vite</strong> frontend for a fast and interactive user interface, a <strong>Node.js + Express</strong> backend for robust API services, and <strong>MongoDB Atlas</strong> for flexible and scalable data storage. The core of our analysis relies on integrating with powerful <strong>Speech AI APIs</strong> to provide accurate and insightful feedback on your communication.
          </p>
        </section>

        <section className="about-section call-to-action">
          <h2 data-tilt data-tilt-max="10">Ready to transform your communication?</h2>
          <p>
            Join Comm Analyzer today and start your journey towards clearer, more confident speaking.
          </p>
          <div className="about-buttons">
            <Link to="/signup" className="about-signup-btn" data-tilt data-tilt-max="10">Sign Up Now</Link>
            <Link to="/login" className="about-login-btn" data-tilt data-tilt-max="10">Login</Link>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}

export default AboutPage;