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
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState({ text: '', type: '' }); // type: 'success' | 'error'
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
        // ล้าง message เมื่อผู้ใช้เริ่มแก้ไข
        if (message.text) setMessage({ text: '', type: '' });
    };

    const handleImageChange = (e) => {
        const file = e.target.files?.[0];
        if (file) {
            // ตรวจสอบขนาดไฟล์ (ไม่เกิน 5MB)
            if (file.size > 5 * 1024 * 1024) {
                setMessage({ text: 'รูปภาพต้องมีขนาดไม่เกิน 5MB', type: 'error' });
                return;
            }
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

    const handleSubmit = async (e) => {
        e.preventDefault();
        setMessage({ text: '', type: '' });

        // --- Validation ---
        if (!formData.firstName.trim() || !formData.lastName.trim()) {
            setMessage({ text: 'กรุณากรอกชื่อและนามสกุล', type: 'error' });
            return;
        }

        // ถ้ากรอก password ใหม่ ต้องตรงกัน
        if (formData.password || formData.confirmPassword) {
            if (formData.password.length < 6) {
                setMessage({ text: 'รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร', type: 'error' });
                return;
            }
            if (formData.password !== formData.confirmPassword) {
                setMessage({ text: 'รหัสผ่านและยืนยันรหัสผ่านไม่ตรงกัน', type: 'error' });
                return;
            }
        }

        setLoading(true);

        try {
            const token = localStorage.getItem('token');

            const payload = {
                first_name: formData.firstName.trim(),
                last_name: formData.lastName.trim(),
                phone: formData.phone.trim(),
            };

            // ส่ง password เฉพาะตอนที่ผู้ใช้กรอกใหม่
            if (formData.password) {
                payload.password = formData.password;
            }

            const response = await fetch(`/api/profile/update`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(payload)
            });

            const data = await response.json();

            if (response.ok && data.success) {
                // อัปเดต localStorage ให้ตรงกับข้อมูลใหม่
                const storedUser = JSON.parse(localStorage.getItem('user') || '{}');
                const updatedUser = {
                    ...storedUser,
                    first_name: formData.firstName.trim(),
                    last_name: formData.lastName.trim(),
                };
                localStorage.setItem('user', JSON.stringify(updatedUser));

                setMessage({ text: 'แก้ไขข้อมูลสำเร็จ', type: 'success' });

                // ล้าง password fields
                setFormData(prev => ({ ...prev, password: '', confirmPassword: '' }));
            } else {
                setMessage({ text: data.error || data.message || 'เกิดข้อผิดพลาด', type: 'error' });
            }
        } catch (err) {
            setMessage({ text: 'ไม่สามารถเชื่อมต่อ server ได้', type: 'error' });
        } finally {
            setLoading(false);
        }
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
                        <div
                            className="avatar-container"
                            onClick={handleUploadClick}
                            style={{ cursor: 'pointer' }}
                            title="คลิกเพื่อเปลี่ยนรูปโปรไฟล์"
                        >
                            {avatarImage ? (
                                <img
                                    src={avatarImage}
                                    alt="Avatar"
                                    style={{ width: '100%', height: '100%', borderRadius: '12px', objectFit: 'cover' }}
                                />
                            ) : (
                                /* แก้จาก class → className */
                                <i className="fa-regular fa-circle-user" style={{ fontSize: '60px', color: '#333' }}></i>
                            )}
                        </div>
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/*"
                            onChange={handleImageChange}
                            style={{ display: 'none' }}
                        />
                        <p style={{ fontSize: '11px', color: '#999', textAlign: 'center', marginTop: '8px' }}>
                            คลิกที่รูปเพื่อเปลี่ยน
                        </p>
                    </div>

                    {/* Form Section */}
                    <div className="profile-form-section">

                        {/* แสดง success / error message */}
                        {message.text && (
                            <div style={{
                                padding: '12px 16px',
                                borderRadius: '8px',
                                marginBottom: '20px',
                                fontSize: '14px',
                                fontWeight: '500',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                background: message.type === 'success' ? '#f0fdf4' : '#fff1f1',
                                border: `1px solid ${message.type === 'success' ? '#bbf7d0' : '#ffcdd2'}`,
                                color: message.type === 'success' ? '#166534' : '#d32f2f',
                            }}>
                                <i className={`fa-solid ${message.type === 'success' ? 'fa-circle-check' : 'fa-circle-exclamation'}`}></i>
                                {message.text}
                            </div>
                        )}

                        <form onSubmit={handleSubmit}>
                            {/* รหัสประจำตัว (read-only) */}
                            <div className="form-row full">
                                <div className="form-group">
                                    <label>รหัสประจำตัว</label>
                                    <input
                                        type="text"
                                        name="id"
                                        value={formData.id}
                                        disabled
                                    />
                                </div>
                            </div>

                            {/* รหัสผ่านใหม่ (optional) */}
                            <div className="form-row full">
                                <div className="form-group">
                                    <label>
                                        รหัสผ่านใหม่
                                        <span style={{ fontSize: '11px', color: '#999', fontWeight: '400', marginLeft: '6px' }}>
                                            (เว้นว่างถ้าไม่ต้องการเปลี่ยน)
                                        </span>
                                    </label>
                                    <input
                                        type="password"
                                        name="password"
                                        value={formData.password}
                                        onChange={handleChange}
                                        placeholder="อย่างน้อย 6 ตัวอักษร"
                                        autoComplete="new-password"
                                    />
                                </div>
                            </div>

                            {/* ยืนยันรหัสผ่าน */}
                            <div className="form-row full">
                                <div className="form-group">
                                    <label>ยืนยันรหัสผ่านใหม่</label>
                                    <input
                                        type="password"
                                        name="confirmPassword"
                                        value={formData.confirmPassword}
                                        onChange={handleChange}
                                        placeholder="กรอกรหัสผ่านอีกครั้ง"
                                        autoComplete="new-password"
                                    />
                                </div>
                            </div>

                            {/* ชื่อ - นามสกุล */}
                            <div className="form-row">
                                <div className="form-group">
                                    <label>ชื่อ <span className="required">*</span></label>
                                    <input
                                        type="text"
                                        name="firstName"
                                        value={formData.firstName}
                                        onChange={handleChange}
                                        required
                                    />
                                </div>
                                <div className="form-group">
                                    <label>นามสกุล <span className="required">*</span></label>
                                    <input
                                        type="text"
                                        name="lastName"
                                        value={formData.lastName}
                                        onChange={handleChange}
                                        required
                                    />
                                </div>
                            </div>

                            {/* เบอร์โทร - Email */}
                            <div className="form-row">
                                <div className="form-group">
                                    <label>เบอร์โทรศัพท์</label>
                                    <input
                                        type="tel"
                                        name="phone"
                                        value={formData.phone}
                                        onChange={handleChange}
                                        placeholder="0xx-xxx-xxxx"
                                    />
                                </div>
                                <div className="form-group">
                                    <label>Email</label>
                                    <input
                                        type="email"
                                        name="email"
                                        value={formData.email}
                                        disabled
                                        title="ไม่สามารถเปลี่ยน Email ได้"
                                    />
                                </div>
                            </div>

                            <button
                                type="submit"
                                className="profile-submit-btn"
                                disabled={loading}
                            >
                                {loading ? (
                                    <>
                                        <i className="fa-solid fa-spinner fa-spin" style={{ marginRight: '8px' }}></i>
                                        กำลังบันทึก...
                                    </>
                                ) : (
                                    'ยืนยันการแก้ไขข้อมูล'
                                )}
                            </button>
                        </form>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Profile;