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
    // State for the File object selected by user for upload
    const [profileImageFile, setProfileImageFile] = useState(null);
    // State for the URL to display the image preview (local Blob URL or fetched Cloudinary URL)
    const [profileImagePreview, setProfileImagePreview] = useState(null);
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');

    // State for UI feedback
    const [message, setMessage] = useState('');
    const [isError, setIsError] = useState(false);
    const [isLoading, setIsLoading] = useState(true); // Used for initial load and form submission

    const navigate = useNavigate();
    const { recheckAuth } = useAuth(); // Assuming recheckAuth updates user context/local storage

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
        // This will run when the component unmounts or before the effect re-runs
        return () => {
            if (profileImagePreview && profileImagePreview.startsWith('blob:')) {
                URL.revokeObjectURL(profileImagePreview);
                console.log("DEBUG: Revoked object URL:", profileImagePreview); // Log cleanup
            }
        };
    }, [navigate]); // Added navigate to dependency array for best practice

    // Handler for file input change
    const handleFileChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            setProfileImageFile(file);

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
            setProfileImageFile(null);
            // If no file is selected, clear the preview.
            // A more complex logic might revert to the original fetched image if it exists.
            if (profileImagePreview && profileImagePreview.startsWith('blob:')) {
                URL.revokeObjectURL(profileImagePreview); // Revoke the current object URL
            }
            // IMPORTANT: If user clears the file input, and there was an old Cloudinary URL,
            // we should set profileImagePreview back to the original fetched URL or null
            // if they want to explicitly remove it. For now, setting to null.
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

        // Initialize with the current profile image URL from state (could be fetched or a local blob)
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
                formData.append('profileImage', profileImageFile); // 'profileImage' must match backend's Multer field name

                setMessage('Uploading image...');
                const uploadResponse = await axios.post(`${RENDER_BACKEND_URL}/api/upload/profile-image`, formData, {
                    headers: {
                        'Content-Type': 'multipart/form-data', // Crucial for file uploads
                        'Authorization': `Bearer ${token}`
                    },
                });
                finalProfilePictureUrl = uploadResponse.data.imageUrl; // Get the Cloudinary URL from the response
                console.log("DEBUG: Image uploaded to backend, received Cloudinary URL:", finalProfilePictureUrl);
                setSelectedFile(null); // Clear the selected file after successful upload
            }
            // --- END STEP 1 ---

            // --- STEP 2: Update user profile with new (or existing) profilePictureUrl ---
            // If `profileImageFile` was NOT selected, `finalProfilePictureUrl` will retain
            // the value it had before this block (either the original fetched URL or null).
            // If user explicitly wants to clear image, set profileImagePreview to null via button/logic
            // and `finalProfilePictureUrl` will become null.
            
            setMessage('Updating profile...');
            const updateData = {
                username,
                email,
                bio,
                // Send the Cloudinary URL (if new image uploaded),
                // or the existing Cloudinary URL, or null if cleared.
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

            // After successful update, recheck auth to update user context with new profilePictureUrl
            recheckAuth(); 

            // Navigate back to profile page after a short delay
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
                            accept="image/*" // Only accept image files
                            onChange={handleFileChange}
                            disabled={isLoading}
                            style={{ display: 'none' }} // Hide the default file input
                        />
                        {/* Custom styled button to trigger file input */}
                        <button
                            type="button"
                            className="upload-button" // Apply custom styling to this button
                            onClick={() => document.getElementById('profileImage').click()}
                            disabled={isLoading}
                        >
                            Choose Image
                        </button>
                        {/* File name display for selected file */}
                        {profileImageFile && <span className="file-name">{profileImageFile.name}</span>}
                        {/* Image Preview */}
                        {profileImagePreview && (
                            <div className="profile-picture-preview">
                                <img
                                    src={profileImagePreview}
                                    alt="Profile Preview"
                                    onError={(e) => { // Hide image if URL is broken
                                        e.target.style.display = 'none';
                                        e.target.onerror = null; // Prevent infinite loop
                                    }}
                                />
                            </div>
                        )}
                        {/* Placeholder when no image is selected or available */}
                        {!profileImagePreview && !profileImageFile && (
                            <div className="no-image-placeholder">No image selected</div>
                        )}
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
