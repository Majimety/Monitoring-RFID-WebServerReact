import React, { useState } from 'react';
import './Auth.css';

const Login = ({ onLogin, onSwitchToSignup }) => {
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });
  const [error, setError] = useState('');
  const [fieldError, setFieldError] = useState(''); // 'email' | 'password' | ''
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
    // ล้าง error เมื่อผู้ใช้เริ่มแก้ไขฟิลด์นั้น
    if (e.target.name === fieldError) {
      setError('');
      setFieldError('');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setFieldError('');
    setLoading(true);

    try {
      const response = await fetch('/api/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      });

      const data = await response.json();

      if (response.ok) {
        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));
        if (onLogin) {
          onLogin(data.user);
        }
      } else {
        setError(data.error || 'Login failed');
        setFieldError(data.field || '');
      }
    } catch (err) {
      setError('Connection error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const inputStyle = (field) => ({
    ...(fieldError === field ? {
      borderColor: '#d32f2f',
      boxShadow: '0 0 0 3px rgba(211, 47, 47, 0.12)'
    } : {})
  });

  return (
    <div className="auth-container">
      <div className="auth-card">
        <div className="auth-left">
          <div className="logo-section">
            <img src="/logo/enkku_logo.png" alt="Logo" className="auth-logo" />
          </div>

          <h2 className="auth-title">Welcome Back</h2>
          <p className="auth-subtitle">Login to your RFID Admin account</p>

          <form onSubmit={handleSubmit} className="auth-form">
            <div className="form-group">
              <label>Email</label>
              <input
                type="email"
                name="email"
                placeholder="admin@example.com"
                value={formData.email}
                onChange={handleChange}
                style={inputStyle('email')}
                required
              />
              {fieldError === 'email' && (
                <span style={{ color: '#d32f2f', fontSize: '12px', marginTop: '4px' }}>
                  <i className="fa-solid fa-circle-exclamation" style={{ marginRight: 4 }}></i>
                  {error}
                </span>
              )}
            </div>

            <div className="form-group">
              <div className="form-label-row">
                <label>Password</label>
                <a href="#" className="forgot-link">Forgot password?</a>
              </div>
              <input
                type="password"
                name="password"
                placeholder="Enter your password"
                value={formData.password}
                onChange={handleChange}
                style={inputStyle('password')}
                required
              />
              {fieldError === 'password' && (
                <span style={{ color: '#d32f2f', fontSize: '12px', marginTop: '4px' }}>
                  <i className="fa-solid fa-circle-exclamation" style={{ marginRight: 4 }}></i>
                  {error}
                </span>
              )}
            </div>

            {/* General error (ไม่ใช่ email/password) */}
            {error && !fieldError && (
              <div className="error-message">
                {error}
              </div>
            )}

            <button type="submit" className="auth-button" disabled={loading}>
              {loading ? 'Logging in...' : 'Login'}
            </button>
          </form>

          <p className="auth-footer">
            Don't have an account?{' '}
            <button onClick={onSwitchToSignup} className="switch-link">
              Sign up
            </button>
          </p>
        </div>

        <div className="auth-right">
          <div className="auth-illustration">
            <i className="fa-solid fa-lock"></i>
            <h3>Secure Access</h3>
            <p>RFID Management System</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;