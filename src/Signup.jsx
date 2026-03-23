import React, { useState } from 'react';
import './Auth.css';

// Helper: format student ID with dash after 9 digits → "653040120-7"
const formatStudentId = (raw) => {
  const digits = raw.replace(/\D/g, '').slice(0, 10);
  if (digits.length >= 10) {
    return digits.slice(0, 9) + '-' + digits.slice(9);
  }
  return digits;
};

// Extract username part before @ from email
const extractUsername = (email) => {
  const at = email.indexOf('@');
  return at > 0 ? email.slice(0, at) : '';
};

const Signup = ({ onSwitchToLogin }) => {
  const [formData, setFormData] = useState({
    email: '',
    first_name: '',
    last_name: '',
    password: '',
    confirm_password: '',
    user_id: ''
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const isKkuStaff = formData.email.endsWith('@kku.ac.th');
  const isKkuStudent = formData.email.endsWith('@kkumail.com');

  const handleChange = (e) => {
    const { name, value } = e.target;

    if (name === 'email') {
      setFormData(prev => {
        const newEmail = value;
        // ถ้าเป็น @kku.ac.th ให้ user_id = ส่วน username ของ email
        const newUserId = newEmail.endsWith('@kku.ac.th')
          ? extractUsername(newEmail)
          : (prev.user_id === extractUsername(prev.email) && prev.email.endsWith('@kku.ac.th'))
            ? ''
            : prev.user_id;
        return { ...prev, email: newEmail, user_id: newUserId };
      });
      return;
    }

    if (name === 'user_id') {
      if (isKkuStaff) return; // ล็อกไม่ให้แก้
      setFormData(prev => ({ ...prev, user_id: formatStudentId(value) }));
      return;
    }

    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (formData.password !== formData.confirm_password) {
      setError('รหัสผ่านไม่ตรงกัน');
      return;
    }
    if (formData.password.length < 6) {
      setError('รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร');
      return;
    }

    if (isKkuStudent) {
      const digits = formData.user_id.replace(/\D/g, '');
      if (digits.length !== 10) {
        setError('กรุณากรอกรหัสนักศึกษาให้ครบ 10 หลัก เช่น 6530401207');
        return;
      }
    }

    setLoading(true);

    try {
      const response = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: formData.email,
          first_name: formData.first_name,
          last_name: formData.last_name,
          password: formData.password,
          user_id: formData.user_id
        })
      });

      const data = await response.json();

      if (response.ok) {
        setSuccess(true);
        setTimeout(() => {
          if (onSwitchToLogin) onSwitchToLogin();
        }, 2000);
      } else {
        setError(data.error || 'ลงทะเบียนไม่สำเร็จ');
      }
    } catch (err) {
      setError('ไม่สามารถเชื่อมต่อ server ได้ กรุณาลองใหม่');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <div className="auth-left">
          <div className="logo-section">
            <img src="/logo/enkku_logo.png" alt="Logo" className="auth-logo" />
          </div>

          <h2 className="auth-title">Create Account</h2>
          <p className="auth-subtitle">Sign up for RFID System</p>

          <form onSubmit={handleSubmit} className="auth-form">
            <div className="form-group">
              <label>อีเมล (Email)</label>
              <input
                type="email"
                name="email"
                placeholder="your.email@kkumail.com"
                value={formData.email}
                onChange={handleChange}
                required
              />
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>ชื่อ (First Name)</label>
                <input
                  type="text"
                  name="first_name"
                  placeholder="ชื่อ"
                  value={formData.first_name}
                  onChange={handleChange}
                  required
                />
              </div>
              <div className="form-group">
                <label>นามสกุล (Last Name)</label>
                <input
                  type="text"
                  name="last_name"
                  placeholder="นามสกุล"
                  value={formData.last_name}
                  onChange={handleChange}
                  required
                />
              </div>
            </div>

            {/* User ID — แสดงเมื่อเป็น kkumail.com หรือ kku.ac.th */}
            {(isKkuStudent || isKkuStaff) && (
              <div className="form-group">
                <label>
                  {isKkuStaff ? 'บุคลากร (User ID)' : 'รหัสนักศึกษา (User ID)'}
                  {isKkuStudent && <span style={{ color: '#d32f2f', marginLeft: 2 }}>*</span>}
                </label>
                <input
                  type="text"
                  name="user_id"
                  placeholder={isKkuStaff ? extractUsername(formData.email) : 'เช่น 6530401207'}
                  value={formData.user_id}
                  onChange={handleChange}
                  disabled={isKkuStaff}
                  maxLength={11}
                  style={isKkuStaff ? { background: '#f5f5f5', cursor: 'not-allowed', color: '#555' } : {}}
                />
                {isKkuStudent && (
                  <span style={{ fontSize: '11px', color: '#999', marginTop: 3, display: 'block' }}>
                    กรอกตัวเลข 10 หลัก (จะเพิ่ม - ให้อัตโนมัติหลังหลักที่ 9)
                  </span>
                )}
                {isKkuStaff && (
                  <span style={{ fontSize: '11px', color: '#999', marginTop: 3, display: 'block' }}>
                    ใช้ชื่อผู้ใช้จากอีเมลโดยอัตโนมัติ
                  </span>
                )}
              </div>
            )}

            <div className="form-group">
              <label>รหัสผ่าน (Password)</label>
              <input
                type="password"
                name="password"
                placeholder="อย่างน้อย 6 ตัวอักษร"
                value={formData.password}
                onChange={handleChange}
                required
              />
            </div>

            <div className="form-group">
              <label>ยืนยันรหัสผ่าน (Confirm Password)</label>
              <input
                type="password"
                name="confirm_password"
                placeholder="กรอกรหัสผ่านอีกครั้ง"
                value={formData.confirm_password}
                onChange={handleChange}
                required
              />
            </div>

            {error && <div className="error-message">{error}</div>}

            {success && (
              <div style={{
                padding: '12px',
                background: '#f0fdf4',
                border: '1px solid #86efac',
                borderRadius: '6px',
                color: '#15803d',
                fontSize: '14px',
                textAlign: 'center',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px'
              }}>
                <i className="fa-solid fa-circle-check"></i>
                ลงทะเบียนสำเร็จ! กำลังพาไปหน้า Login...
              </div>
            )}

            <button type="submit" className="auth-button" disabled={loading || success}>
              {loading ? 'กำลังสมัคร...' : 'Sign Up'}
            </button>
          </form>

          <p className="auth-footer">
            มีบัญชีอยู่แล้ว?{' '}
            <button onClick={onSwitchToLogin} className="switch-link">
              Login here
            </button>
          </p>
        </div>

        <div className="auth-right">
          <div className="auth-illustration">
            <i className="fa-solid fa-user-plus"></i>
            <h3>Join Us</h3>
            <p>Get started with RFID Management</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Signup;