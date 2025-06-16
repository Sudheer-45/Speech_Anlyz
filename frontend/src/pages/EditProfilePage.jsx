import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import AuthenticatedNavbar from '../components/AuthenticatedNavbar';
import Footer from '../components/Footer';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import './EditProfilePage.css';

// IMPORTANT: Your Render Backend URL - ensure this matches your deployed backend
const RENDER_BACKEND_URL = "https://comm-analyzer.onrender.com"; 

function EditProfilePage() {
    // State for form fields
    const [username, setUsername] = useState('');
    const [email, setEmail] = useState('');
    const [bio, setBio] = useState('');
    // State for the File object selected by user
    const [profileImageFile, setProfileImageFile] = useState(null); // Correct state variable name
    // State for the URL to display the image preview (local Blob URL or fetched URL)
    const [profileImagePreview, setProfileImagePreview] = useState(null);
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');

    // State for UI feedback
    const [message, setMessage] = useState('');
    const [isError, setIsError] = useState(false);
    const [isLoading, setIsLoading] = useState(true); // Used for initial load and form submission

    const navigate = useNavigate();
    const { recheckAuth } = useAuth();

    // Effect to fetch current user profile data when the component mounts
    useEffect(() => {
        const fetchUserProfile = async () => {
            try {
                const token = localStorage.getItem('token');
                if (!token) {
                    setMessage('User not authenticated. Please log in.');
                    setIsError(true);
                    setIsLoading(false);
                    navigate('/login');
                    return;
                }

                const response = await axios.get(`${RENDER_BACKEND_URL}/api/user/profile`, {
                    headers: {
                        Authorization: `Bearer ${token}`,
                    },
                });

                const userData = response.data.user;
                setUsername(userData.username || '');
                setEmail(userData.email || '');
                setBio(userData.bio || '');
                // Set preview directly from fetched URL. If null/undefined, set to null.
                setProfileImagePreview(userData.profilePictureUrl || null);

                setIsLoading(false);
            } catch (err) {
                console.error('Failed to fetch user profile for editing:', err);
                setMessage(err.response?.data?.message || 'Failed to load profile for editing.');
                setIsError(true);
                setIsLoading(false);
                if (err.response?.status === 401 || err.response?.status === 403) {
                    localStorage.removeItem('token');
                    navigate('/login');
                }
            }
        };

        fetchUserProfile();

        // Cleanup function for object URLs to prevent memory leaks
        return () => {
            if (profileImagePreview && profileImagePreview.startsWith('blob:')) {
                URL.revokeObjectURL(profileImagePreview);
                console.log("DEBUG: Revoked object URL:", profileImagePreview);
            }
        };
    }, [navigate]);

    // Handler for file input change
    const handleFileChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            setProfileImageFile(file); // Correct setter used

            // Clean up the previous object URL if it exists to avoid memory leaks
            if (profileImagePreview && profileImagePreview.startsWith('blob:')) {
                URL.revokeObjectURL(profileImagePreview);
                console.log("DEBUG: Revoked old object URL before creating new one:", profileImagePreview);
            }

            // Create a new local URL for image preview (Blob URL)
            const newPreviewUrl = URL.createObjectURL(file);
            setProfileImagePreview(newPreviewUrl);
            console.log("DEBUG: Profile image preview updated to NEW BLOB URL:", newPreviewUrl);

        } else {
            setProfileImageFile(null); // Correct setter used
            // If no file is selected, clear the preview.
            if (profileImagePreview && profileImagePreview.startsWith('blob:')) {
                URL.revokeObjectURL(profileImagePreview);
            }
            setProfileImagePreview(null); 
            console.log("DEBUG: No file selected, profile image preview cleared.");
        }
    };

    // Handler for saving changes
    const handleSaveChanges = async (e) => {
        e.preventDefault();
        setMessage('');
        setIsError(false);
        setIsLoading(true);

        if (password && password !== confirmPassword) {
            setMessage('New password and confirm password do not match.');
            setIsError(true);
            setIsLoading(false);
            return;
        }

        let finalProfilePictureUrl = profileImagePreview; 

        try {
            const token = localStorage.getItem('token');
            if (!token) {
                setMessage('You must be logged in to update your profile.');
                setIsError(true);
                setIsLoading(false);
                return;
            }

            // --- STEP 1: Upload new profile image to Cloudinary if selected ---
            if (profileImageFile) {
                const formData = new FormData();
                formData.append('profileImage', profileImageFile); 

                setMessage('Uploading image...');
                const uploadResponse = await axios.post(`${RENDER_BACKEND_URL}/api/upload/profile-image`, formData, {
                    headers: {
                        'Content-Type': 'multipart/form-data',
                        'Authorization': `Bearer ${token}`
                    },
                });
                finalProfilePictureUrl = uploadResponse.data.imageUrl; 
                console.log("DEBUG: Image uploaded to backend, received Cloudinary URL:", finalProfilePictureUrl);
                setProfileImageFile(null); // <--- FIXED: Use setProfileImageFile here
            }
            // --- END STEP 1 ---
            
            setMessage('Updating profile...');
            const updateData = {
                username,
                email,
                bio,
                profilePictureUrl: finalProfilePictureUrl 
            };
            if (password) {
                updateData.password = password;
            }

            const response = await axios.put(`${RENDER_BACKEND_URL}/api/user/profile`, updateData, {
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                }
            });

            setMessage(response.data.message || 'Profile updated successfully!');
            setIsError(false);
            setIsLoading(false);

            setPassword('');
            setConfirmPassword('');

            recheckAuth(); 

            setTimeout(() => {
                navigate('/app/profile');
            }, 1500);

        } catch (error) {
            console.error('Profile update error:', error.response?.data || error);
            setMessage(error.response?.data?.message || 'Failed to update profile. Please try again.');
            setIsError(true);
            setIsLoading(false);
        }
    };

    const handleCancel = () => {
        navigate('/app/profile');
    };

    if (isLoading && !message) {
        return (
            <div className="edit-profile-page-container">
                <AuthenticatedNavbar />
                <main className="edit-profile-content">
                    <h1>Loading Profile...</h1>
                    <p>Please wait while your profile data is being loaded.</p>
                </main>
                <Footer />
            </div>
        );
    }

    return (
        <div className="edit-profile-page-container">
            <AuthenticatedNavbar />
            <main className="edit-profile-content">
                <h1>Edit Your Profile</h1>

                {message && (
                    <p className={`status-message ${isError ? 'error-message' : 'success-message'}`}>
                        {message}
                    </p>
                )}

                <form onSubmit={handleSaveChanges} className="edit-form-placeholder">

                    <div className="form-group file-upload-group">
                        <label htmlFor="profileImage" className="file-upload-label">
                            Profile Image:
                        </label>
                        <input
                            type="file"
                            id="profileImage"
                            accept="image/*"
                            onChange={handleFileChange}
                            disabled={isLoading}
                            style={{ display: 'none' }}
                        />
                        {profileImagePreview && (
                            <div className="profile-picture-preview">
                                <img
                                    src={profileImagePreview}
                                    alt="Profile Preview"
                                    onError={(e) => {
                                        e.target.style.display = 'none';
                                        e.target.onerror = null;
                                    }}
                                />
                            </div>
                        )}
                        {!profileImagePreview && !profileImageFile && (
                            <div className="no-image-placeholder">No image selected</div>
                        )}
                        {profileImageFile && <span className="file-name">{profileImageFile.name}</span>}
                        <button
                            type="button"
                            className="upload-button"
                            onClick={() => document.getElementById('profileImage').click()}
                            disabled={isLoading}
                        >
                            Choose Image
                        </button>
                    </div>
                    
                    <div className="form-group">
                        <label htmlFor="username">Username:</label>
                        <input
                            type="text"
                            id="username"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            disabled={isLoading}
                            required
                        />
                    </div>

                    <div className="form-group">
                        <label htmlFor="email">Email:</label>
                        <input
                            type="email"
                            id="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            disabled={isLoading}
                            required
                        />
                    </div>

                    <div className="form-group">
                        <label htmlFor="bio">Bio:</label>
                        <textarea
                            id="bio"
                            value={bio}
                            onChange={(e) => setBio(e.target.value)}
                            placeholder="Tell us a little about yourself..."
                            disabled={isLoading}
                            rows="4"
                        ></textarea>
                    </div>

                    <p className="password-change-info">
                        Leave password fields blank if you don't want to change it.
                    </p>

                    <div className="form-group">
                        <label htmlFor="password">New Password:</label>
                        <input
                            type="password"
                            id="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="Enter new password (optional)"
                            disabled={isLoading}
                        />
                    </div>

                    <div className="form-group">
                        <label htmlFor="confirmPassword">Confirm New Password:</label>
                        <input
                            type="password"
                            id="confirmPassword"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            placeholder="Confirm new password"
                            disabled={isLoading}
                        />
                    </div>

                    <div className="form-actions">
                        <button
                            type="submit"
                            className="save-changes-button"
                            disabled={isLoading}
                        >
                            {isLoading ? 'Saving...' : 'Save Changes'}
                        </button>
                        <button
                            type="button"
                            className="cancel-button"
                            onClick={handleCancel}
                            disabled={isLoading}
                        >
                            Cancel
                        </button>
                    </div>
                </form>
            </main>
            <Footer />
        </div>
    );
}

export default EditProfilePage;
