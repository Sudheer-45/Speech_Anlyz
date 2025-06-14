//
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import AuthenticatedNavbar from '../components/AuthenticatedNavbar';
import Footer from '../components/Footer';
import axios from 'axios';
import './ProfilePage.css'; // Make sure this CSS file exists with the styles

// Spinner component for loading state
const LoadingSpinner = () => (
    <div className="loading-overlay" aria-live="polite">
        <div className="spinner"></div>
        <span className="sr-only">Loading content...</span>
    </div>
);

function ProfilePage() {
  const [userProfile, setUserProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    const fetchUserProfile = async () => {
      try {
        const token = localStorage.getItem('token');
        if (!token) {
          setError('User not authenticated. Please log in.');
          setLoading(false);
          navigate('/login');
          return;
        }

        const response = await axios.get('https://comm-analyzer.onrender.com/api/user/profile', {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        // Access the 'user' property from response.data
        setUserProfile(response.data.user);
        // Simulate loading delay for UX
        setTimeout(() => {
          setLoading(false);
        }, 300);
      } catch (err) {
        console.error('Failed to fetch user profile:', err);
        setError(err.response?.data?.message || 'Failed to load profile.');
        setLoading(false);
        if (err.response?.status === 401 || err.response?.status === 403) {
          localStorage.removeItem('token');
          navigate('/login');
        }
      }
    };

    fetchUserProfile();
  }, [navigate]);

  const handleEditProfile = () => {
    navigate('/profile/edit');
  };

  const formatMemberSince = (dateString) => {
    if (!dateString) return 'N/A';
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    } catch (e) {
      console.error("Error formatting date:", e);
      return 'Invalid Date';
    }
  };

  const [isLoading, setIsLoading] = useState(true);
  
      useEffect(() => {
          // Simulate loading delay for UX
          const timer = setTimeout(() => {
              setIsLoading(false);
          }, 300);
          return () => clearTimeout(timer);
      }, []);
  
      if (isLoading) {
          return <LoadingSpinner />;
      }

  if (error) {
    return (
      <div className="profile-page-container">
        <AuthenticatedNavbar />
        <main className="profile-content">
          <p className="error-message">Error: {error}</p>
        </main>
        <Footer />
      </div>
    );
  }

  // Fallback to a better default if profilePictureUrl is missing or invalid
  const profilePictureUrl = userProfile?.profilePictureUrl || 'https://comm-analyzer.onrender.com/uploads/profile-images/default-user.png';
  const userName = userProfile?.username || 'N/A';
  const userEmail = userProfile?.email || 'N/A';
  const memberSince = formatMemberSince(userProfile?.createdAt);
  const userBio = userProfile?.bio || 'No bio provided yet. Click "Edit Profile Details" to add one!';

  return (
    <div className="profile-page-container">
      <AuthenticatedNavbar />
      <main className="profile-content">
        {userProfile && (
          <div className="profile-card">
            <div className="profile-picture-container">
              <img src={profilePictureUrl} alt="Profile" className="profile-picture" />
            </div>
            <h2 className="profile-name">{userName}</h2>
            <p className="profile-email">{userEmail}</p>
            <p className="profile-member-since">Member Since: {memberSince}</p>

            <div className="profile-bio-container">
              <h3>About Me</h3>
              <p className="profile-bio">{userBio}</p>
            </div>

            <button className="edit-profile-button" onClick={handleEditProfile}>
              Edit Profile Details
            </button>
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}

export default ProfilePage;
