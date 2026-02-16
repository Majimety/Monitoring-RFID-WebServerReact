import React, { useState } from 'react';
import './RoomBooking.css';
import './Profile.css';

const Profile = ({ user, onNavigate, onLogout }) => {
    const [formData, setFormData] = useState({
        id: user?.id || '',
        password: '',
        confirmPassword: '',
        firstName: user?.first_name || '',
        lastName: user?.last_name || '',
        phone: user?.phone || '',
        email: user?.email || ''
    });

    const [avatarImage, setAvatarImage] = useState(null);
    const fileInputRef = React.useRef(null);

    const handleBack = () => {
        const email = user?.email || '';
        if (email.endsWith('@kkumail.com')) {
            onNavigate && onNavigate('booking');
        } else {
            onNavigate && onNavigate('dashboard');
        }
    };

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: value
        }));
    };

    const handleImageChange = (e) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (event) => {
                setAvatarImage(event.target?.result);
            };
            reader.readAsDataURL(file);
        }
    };

    const handleUploadClick = (e) => {
        e.preventDefault();
        fileInputRef.current?.click();
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        // TODO: Implement API call to update profile
        alert('Profile update functionality to be implemented');
    };

    return (
        <div className="room-booking-layout">
            <header className="booking-header-profile">
                <div className="header-content-profile">
                    <div className="logo-section-profile">
                        <img src="/logo/enkku_logo.png" alt="Logo" className="header-logo" />
                        <h1>Profile</h1>
                    </div>
                    <button className="profile-back-btn" onClick={handleBack}>
                        BACK
                    </button>
                </div>
            </header>

            <div className="profile-container">
                <div className="profile-wrapper">
                    {/* Avatar Section */}
                    <div className="profile-avatar-section">
                        <div className="avatar-container" onClick={handleUploadClick} style={{ cursor: 'pointer' }}>
                            {avatarImage ? (
                                <img src={avatarImage} alt="Avatar" style={{ width: '100%', height: '100%', borderRadius: '12px', objectFit: 'cover' }} />
                            ) : (
                                <i class="fa-regular fa-circle-user"></i>
                            )}
                        </div>
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/*"
                            onChange={handleImageChange}
                            style={{ display: 'none' }}
                        />
                    </div>

                    {/* Form Section */}
                    <div className="profile-form-section">
                        <form onSubmit={handleSubmit}>
                            <div className="form-row full">
                                <div className="form-group">
                                    <label>รหัสประจำตัว <span className="required">*</span></label>
                                    <input
                                        type="text"
                                        name="id"
                                        value={formData.id}
                                        disabled
                                    />
                                </div>
                            </div>

                            <div className="form-row full">
                                <div className="form-group">
                                    <label>รหัสผ่าน <span className="required">*</span></label>
                                    <input
                                        type="password"
                                        name="password"
                                        value={formData.password}
                                        onChange={handleChange}
                                        placeholder="*********"
                                    />
                                </div>
                            </div>

                            <div className="form-row full">
                                <div className="form-group">
                                    <label>ยืนยันรหัสผ่าน <span className="required">*</span></label>
                                    <input
                                        type="password"
                                        name="confirmPassword"
                                        value={formData.confirmPassword}
                                        onChange={handleChange}
                                        placeholder="*********"
                                    />
                                </div>
                            </div>

                            <div className="form-row">
                                <div className="form-group">
                                    <label>ชื่อ <span className="required">*</span></label>
                                    <input
                                        type="text"
                                        name="firstName"
                                        value={formData.firstName}
                                        onChange={handleChange}
                                    />
                                </div>
                                <div className="form-group">
                                    <label>นามสกุล <span className="required">*</span></label>
                                    <input
                                        type="text"
                                        name="lastName"
                                        value={formData.lastName}
                                        onChange={handleChange}
                                    />
                                </div>
                            </div>

                            <div className="form-row">
                                <div className="form-group">
                                    <label>เบอร์โทรศัพท์</label>
                                    <input
                                        type="tel"
                                        name="phone"
                                        value={formData.phone}
                                        onChange={handleChange}
                                    />
                                </div>
                                <div className="form-group">
                                    <label>Email</label>
                                    <input
                                        type="email"
                                        name="email"
                                        value={formData.email}
                                        disabled
                                    />
                                </div>
                            </div>

                            <button type="submit" className="profile-submit-btn">
                                ยืนยันการแก้ไขข้อมูล
                            </button>
                        </form>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Profile;
