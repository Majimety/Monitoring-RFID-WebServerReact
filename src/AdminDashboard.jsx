import React, { useState, useEffect } from 'react';
import io from 'socket.io-client';
import './AdminDashboard.css';
import BookingsPage from './Bookingspage';
import RoomBooking from './RoomBooking';

// ==================== Sidebar Component ====================
const Sidebar = ({ currentPage, onPageChange, onLogout, user, sidebarOpen, onAvatarClick }) => {
  const menuItems = [
    { id: 'dashboard', icon: 'fa-house', title: 'Dashboard' },
    { id: 'users', icon: 'fa-id-card', title: 'RFID Users' },
    { id: 'bookings', icon: 'fa-calendar-check', title: 'Booking Requests' },
    { id: 'logs', icon: 'fa-clock-rotate-left', title: 'Access Logs' },
    { id: 'settings', icon: 'fa-gear', title: 'System Settings' },
    { id: 'my-booking', icon: 'fa-calendar-plus', title: 'Room Booking' },
  ];

  return (
    <aside className={`sidebar sidebar-drawer${sidebarOpen ? " open" : ""}`}>
      <div className="logo-box">
        <img
          src="/logo/enkku_logo.png"
          alt="Logo"
          onError={(e) => {
            e.target.src = "/logo/enkku_logo.svg";
          }}
        />
      </div>

      <div className="sidebar-menu">
        {menuItems.map(item => (
          <a
            key={item.id}
            href="#"
            className={`menu-item ${currentPage === item.id ? 'active' : ''}`}
            title={item.title}
            onClick={(e) => {
              e.preventDefault();
              onPageChange(item.id);
            }}
          >
            <i className={`fa-solid ${item.icon}`}></i>
          </a>
        ))}

        {/* Logout Button */}
        <a
          href="#"
          className="menu-item logout-item"
          title="Logout"
          onClick={(e) => {
            e.preventDefault();
            if (window.confirm('Are you sure you want to logout?')) {
              onLogout();
            }
          }}
        >
          <i className="fa-solid fa-right-from-bracket"></i>
        </a>
      </div>

      {/* User Info at Bottom */}
      {user && (
        <div
          className="sidebar-user"
          onClick={onAvatarClick}
          style={{ cursor: 'pointer' }}
          title="Edit Profile"
        >
          <div className="user-avatar">
            {user.first_name?.[0]}{user.last_name?.[0]}
          </div>
          <div className="user-name">{user.first_name}</div>
        </div>
      )}
    </aside>
  );
};


// ==================== Right Panel Component ====================
const RightPanel = ({ uuid, uuidUserInfo, onFormSubmit, onDismissRegistered, editingUser, onCancelEdit, onEditUser, adminUser, prefillData, onClearPrefill, profileMode, onCloseProfile }) => {
  const [formData, setFormData] = useState({
    uuid: '',
    user_id: '',
    first_name: '',
    last_name: '',
    email: '',
    role: 'student'
  });

  // Admin profile edit state
  const [profileForm, setProfileForm] = useState({
    first_name: adminUser?.first_name || '',
    last_name: adminUser?.last_name || '',
    phone: adminUser?.phone || '',
    user_id: adminUser?.user_id || '',
    password: '',
    confirmPassword: ''
  });
  const [profileMsg, setProfileMsg] = useState({ text: '', type: '' });
  const [profileLoading, setProfileLoading] = useState(false);

  // Sync profileForm when adminUser changes
  React.useEffect(() => {
    if (adminUser) {
      setProfileForm(prev => ({
        ...prev,
        first_name: adminUser.first_name || '',
        last_name: adminUser.last_name || '',
        phone: adminUser.phone || '',
        user_id: adminUser.user_id || '',
      }));
    }
  }, [adminUser?.first_name, adminUser?.last_name]);

  const handleProfileChange = (e) => {
    const { name, value } = e.target;
    setProfileForm(prev => ({ ...prev, [name]: value }));
    if (profileMsg.text) setProfileMsg({ text: '', type: '' });
  };

  const handleProfileSubmit = async (e) => {
    e.preventDefault();
    setProfileMsg({ text: '', type: '' });
    if (!profileForm.first_name.trim() || !profileForm.last_name.trim()) {
      setProfileMsg({ text: 'กรุณากรอกชื่อและนามสกุล', type: 'error' });
      return;
    }
    if (profileForm.password || profileForm.confirmPassword) {
      if (profileForm.password.length < 6) {
        setProfileMsg({ text: 'รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร', type: 'error' });
        return;
      }
      if (profileForm.password !== profileForm.confirmPassword) {
        setProfileMsg({ text: 'รหัสผ่านไม่ตรงกัน', type: 'error' });
        return;
      }
    }
    setProfileLoading(true);
    try {
      const token = localStorage.getItem('token');
      const payload = {
        first_name: profileForm.first_name.trim(),
        last_name: profileForm.last_name.trim(),
        phone: profileForm.phone.trim(),
        user_id: profileForm.user_id.trim(),
      };
      if (profileForm.password) payload.password = profileForm.password;
      const res = await fetch('/api/profile/update', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (res.ok && data.success) {
        const stored = JSON.parse(localStorage.getItem('user') || '{}');
        localStorage.setItem('user', JSON.stringify({ ...stored, first_name: payload.first_name, last_name: payload.last_name, user_id: payload.user_id }));
        setProfileMsg({ text: 'แก้ไขข้อมูล admin สำเร็จ', type: 'success' });
        setProfileForm(prev => ({ ...prev, password: '', confirmPassword: '' }));
        setTimeout(() => {
          setProfileMsg({ text: '', type: '' });
          if (onCloseProfile) onCloseProfile();
        }, 2000);
      } else {
        setProfileMsg({ text: data.error || 'เกิดข้อผิดพลาด', type: 'error' });
      }
    } catch {
      setProfileMsg({ text: 'ไม่สามารถเชื่อมต่อ server ได้', type: 'error' });
    } finally {
      setProfileLoading(false);
    }
  };
  const [searchUserId, setSearchUserId] = useState('');
  const [message, setMessage] = useState({ text: '', type: '' });
  const isMounted = React.useRef(true);
  React.useEffect(() => {
    isMounted.current = true;
    return () => { isMounted.current = false; };
  }, []);

  // Track previous uuid to detect new card scan
  const prevUuidRef = React.useRef('');

  // Update form when uuid changes (for adding new user)
  useEffect(() => {
    if (!editingUser) {
      const isNewCard = uuid && uuid !== prevUuidRef.current;
      prevUuidRef.current = uuid || '';
      if (isNewCard) {
        // New card scanned — ถ้ามี prefill data อยู่ (กด Select มาแล้ว)
        // ให้เติมแค่ uuid ไม่ต้อง reset ฟอร์ม เพราะข้อมูล user ยังถูกต้องอยู่
        const currentlyHasPrefill = !!(formData.first_name && formData.email);
        if (currentlyHasPrefill) {
          setFormData(prev => ({ ...prev, uuid: uuid }));
        } else {
          // ไม่มี prefill → reset ฟอร์มสำหรับ fresh entry
          setFormData({ uuid: uuid, user_id: '', first_name: '', last_name: '', email: '', role: 'student' });
        }
      } else {
        // uuid cleared (reset to idle) → just update uuid field
        setFormData(prev => ({ ...prev, uuid: uuid || '' }));
      }
      setMessage({ text: '', type: '' });
    }
  }, [uuid]);

  // Update form when editingUser changes
  useEffect(() => {
    if (editingUser) {
      setFormData({
        uuid: editingUser.uuid || '',
        user_id: editingUser.user_id || '',
        first_name: editingUser.first_name || '',
        last_name: editingUser.last_name || '',
        email: editingUser.email || '',
        role: editingUser.role || 'student'
      });
    } else if (!uuid) {
      setFormData({
        uuid: '',
        user_id: '',
        first_name: '',
        last_name: '',
        email: '',
        role: 'student'
      });
    }
  }, [editingUser]);

  // เติมข้อมูลจาก Register Request หรือ Search (ไม่ใช่ edit mode)
  // uuid ของบัตรยังคงอยู่ แค่เติม user info ลงไป
  useEffect(() => {
    if (prefillData) {
      setFormData(prev => ({
        ...prev,
        user_id: prefillData.user_id || '',
        first_name: prefillData.first_name || '',
        last_name: prefillData.last_name || '',
        email: prefillData.email || '',
        role: prefillData.role || 'student'
      }));
      setMessage({ text: '', type: '' });
      if (onClearPrefill) onClearPrefill();
    }
  }, [prefillData]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage({ text: '', type: '' });

    if (editingUser) {
      try {
        const response = await fetch(`/api/update_user/${editingUser.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData)
        });
        const data = await response.json();
        if (response.ok && data.success) {
          setMessage({ text: data.message || 'แก้ไขข้อมูล user สำเร็จ', type: 'success' });
          setTimeout(() => {
            setMessage({ text: '', type: '' });
            if (onCancelEdit) onCancelEdit();
            if (onFormSubmit) onFormSubmit();
          }, 2000);
        } else {
          setMessage({ text: data.message || 'เกิดข้อผิดพลาด', type: 'error' });
        }
      } catch (error) {
        setMessage({ text: 'เชื่อมต่อ server ไม่ได้', type: 'error' });
      }
    } else {
      try {
        const response = await fetch('/api/add_user', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData)
        });
        const data = await response.json();
        if (data.success) {
          if (isMounted.current) setMessage({ text: 'Add ข้อมูล user สำเร็จ', type: 'success' });
          setTimeout(() => {
            if (isMounted.current) {
              setMessage({ text: '', type: '' });
            }
            if (onFormSubmit) onFormSubmit();
          }, 2000);
        } else {
          if (isMounted.current) setMessage({ text: data.message || 'เกิดข้อผิดพลาด', type: 'error' });
        }
      } catch (error) {
        if (isMounted.current) setMessage({ text: 'เชื่อมต่อ server ไม่ได้', type: 'error' });
      }
    }
  };

  // Auto-dash formatter for student ID
  const formatStudentId = (raw) => {
    const digits = raw.replace(/\D/g, '').slice(0, 10);
    if (digits.length >= 10) return digits.slice(0, 9) + '-' + digits.slice(9);
    return digits;
  };

  const handleSearch = async () => {
    if (!searchUserId.trim()) return;
    // Fix 5: ล้าง message เก่าก่อน search ใหม่
    setMessage({ text: '', type: '' });
    try {
      const token = localStorage.getItem('token');
      const lookupRes = await fetch(`/api/user/lookup?user_id=${encodeURIComponent(searchUserId.trim())}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (lookupRes.ok) {
        const lookupData = await lookupRes.json();
        if (lookupData.success && lookupData.user) {
          const u = lookupData.user;
          if (u.already_registered) {
            setMessage({ text: `${u.first_name} ${u.last_name} ลงทะเบียน RFID แล้ว`, type: 'error' });
          } else {
            // Fix 5: ล้างฟอร์มเก่าก่อน แล้วเติมข้อมูลใหม่ (uuid ยังคงอยู่)
            setFormData(prev => ({
              ...prev,
              user_id: u.user_id || '',
              first_name: u.first_name || '',
              last_name: u.last_name || '',
              email: u.email || '',
              role: 'student'
            }));
            // Fix 4: ไม่แสดง success message
          }
          setSearchUserId('');
          return;
        }
      }
      // Fallback: หาใน users_reg (กรณี edit)
      const response = await fetch('/api/users');
      const data = await response.json();
      const user = data.users.find(u => u.user_id === searchUserId.trim());
      if (user) {
        if (onEditUser) onEditUser(user);
        setSearchUserId('');
      } else {
        setMessage({ text: 'ไม่พบ User ID นี้ในระบบ', type: 'error' });
      }
    } catch (error) {
      setMessage({ text: 'เกิดข้อผิดพลาดในการค้นหา', type: 'error' });
    }
  };

  const handleSearchKey = (e) => {
    if (e.key === 'Enter') { e.preventDefault(); handleSearch(); }
  };

  const handleCancel = () => {
    setMessage({ text: '', type: '' });
    // ล้างฟอร์มทั้งหมดกลับ idle (เก็บ uuid ไว้เพราะมาจาก RFID scan)
    setFormData({
      uuid: '',
      user_id: '',
      first_name: '',
      last_name: '',
      email: '',
      role: 'student'
    });
    if (onCancelEdit) onCancelEdit();
    if (onClearPrefill) onClearPrefill();
  };

  // ---- Render States ----
  // State 1: Editing existing user (from table edit button)
  const isEditing = !!editingUser;
  // State 2: UUID scanned & already registered
  const isRegistered = uuid && uuidUserInfo;
  // State 3: UUID scanned & NOT registered yet → show add form
  // หรือ มี prefill data (กด "ดำเนินการ") แม้ uuid ยังว่างอยู่
  const hasPrefill = !!(formData.first_name && formData.email && !editingUser);
  const isNewScan = (uuid && !uuidUserInfo && !editingUser) || (!uuid && hasPrefill);
  // State 4: No UUID scanned, not editing, no prefill
  const isIdle = !uuid && !editingUser && !hasPrefill;

  return (
    <aside className="right-panel">
      {/* Search box + Bell row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '-10px' }}>
        <div className="search-box" style={{ flex: 1, marginBottom: 0 }}>
          <i className="fa fa-search"></i>
          <input
            type="text"
            placeholder="Search User ID"
            value={searchUserId}
            onChange={(e) => setSearchUserId(formatStudentId(e.target.value))}
            onKeyDown={handleSearchKey}
            maxLength={11}
          />
        </div>
        <div style={{ flexShrink: 0 }}>
          <NotificationBell userEmail={adminUser?.email} />
        </div>
      </div>

      {/* ---- PROFILE MODE: แสดงเมื่อ admin กดที่ avatar และไม่มี action อื่นค้างอยู่ ---- */}
      {profileMode && !editingUser && !isNewScan ? (
        <div>
          {/* Avatar */}
          <div style={{ textAlign: 'center', marginBottom: 16, marginTop: 8 }}>
            <div style={{
              width: 64, height: 64, borderRadius: '50%', background: '#d88b8b',
              color: '#fff', fontSize: 22, fontWeight: 700,
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              marginBottom: 6
            }}>
              {(profileForm.first_name?.[0] || '')}
              {(profileForm.last_name?.[0] || '')}
            </div>
            <div style={{ fontSize: 13, color: '#666' }}>{adminUser?.email}</div>
          </div>

          <form onSubmit={handleProfileSubmit}>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#555', display: 'block', marginBottom: 4 }}>Name</label>
            <input name="first_name" placeholder="First Name" value={profileForm.first_name} onChange={handleProfileChange} required style={{ marginBottom: 10 }} />
            <label style={{ fontSize: 12, fontWeight: 600, color: '#555', display: 'block', marginBottom: 4 }}>Last Name</label>
            <input name="last_name" placeholder="Last Name" value={profileForm.last_name} onChange={handleProfileChange} required style={{ marginBottom: 10 }} />
            <label style={{ fontSize: 12, fontWeight: 600, color: '#555', display: 'block', marginBottom: 4 }}>User ID</label>
            <input name="user_id" placeholder="User ID" value={profileForm.user_id} onChange={handleProfileChange} style={{ marginBottom: 10 }} />
            <label style={{ fontSize: 12, fontWeight: 600, color: '#555', display: 'block', marginBottom: 4 }}>Phone Number</label>
            <input name="phone" placeholder="Phone Number" value={profileForm.phone} onChange={handleProfileChange} style={{ marginBottom: 10 }} />
            <label style={{ fontSize: 12, fontWeight: 600, color: '#555', display: 'block', marginBottom: 4 }}>New Password</label>
            <input type="password" name="password" placeholder="New Password" value={profileForm.password} onChange={handleProfileChange} style={{ marginBottom: 10 }} />
            <label style={{ fontSize: 12, fontWeight: 600, color: '#555', display: 'block', marginBottom: 4 }}>Confirm Password</label>
            <input type="password" name="confirmPassword" placeholder="Confirm Password" value={profileForm.confirmPassword} onChange={handleProfileChange} style={{ marginBottom: 14 }} />

            <button
              type="submit"
              disabled={profileLoading}
              style={{ width: '100%', padding: '10px', borderRadius: 8, background: '#d88b8b', color: '#fff', border: 'none', fontWeight: 600, fontSize: 14, cursor: 'pointer', opacity: profileLoading ? 0.7 : 1, marginBottom: 8 }}
            >
              {profileLoading ? 'Saving...' : 'Save Changes'}
            </button>
            <button
              type="button"
              onClick={onCloseProfile}
              style={{ width: '100%', padding: '10px', borderRadius: 8, background: '#d88b8b', color: '#fff', border: 'none', fontWeight: 600, fontSize: 14, cursor: 'pointer' }}
            >
              Cancel
            </button>

            {profileMsg.text && (
              <div className={`message ${profileMsg.type}`}>
                {profileMsg.text}
              </div>
            )}
          </form>
        </div>
      ) : (
        <>


      {/* ---- IDLE: waiting for RFID scan ---- */}
      {isIdle && (
        <div style={{ textAlign: 'center', padding: '30px 10px', color: '#aaa' }}>
          <i className="fa-solid fa-credit-card" style={{ fontSize: 48, marginBottom: 14, color: '#d88b8b', opacity: 0.5 }}></i>
          <p style={{ fontSize: 14, fontWeight: 500 }}>รอสแกนบัตร RFID</p>
          <p style={{ fontSize: 12, marginTop: 6, opacity: 0.7 }}>แตะบัตรที่เครื่องอ่าน RFID<br />เพื่อเพิ่มผู้ใช้ใหม่</p>
        </div>
      )}

      {/* ---- REGISTERED: UUID already in system ---- */}
      {isRegistered && !isEditing && (
        <div>
          <h3 style={{ marginBottom: 14, color: '#333' }}>บัตรนี้ลงทะเบียนแล้ว</h3>
          <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, padding: '14px 16px', marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <i className="fa-solid fa-circle-check" style={{ color: '#22c55e', fontSize: 18 }}></i>
              <span style={{ fontWeight: 600, color: '#166534', fontSize: 14 }}>พบข้อมูลผู้ใช้</span>
            </div>
            <div style={{ fontSize: 13, color: '#333', lineHeight: 1.8 }}>
              <div><b>RFID:</b> <span style={{ fontFamily: 'monospace', background: '#e5e7eb', padding: '1px 6px', borderRadius: 4 }}>{uuidUserInfo.uuid}</span></div>
              <div><b>User ID:</b> {uuidUserInfo.user_id}</div>
              <div><b>ชื่อ:</b> {uuidUserInfo.first_name} {uuidUserInfo.last_name}</div>
              <div><b>Email:</b> {uuidUserInfo.email}</div>
              <div><b>Role:</b> <span style={{ textTransform: 'capitalize' }}>{uuidUserInfo.role}</span></div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => { if (onDismissRegistered) onDismissRegistered(); }}
            style={{
              width: '100%', padding: '10px', borderRadius: 8,
              background: '#d88b8b', color: 'white', border: 'none',
              fontSize: 14, fontWeight: 600, cursor: 'pointer'
            }}
          >
            ตกลง
          </button>
        </div>
      )}

      {/* ---- NEW SCAN: UUID not registered → show add form ---- */}
      {isNewScan && (
        <div>
          <h3 style={{ marginBottom: 6, color: '#333' }}>Add User</h3>

          {/* แสดงสถานะ UUID */}
          {/* กล่องส้ม: (1) แตะบัตรแล้วแต่ยังไม่ Select  (2) Select แล้วแต่ยังไม่แตะบัตร */}
          {((uuid && !hasPrefill) || (!uuid && hasPrefill)) && (
            <div style={{ background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: 6, padding: '8px 12px', marginBottom: 14, fontSize: 12, color: '#92400e' }}>
              <i className="fa-solid fa-circle-info" style={{ marginRight: 6 }}></i>
              {uuid && !hasPrefill
                ? 'บัตรใหม่ — Select User ID เพื่อลงทะเบียน'
                : 'ผู้ใช้ใหม่ — แตะบัตร RFID เพื่อลงทะเบียน'}
            </div>
          )}
          {/* กล่องเขียว: มีทั้ง uuid และ prefill แล้ว พร้อม Add */}
          {uuid && hasPrefill && (
            <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 6, padding: '8px 12px', marginBottom: 14, fontSize: 12, color: '#166534' }}>
              <i className="fa-solid fa-circle-check" style={{ marginRight: 6 }}></i>
              ดึงข้อมูลแล้ว — กดปุ่ม Add RFID เพื่อบันทึก
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <input type="text" name="uuid" placeholder="รอสแกน RFID" value={formData.uuid} readOnly required style={{ background: '#f5f5f5' }} />
            <input type="text" name="user_id" placeholder="User ID" value={formData.user_id} onChange={handleInputChange} required />
            <input type="text" name="first_name" placeholder="First Name" value={formData.first_name} onChange={handleInputChange} required />
            <input type="text" name="last_name" placeholder="Last Name" value={formData.last_name} onChange={handleInputChange} required />
            <input type="email" name="email" placeholder="Email" value={formData.email} onChange={handleInputChange} required />
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontWeight: 700, color: '#333', fontSize: 14, display: 'block', marginBottom: 8 }}>Role:</label>
              <div style={{ display: 'flex', gap: 8 }}>
                <button type="button" onClick={() => setFormData(prev => ({ ...prev, role: 'student' }))} style={{ flex: 1, padding: '9px 0', borderRadius: 8, border: '2px solid', borderColor: formData.role === 'student' ? '#9b5e5e' : '#ddd', background: formData.role === 'student' ? '#9b5e5e' : '#fff', color: formData.role === 'student' ? '#fff' : '#888', fontWeight: 600, fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, transition: 'all 0.15s' }}>
                  <i className="fa-solid fa-user-graduate"></i><span>Student</span>
                </button>
                <button type="button" onClick={() => setFormData(prev => ({ ...prev, role: 'admin' }))} style={{ flex: 1, padding: '9px 0', borderRadius: 8, border: '2px solid', borderColor: formData.role === 'admin' ? '#9b5e5e' : '#ddd', background: formData.role === 'admin' ? '#9b5e5e' : '#fff', color: formData.role === 'admin' ? '#fff' : '#888', fontWeight: 600, fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, transition: 'all 0.15s' }}>
                  <i className="fa-solid fa-user-shield"></i><span>Admin</span>
                </button>
              </div>
            </div>
            <button type="submit">Add RFID</button>
            <button type="button" onClick={handleCancel}>Cancel</button>
          </form>
          {message.text && <div className={`message ${message.type}`}>{message.text}</div>}
        </div>
      )}

      {/* ---- EDITING: from table edit button ---- */}
      {isEditing && (
        <div>
          <h3 style={{ marginBottom: 14, color: '#333' }}>Edit User</h3>
          <form onSubmit={handleSubmit}>
            <input type="text" name="uuid" placeholder="RFID" value={formData.uuid} readOnly required style={{ background: '#f5f5f5' }} />
            <input type="text" name="user_id" placeholder="User ID" value={formData.user_id} onChange={handleInputChange} required />
            <input type="text" name="first_name" placeholder="First Name" value={formData.first_name} onChange={handleInputChange} required />
            <input type="text" name="last_name" placeholder="Last Name" value={formData.last_name} onChange={handleInputChange} required />
            <input type="email" name="email" placeholder="Email" value={formData.email} onChange={handleInputChange} required />
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontWeight: 700, color: '#333', fontSize: 14, display: 'block', marginBottom: 8 }}>Role:</label>
              <div style={{ display: 'flex', gap: 8 }}>
                <button type="button" onClick={() => setFormData(prev => ({ ...prev, role: 'student' }))} style={{ flex: 1, padding: '9px 0', borderRadius: 8, border: '2px solid', borderColor: formData.role === 'student' ? '#9b5e5e' : '#ddd', background: formData.role === 'student' ? '#9b5e5e' : '#fff', color: formData.role === 'student' ? '#fff' : '#888', fontWeight: 600, fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, transition: 'all 0.15s' }}>
                  <i className="fa-solid fa-user-graduate"></i><span>Student</span>
                </button>
                <button type="button" onClick={() => setFormData(prev => ({ ...prev, role: 'admin' }))} style={{ flex: 1, padding: '9px 0', borderRadius: 8, border: '2px solid', borderColor: formData.role === 'admin' ? '#9b5e5e' : '#ddd', background: formData.role === 'admin' ? '#9b5e5e' : '#fff', color: formData.role === 'admin' ? '#fff' : '#888', fontWeight: 600, fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, transition: 'all 0.15s' }}>
                  <i className="fa-solid fa-user-shield"></i><span>Admin</span>
                </button>
              </div>
            </div>
            <button type="submit">Update User</button>
            <button type="button" onClick={handleCancel}>Cancel</button>
          </form>
          {message.text && <div className={`message ${message.type}`}>{message.text}</div>}
        </div>
      )}
        </>
      )}
    </aside>
  );
};

// ==================== Remark Modal Component (Bug #7 Fix: แทน prompt/alert) ====================
const RemarkModal = ({ isOpen, mode, onConfirm, onCancel }) => {
  const [remark, setRemark] = React.useState('');
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    if (isOpen) setRemark('');
  }, [isOpen]);

  if (!isOpen) return null;

  const isApprove = mode === 'approve';

  const handleConfirm = async () => {
    if (!isApprove && !remark.trim()) return; // reject ต้องมีเหตุผล
    setLoading(true);
    await onConfirm(remark.trim());
    setLoading(false);
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 2000,
      display: 'flex', alignItems: 'center', justifyContent: 'center'
    }}>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.45)' }} onClick={onCancel} />
      <div style={{
        position: 'relative', background: '#fff', borderRadius: '12px',
        padding: '28px', width: '400px', maxWidth: '90vw',
        boxShadow: '0 10px 40px rgba(0,0,0,0.2)'
      }}>
        <h3 style={{ margin: '0 0 6px', color: '#333', fontSize: '18px' }}>
          {isApprove ? '✅ อนุมัติการจอง' : '❌ ปฏิเสธการจอง'}
        </h3>
        <p style={{ margin: '0 0 16px', color: '#666', fontSize: '14px' }}>
          {isApprove ? 'ระบุหมายเหตุ (ถ้ามี)' : 'กรุณาระบุเหตุผลในการปฏิเสธ'}
        </p>
        <textarea
          autoFocus
          value={remark}
          onChange={e => setRemark(e.target.value)}
          placeholder={isApprove ? 'หมายเหตุ (ไม่บังคับ)' : 'เหตุผลในการปฏิเสธ *'}
          rows={3}
          style={{
            width: '100%', padding: '10px', border: '1px solid #ddd',
            borderRadius: '8px', fontSize: '14px', resize: 'vertical',
            fontFamily: 'inherit', boxSizing: 'border-box',
            borderColor: !isApprove && !remark.trim() ? '#ffcdd2' : '#ddd'
          }}
        />
        {!isApprove && !remark.trim() && (
          <p style={{ color: '#d32f2f', fontSize: '12px', margin: '4px 0 0' }}>* จำเป็นต้องระบุเหตุผล</p>
        )}
        <div style={{ display: 'flex', gap: '10px', marginTop: '16px' }}>
          <button
            onClick={handleConfirm}
            disabled={loading || (!isApprove && !remark.trim())}
            style={{
              flex: 1, padding: '11px', borderRadius: '8px', border: 'none',
              background: isApprove ? '#4caf50' : '#e74c3c',
              color: '#fff', fontWeight: '600', fontSize: '14px', cursor: 'pointer',
              opacity: loading || (!isApprove && !remark.trim()) ? 0.6 : 1
            }}
          >
            {loading ? '...' : isApprove ? 'อนุมัติ' : 'ปฏิเสธ'}
          </button>
          <button
            onClick={onCancel}
            disabled={loading}
            style={{
              flex: 1, padding: '11px', borderRadius: '8px',
              border: '1px solid #ddd', background: '#fff',
              color: '#333', fontWeight: '600', fontSize: '14px', cursor: 'pointer'
            }}
          >
            ยกเลิก
          </button>
        </div>
      </div>
    </div>
  );
};

// ==================== Confirm Modal Component (สำหรับ Cancel Register Request) ====================
const ConfirmModal = ({ isOpen, title, message, onConfirm, onCancel, confirmLabel = 'ยืนยัน', confirmColor = '#e74c3c' }) => {
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    if (!isOpen) setLoading(false);
  }, [isOpen]);

  if (!isOpen) return null;

  const handleConfirm = async () => {
    setLoading(true);
    await onConfirm();
    setLoading(false);
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 2000,
      display: 'flex', alignItems: 'center', justifyContent: 'center'
    }}>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.45)' }} onClick={onCancel} />
      <div style={{
        position: 'relative', background: '#fff', borderRadius: '12px',
        padding: '28px', width: '380px', maxWidth: '90vw',
        boxShadow: '0 10px 40px rgba(0,0,0,0.2)'
      }}>
        <h3 style={{ margin: '0 0 10px', color: '#333', fontSize: '18px' }}>{title}</h3>
        <p style={{ margin: '0 0 20px', color: '#666', fontSize: '14px', lineHeight: 1.6 }}>{message}</p>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            onClick={handleConfirm}
            disabled={loading}
            style={{
              flex: 1, padding: '11px', borderRadius: '8px', border: 'none',
              background: confirmColor, color: '#fff',
              fontWeight: '600', fontSize: '14px', cursor: 'pointer',
              opacity: loading ? 0.6 : 1
            }}
          >
            {loading ? '...' : confirmLabel}
          </button>
          <button
            onClick={onCancel}
            disabled={loading}
            style={{
              flex: 1, padding: '11px', borderRadius: '8px',
              border: '1px solid #ddd', background: '#fff',
              color: '#333', fontWeight: '600', fontSize: '14px', cursor: 'pointer'
            }}
          >
            ยกเลิก
          </button>
        </div>
      </div>
    </div>
  );
};

// ==================== Toast Notification Component (แทน alert) ====================
const Toast = ({ message, type, onClose }) => {
  React.useEffect(() => {
    if (!message) return;
    const t = setTimeout(onClose, 3000);
    return () => clearTimeout(t);
  }, [message]);

  if (!message) return null;
  return (
    <div style={{
      position: 'fixed', bottom: '24px', right: '24px', zIndex: 3000,
      background: type === 'success' ? '#4caf50' : '#e74c3c',
      color: '#fff', padding: '14px 20px', borderRadius: '10px',
      boxShadow: '0 4px 16px rgba(0,0,0,0.2)', fontSize: '14px',
      fontWeight: '500', display: 'flex', alignItems: 'center', gap: '8px',
      animation: 'slideIn 0.3s ease'
    }}>
      <i className={`fa-solid ${type === 'success' ? 'fa-circle-check' : 'fa-circle-exclamation'}`}></i>
      {message}
    </div>
  );
};

// ==================== Dashboard Content Component ====================
const DashboardContent = ({ onPrefillUser }) => {
  const [stats, setStats] = useState({
    totalRequest: 0,
    bookingRequest: 0,
    registerRequest: 0
  });
  const [bookings, setBookings] = useState([]);
  const [registerRequests, setRegisterRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('booking');

  // Bug #7 Fix: Modal state แทน prompt/alert
  const [remarkModal, setRemarkModal] = useState({ open: false, mode: '', bookingId: null });
  const [toast, setToast] = useState({ message: '', type: '' });
  const [confirmModal, setConfirmModal] = useState({ open: false, id: null });

  const showToast = (message, type = 'success') => setToast({ message, type });

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      const token = localStorage.getItem('token');
      const bookingResponse = await fetch('/api/bookings/all', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const regResponse = await fetch('/api/rfid-register-requests', {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      let bookingPending = 0;
      let allBookings = [];
      if (bookingResponse.ok) {
        const bookingData = await bookingResponse.json();
        allBookings = bookingData.bookings || [];
        const pendingBookings = allBookings.filter(b => b.status === 'pending');
        setBookings(pendingBookings.slice(0, 10));
        bookingPending = pendingBookings.length;
      }

      let registerPending = 0;
      if (regResponse.ok) {
        const regData = await regResponse.json();
        const allRegReqs = regData.requests || [];
        const pendingRegReqs = allRegReqs.filter(r => r.status === 'pending');
        setRegisterRequests(pendingRegReqs.slice(0, 10));
        registerPending = pendingRegReqs.length;
      }

      setStats({
        totalRequest: bookingPending + registerPending,
        bookingRequest: bookingPending,
        registerRequest: registerPending
      });
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Bug #7 Fix: เปิด Modal แทน prompt()
  const handleAccept = (bookingId) => {
    setRemarkModal({ open: true, mode: 'approve', bookingId });
  };

  const handleDecline = (bookingId) => {
    setRemarkModal({ open: true, mode: 'reject', bookingId });
  };

  const handleRemarkConfirm = async (remark) => {
    const { mode, bookingId } = remarkModal;
    setRemarkModal({ open: false, mode: '', bookingId: null });

    const endpoint = mode === 'approve' ? 'approve' : 'reject';
    try {
      const response = await fetch(`/api/bookings/${bookingId}/${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ remark })
      });
      const data = await response.json();
      if (response.ok) {
        showToast(mode === 'approve' ? 'อนุมัติการจองสำเร็จ' : 'ปฏิเสธการจองสำเร็จ', 'success');
        fetchDashboardData();
      } else {
        showToast(data.message || 'เกิดข้อผิดพลาด', 'error');
      }
    } catch {
      showToast('เกิดข้อผิดพลาดในการเชื่อมต่อ', 'error');
    }
  };

  const handleCancelRequest = (id) => {
    setConfirmModal({ open: true, id });
  };

  const handleCancelConfirm = async () => {
    const id = confirmModal.id;
    setConfirmModal({ open: false, id: null });
    try {
      await fetch(`/api/rfid-register-requests/${id}/cancel`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      showToast('ยกเลิกคำขอแล้ว', 'success');
      fetchDashboardData();
    } catch {
      showToast('เกิดข้อผิดพลาด', 'error');
    }
  };

  const handleSelectRequest = async (req) => {
    try {
      const token = localStorage.getItem('token');
      const lookupRes = await fetch(`/api/user/lookup?user_id=${encodeURIComponent(req.user_id)}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const lookupData = await lookupRes.json();
      if (lookupRes.ok && lookupData.success) {
        const u = lookupData.user;
        if (u.already_registered) {
          showToast(`${u.first_name} ${u.last_name} ลงทะเบียน RFID แล้ว`, 'error');
          return;
        }
        if (onPrefillUser) onPrefillUser({ user_id: u.user_id, first_name: u.first_name, last_name: u.last_name, email: u.email });
        showToast(`โหลดข้อมูล ${u.first_name} ${u.last_name} แล้ว — สแกนบัตร RFID แล้วกด Add RFID`, 'success');
      } else {
        showToast('ไม่พบข้อมูลผู้ใช้', 'error');
      }
    } catch {
      showToast('เกิดข้อผิดพลาด', 'error');
    }
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '40px', color: '#fff' }}>
        <i className="fas fa-spinner fa-spin" style={{ fontSize: '32px' }}></i>
        <p>กำลังโหลดข้อมูล...</p>
      </div>
    );
  }

  return (
    <>
      <RemarkModal
        isOpen={remarkModal.open}
        mode={remarkModal.mode}
        onConfirm={handleRemarkConfirm}
        onCancel={() => setRemarkModal({ open: false, mode: '', bookingId: null })}
      />
      <ConfirmModal
        isOpen={confirmModal.open}
        title="⚠️ ยืนยันการยกเลิกคำขอ"
        message="ต้องการยกเลิกคำขอลงทะเบียน RFID นี้ใช่ไหม? คำขอจะถูกยกเลิกและผู้ใช้จะต้องส่งคำขอใหม่"
        confirmLabel="ยืนยันยกเลิก"
        confirmColor="#e74c3c"
        onConfirm={handleCancelConfirm}
        onCancel={() => setConfirmModal({ open: false, id: null })}
      />
      <Toast message={toast.message} type={toast.type} onClose={() => setToast({ message: '', type: '' })} />

      <div>
        <div className="page-title-box">
          <span className="page-title">Admin Dashboard</span>
        </div>

        <div className="quick-stats-title">Quick Stats</div>

        <div className="stats">
          <div className="stat-card">
            <div className="label">Total Request</div>
            <b>{stats.totalRequest}</b>
          </div>
          <div className="stat-card">
            <div className="label">Booking Request</div>
            <b>{stats.bookingRequest}</b>
          </div>
          <div className="stat-card">
            <div className="label">Register Request</div>
            <b>{stats.registerRequest}</b>
          </div>
        </div>

        <div className="bookings-title">Recent Requests</div>

        {/* Tab Toggle Buttons */}
        <div style={{ marginBottom: '16px', display: 'flex', gap: '10px' }}>
          {[
            { key: 'booking', label: 'Booking Requests' },
            { key: 'register', label: 'Register Requests' }
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              style={{
                padding: '8px 18px',
                borderRadius: '8px',
                border: activeTab === tab.key ? '2px solid #fff' : '1px solid #ccc',
                background: activeTab === tab.key ? '#c0675f' : 'white',
                color: activeTab === tab.key ? 'white' : '#555',
                cursor: 'pointer',
                fontWeight: activeTab === tab.key ? '700' : '400',
                boxShadow: activeTab === tab.key ? '0 0 0 3px #c0675f55, inset 0 1px 3px rgba(0,0,0,0.2)' : 'none',
                outline: activeTab === tab.key ? '2px solid #c0675f' : 'none',
                transform: activeTab === tab.key ? 'scale(1.05)' : 'scale(1)',
                transition: 'all 0.15s',
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Booking Requests Table */}
        {activeTab === 'booking' && (
          <div className="container">
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Booker</th>
                    <th>Room</th>
                    <th>Date</th>
                    <th>Time</th>
                    <th>Detail</th>
                    <th>Decision</th>
                  </tr>
                </thead>
                <tbody>
                  {bookings.length === 0 ? (
                    <tr>
                      <td colSpan="6" style={{ textAlign: 'center', padding: '20px' }}>
                        ไม่มีคำขอจองใหม่
                      </td>
                    </tr>
                  ) : (
                    bookings.map((booking) => (
                      <tr key={booking.id}>
                        <td>{booking.user_name || booking.user_email}</td>
                        <td>{booking.room}</td>
                        <td>{booking.date}</td>
                        <td>{booking.start_time} - {booking.end_time}</td>
                        <td>{booking.detail || '-'}</td>
                        <td>
                          <div className="action-buttons">
                            <span className="action-link accept" onClick={() => handleAccept(booking.id)}>Accept</span>
                            <span className="action-link decline" onClick={() => handleDecline(booking.id)}>Decline</span>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Register Requests Table */}
        {activeTab === 'register' && (
          <div className="container">
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>User ID</th>
                    <th>Full Name</th>
                    <th>Email</th>
                    <th>Request Date</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {registerRequests.length === 0 ? (
                    <tr>
                      <td colSpan="5" style={{ textAlign: 'center', padding: '20px' }}>
                        ไม่มีคำขอลงทะเบียน RFID ใหม่
                      </td>
                    </tr>
                  ) : (
                    registerRequests.map((req) => (
                      <tr key={req.id}>
                        <td>{req.user_id}</td>
                        <td>{req.first_name} {req.last_name}</td>
                        <td>{req.email}</td>
                        <td>{new Date(req.created_at).toLocaleString('th-TH')}</td>
                        <td>
                          <div className="action-buttons">
                            <span
                              className="action-link edit"
                              onClick={() => handleSelectRequest(req)}
                              title="โหลดข้อมูลเข้าฟอร์มลงทะเบียน"
                            >
                              Select
                            </span>
                            <span
                              className="action-link delete"
                              onClick={() => handleCancelRequest(req.id)}
                            >
                              Cancel
                            </span>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </>
  );
};

// ==================== Users Table Component ====================
const UsersTable = ({ onRefresh, onEditUser, onPrefillUser }) => {
  const [users, setUsers] = useState([]);
  const [unregisteredUsers, setUnregisteredUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('registered');
  const [confirmModal, setConfirmModal] = useState({ open: false, userId: null, userName: '' });

  const loadUsers = async () => {
    try {
      const response = await fetch('/api/users');
      const data = await response.json();
      // เรียง admin ขึ้นบนสุด ที่เหลือตามลำดับเดิม
      const sorted = [...(data.users || [])].sort((a, b) => {
        if (a.role === 'admin' && b.role !== 'admin') return -1;
        if (a.role !== 'admin' && b.role === 'admin') return 1;
        return 0;
      });
      setUsers(sorted);

      const token = localStorage.getItem('token');
      const allUsersRes = await fetch('/api/admin/all-users', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (allUsersRes.ok) {
        const allUsersData = await allUsersRes.json();
        setUnregisteredUsers(allUsersData.users || []);
      }
    } catch (error) {
      console.error('Error loading users:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, [onRefresh]);

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this user?')) {
      return;
    }

    try {
      const response = await fetch(`/api/delete_user/${id}`, {
        method: 'DELETE'
      });
      const data = await response.json();

      if (data.success) {
        loadUsers();
      } else {
        alert(data.message);
      }
    } catch (error) {
      alert('Error deleting user');
    }
  };

  const handleEdit = async (userId) => {
    try {
      const response = await fetch(`/api/user/${userId}`);
      const user = await response.json();

      if (user.error) {
        alert('Failed to load user data');
        return;
      }

      if (onEditUser) {
        onEditUser(user);
      }
    } catch (error) {
      alert('Error loading user data');
    }
  };

  const handleDeleteAdminUser = (id) => {
    const u = unregisteredUsers.find(x => x.id === id);
    setConfirmModal({ open: true, userId: id, userName: `${u?.first_name || ''} ${u?.last_name || ''}`.trim() });
  };

  const handleConfirmDeleteAdmin = async () => {
    const id = confirmModal.userId;
    setConfirmModal({ open: false, userId: null, userName: '' });
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/admin/delete-user/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        loadUsers();
      } else {
        alert(data.error || 'ลบไม่สำเร็จ');
      }
    } catch {
      alert('เกิดข้อผิดพลาด');
    }
  };

  const handleSelectAdminUser = (u) => {
    if (onPrefillUser) {
      onPrefillUser({
        user_id: u.user_id || '',
        first_name: u.first_name,
        last_name: u.last_name,
        email: u.email,
        role: u.role || (u.email?.endsWith('@kku.ac.th') ? 'admin' : 'student')
      });
    }
  };

  const adminCount = users.filter(u => u.role === 'admin').length;
  const studentCount = users.filter(u => u.role === 'student').length;

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <>
      <ConfirmModal
        isOpen={confirmModal.open}
        title="⚠️ ลบผู้ใช้ออกจากระบบ"
        message={`ต้องการลบ "${confirmModal.userName}" ออกจากระบบใช่ไหม?`}
        confirmLabel="ลบเลย"
        onConfirm={handleConfirmDeleteAdmin}
        onCancel={() => setConfirmModal({ open: false, userId: null, userName: '' })}
      />
    <div>
      <div className="page-title-box">
        <span className="page-title">RFID Registered Users</span>
      </div>

      <div className="quick-stats-title">Quick Stats</div>

      <div className="stats">
        <div className="stat-card">
          <div className="label">Total Users</div>
          <b>{users.length}</b>
        </div>
        <div className="stat-card">
          <div className="label">Admins</div>
          <b>{adminCount}</b>
        </div>
        <div className="stat-card">
          <div className="label">Users</div>
          <b>{studentCount}</b>
        </div>
      </div>

      {/* Tab Toggle Buttons */}
      <div style={{ marginBottom: '16px', display: 'flex', gap: '10px' }}>
        {[
          { key: 'registered', label: 'RFID Registered' },
          { key: 'unregistered', label: 'RFID Not Registered' }
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            style={{
              padding: '8px 18px',
              borderRadius: '8px',
              border: activeTab === tab.key ? '2px solid #fff' : '1px solid #ccc',
              background: activeTab === tab.key ? '#c0675f' : 'white',
              color: activeTab === tab.key ? 'white' : '#555',
              cursor: 'pointer',
              fontWeight: activeTab === tab.key ? '700' : '400',
              boxShadow: activeTab === tab.key ? '0 0 0 3px #c0675f55, inset 0 1px 3px rgba(0,0,0,0.2)' : 'none',
              outline: activeTab === tab.key ? '2px solid #c0675f' : 'none',
              transform: activeTab === tab.key ? 'scale(1.05)' : 'scale(1)',
              transition: 'all 0.15s',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Registered RFID Users Table */}
      {activeTab === 'registered' && (
        <div className="container">
          {users.length > 0 ? (
            <>
              <div className="table-container">
                <table>
                  <thead>
                    <tr>
                      <th>UUID</th>
                      <th>User ID</th>
                      <th>First Name</th>
                      <th>Last Name</th>
                      <th>Email</th>
                      <th>Role</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map(user => (
                      <tr key={user.id}>
                        <td>{user.uuid}</td>
                        <td>{user.user_id}</td>
                        <td>{user.first_name}</td>
                        <td>{user.last_name}</td>
                        <td>{user.email}</td>
                        <td>
                          <span style={{
                            padding: '3px 10px', borderRadius: 12, fontSize: 12, fontWeight: 600,
                            background: user.role === 'admin' ? '#fff3e0' : '#e8f5e9',
                            color: user.role === 'admin' ? '#e65100' : '#2e7d32',
                            border: `1px solid ${user.role === 'admin' ? '#ffcc80' : '#a5d6a7'}`
                          }}>
                            {user.role}
                          </span>
                        </td>
                        <td>
                          <div className="action-buttons">
                            <span className="action-link edit" onClick={() => handleEdit(user.id)}>Edit</span>
                            <span className="action-link delete" onClick={() => handleDelete(user.id)}>Delete</span>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="mobile-cards">
                {users.map(user => (
                  <div key={user.id} className="user-card">
                    <div className="card-header">
                      <div className="card-id">{user.user_id}</div>
                      <div className="card-actions">
                        <span className="action-link edit" onClick={() => handleEdit(user.id)}>Edit</span>
                        <span className="action-link delete" onClick={() => handleDelete(user.id)}>Delete</span>
                      </div>
                    </div>
                    <div className="card-field"><div className="field-label">UUID:</div><div className="field-value">{user.uuid}</div></div>
                    <div className="card-field"><div className="field-label">Name:</div><div className="field-value">{user.first_name} {user.last_name}</div></div>
                    <div className="card-field"><div className="field-label">Email:</div><div className="field-value">{user.email}</div></div>
                    <div className="card-field"><div className="field-label">Role:</div><div className="field-value">{user.role}</div></div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="no-users"><p>No users found.</p></div>
          )}
        </div>
      )}

      {/* Unregistered Users Table */}
      {activeTab === 'unregistered' && (
        <div className="container">
          {unregisteredUsers.length > 0 ? (
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>User ID</th>
                    <th>First Name</th>
                    <th>Last Name</th>
                    <th>Email</th>
                    <th>Role</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {unregisteredUsers.map(u => {
                    const derivedRole = u.email?.endsWith('@kku.ac.th') ? 'admin' : 'student';
                    return (
                    <tr key={u.id}>
                      <td style={{ fontFamily: 'monospace' }}>{u.user_id || '-'}</td>
                      <td>{u.first_name}</td>
                      <td>{u.last_name}</td>
                      <td>{u.email}</td>
                      <td>
                        <span style={{
                          padding: '3px 10px', borderRadius: 12, fontSize: 12, fontWeight: 600,
                          background: derivedRole === 'admin' ? '#fff3e0' : '#e8f5e9',
                          color: derivedRole === 'admin' ? '#e65100' : '#2e7d32',
                          border: `1px solid ${derivedRole === 'admin' ? '#ffcc80' : '#a5d6a7'}`
                        }}>
                          {derivedRole}
                        </span>
                      </td>
                      <td>
                        <div className="action-buttons">
                          <span className="action-link edit" onClick={() => handleSelectAdminUser({ ...u, role: derivedRole })}>Select</span>
                          <span className="action-link delete" onClick={() => handleDeleteAdminUser(u.id)}>Delete</span>
                        </div>
                      </td>
                    </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="no-users"><p>ผู้ใช้ทุกคนลงทะเบียน RFID แล้ว</p></div>
          )}
        </div>
      )}
    </div>
    </>
  );
};

// ==================== Room Card Component ====================
const RoomCard = ({ room, onSelect, isSelected }) => {
  const doorOnline = room.doorOnline ?? false;
  const rfidOnline = room.rfidOnline ?? false;
  const doorStatus = room.doorStatus ?? 'LOCKED';

  return (
    <div
      className={`room-card ${isSelected ? 'selected' : ''}`}
      onClick={() => onSelect(room)}
    >
      <div className="room-card-header">
        <div className="room-number">
          <i className="fa-solid fa-door-closed"></i>
          {room.name}
        </div>
        <div className={`door-pill ${doorStatus === 'OPEN' ? 'open' : 'locked'}`}>
          {doorStatus === 'OPEN' ? 'OPEN' : 'LOCKED'}
        </div>
      </div>

      <div className="room-device-list">
        <div className="room-device-item">
          <span className="device-label">
            <i className="fa-solid fa-wifi"></i> Door Controller
          </span>
          <span className={`device-dot ${doorOnline ? 'online' : 'offline'}`}>
            {doorOnline ? 'Online' : 'Offline'}
          </span>
        </div>
        <div className="room-device-item">
          <span className="device-label">
            <i className="fa-solid fa-credit-card"></i> RFID Reader
          </span>
          <span className={`device-dot ${rfidOnline ? 'online' : 'offline'}`}>
            {rfidOnline ? 'Online' : 'Offline'}
          </span>
        </div>
      </div>
    </div>
  );
};

// ==================== System Settings Component ====================
const SystemSettings = ({ onSelectRoom, selectedRoom, refreshKey }) => {
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [roomSearch, setRoomSearch] = useState('');
  const [filterFloor, setFilterFloor] = useState('all');

  // Load rooms from API
  const fetchRooms = async () => {
    try {
      const res = await fetch('/api/rooms');
      if (res.ok) {
        const data = await res.json();
        setRooms(data.rooms || []);
      }
    } catch (e) {
      console.error('Error fetching rooms:', e);
    } finally {
      setLoading(false);
    }
  };

  // Re-fetch when parent signals a change (e.g. room added)
  useEffect(() => {
    fetchRooms();
  }, [refreshKey]);

  // Poll room device statuses every 3 seconds
  useEffect(() => {
    if (rooms.length === 0) return;
    const poll = async () => {
      const updated = await Promise.all(
        rooms.map(async (room) => {
          try {
            const res = await fetch(`/api/door/status?room=${encodeURIComponent(room.name)}`);
            if (res.ok) {
              const data = await res.json();
              return {
                ...room,
                doorStatus: data.door_status ?? room.doorStatus ?? 'LOCKED',
                doorOnline: data.door_online ?? room.doorOnline ?? false,
                rfidOnline: data.rfid_online ?? room.rfidOnline ?? false,
              };
            }
          } catch { /* keep existing state */ }
          return room;
        })
      );
      // เรียง Online ขึ้นก่อน
      setRooms([...updated].sort((a, b) => {
        const aOnline = (a.doorOnline || a.rfidOnline) ? 1 : 0;
        const bOnline = (b.doorOnline || b.rfidOnline) ? 1 : 0;
        return bOnline - aOnline;
      }));
    };
    poll();
    const interval = setInterval(poll, 3000);
    return () => clearInterval(interval);
  }, [rooms.length]);

  const handleRenameRoom = async (roomId, newName) => {
    const trimmed = newName.trim();
    if (!trimmed) return;
    try {
      const res = await fetch(`/api/rooms/${roomId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: trimmed })
      });
      const data = await res.json();
      if (res.ok) {
        await fetchRooms();
        if (selectedRoom?.id === roomId) {
          onSelectRoom({ ...selectedRoom, name: trimmed });
        }
      } else {
        alert(data.error || 'แก้ไขชื่อห้องไม่สำเร็จ');
      }
    } catch {
      alert('เกิดข้อผิดพลาดในการเชื่อมต่อ');
    }
  };

  const handleDeleteRoom = async (roomId) => {
    if (!window.confirm('ต้องการลบห้องนี้?')) return;
    try {
      const res = await fetch(`/api/rooms/${roomId}`, { method: 'DELETE' });
      if (res.ok) {
        await fetchRooms();
        if (selectedRoom?.id === roomId) onSelectRoom({ __addMode: true });
      } else {
        const data = await res.json();
        alert(data.error || 'ลบห้องไม่สำเร็จ');
      }
    } catch {
      alert('เกิดข้อผิดพลาดในการเชื่อมต่อ');
    }
  };

  if (loading) {
    return (
      <div>
        <div className="page-title-box"><div className="page-title">Device Status</div></div>
        <div style={{ color: '#fff', padding: 20 }}>กำลังโหลด...</div>
      </div>
    );
  }

  return (
    <div>
      <div className="page-title-box">
        <div className="page-title">Device Status</div>
      </div>

      <div className="settings-toolbar">
        <span className="settings-subtitle">
          <i className="fa-solid fa-building"></i> All Rooms
        </span>
        <button
          className="add-room-btn"
          onClick={() => onSelectRoom({ __addMode: true })}
        >
          <i className="fa-solid fa-plus"></i> Add Room
        </button>
      </div>

      {/* Search + Floor Filter */}
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '16px', alignItems: 'center' }}>
        {/* Search */}
        <div style={{ display: 'flex', gap: '6px', flex: '1', minWidth: '180px' }}>
          <input
            type="text"
            placeholder="Search room name..."
            value={roomSearch}
            onChange={e => setRoomSearch(e.target.value)}
            style={{ flex: 1, padding: '8px 12px', border: '2px solid #fff', borderRadius: '6px', fontSize: '13px', background: 'rgba(255,255,255,0.95)', boxShadow: '0 1px 4px rgba(0,0,0,0.12)', outline: 'none' }}
          />
          {roomSearch && (
            <button
              onClick={() => setRoomSearch('')}
              style={{ padding: '8px 10px', background: '#e8e8e8', border: '2px solid #fff', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', color: '#444' }}
              title="ล้าง"
            >
              <i className="fa-solid fa-xmark"></i>
            </button>
          )}
        </div>

        {/* Floor Filter — dropdown */}
        <select
          value={filterFloor}
          onChange={e => setFilterFloor(e.target.value)}
          style={{ padding: '8px 12px', border: '1px solid #ddd', borderRadius: '6px', fontSize: '13px', minWidth: '130px' }}
        >
          <option value="all">All Floors</option>
          <option value="1">Floor 1</option>
          <option value="2">Floor 2</option>
          <option value="3">Floor 3</option>
          <option value="4">Floor 4</option>
          <option value="5">Floor 5</option>
        </select>
      </div>

      <div className="rooms-grid">
        {(() => {
          const filtered = rooms.filter(room => {
            const matchSearch = roomSearch === '' || room.name.toLowerCase().includes(roomSearch.toLowerCase());
            const matchFloor = filterFloor === 'all' || room.name.toUpperCase().startsWith(`EN4${filterFloor}`);
            return matchSearch && matchFloor;
          });
          if (rooms.length === 0) return (
            <div className="no-rooms">
              <i className="fa-solid fa-door-open" style={{ fontSize: 40, color: '#d28b8b', marginBottom: 12 }}></i>
              <p>ยังไม่มีห้อง กดปุ่ม "Add Room" เพื่อเพิ่ม</p>
            </div>
          );
          if (filtered.length === 0) return (
            <div className="no-rooms">
              <i className="fa-solid fa-magnifying-glass" style={{ fontSize: 32, color: '#d28b8b', marginBottom: 12 }}></i>
              <p>ไม่พบห้องที่ค้นหา</p>
            </div>
          );
          return filtered.map(room => (
            <RoomCard
              key={room.id}
              room={room}
              isSelected={selectedRoom?.id === room.id}
              onSelect={(r) => onSelectRoom({
                ...r,
                __addMode: false,
                __deleteCallback: () => handleDeleteRoom(r.id),
                __renameCallback: (newName) => handleRenameRoom(r.id, newName),
              })}
            />
          ));
        })()}
      </div>
    </div>
  );
};

// ==================== Room Right Panel Component ====================
const RoomRightPanel = ({ selectedRoom, onClose, onAddRoom }) => {
  const [roomName, setRoomName] = useState('');
  const [cmdMsg, setCmdMsg] = useState({ text: '', type: '' });
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState('');

  useEffect(() => {
    setIsRenaming(false);
    setRenameValue(selectedRoom?.name || '');
    setCmdMsg({ text: '', type: '' });
  }, [selectedRoom?.id]);

  // Reset roomName when entering add mode
  useEffect(() => {
    if (selectedRoom?.__addMode) {
      setRoomName('');
    }
  }, [selectedRoom?.__addMode]);

  if (!selectedRoom) {
    return (
      <aside className="right-panel">
        <div className="right-panel-empty">
          <i className="fa-solid fa-door-closed" style={{ fontSize: 48, color: '#d28b8b', marginBottom: 16 }}></i>
          <p style={{ color: '#888', textAlign: 'center', fontSize: 14 }}>
            เลือกห้องเพื่อดู Status<br />หรือกด Add Room เพื่อเพิ่มห้องใหม่
          </p>
        </div>
      </aside>
    );
  }

  if (selectedRoom.__addMode) {
    return (
      <aside className="right-panel">
        <h3>Add New Room</h3>
        <input
          type="text"
          placeholder="Room Number (EN1234)"
          value={roomName}
          onChange={e => setRoomName(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter' && roomName.trim()) {
              onAddRoom(roomName);
            }
          }}
          style={{ width: '100%', marginBottom: 10, padding: 10, borderRadius: 6, border: '1px solid #ccc', fontSize: 14, boxSizing: 'border-box' }}
        />
        <button
          onClick={() => onAddRoom(roomName)}
          style={{ width: '100%', padding: '10px', background: '#d28b8b', color: '#fff', border: 'none', borderRadius: 6, fontWeight: 600, cursor: 'pointer', marginBottom: 8 }}
        >
          <i className="fa-solid fa-plus"></i> Add Room
        </button>
        <button
          onClick={onClose}
          style={{ width: '100%', padding: '10px', background: '#f2f2f2', color: '#333', border: 'none', borderRadius: 6, fontWeight: 600, cursor: 'pointer' }}
        >
          Cancel
        </button>
      </aside>
    );
  }

  const sendDoorCmd = async (cmd) => {
    setCmdMsg({ text: '', type: '' });
    try {
      const res = await fetch(`/api/door/${cmd}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ room: selectedRoom.name })
      });
      const data = await res.json();
      setCmdMsg({ text: data.message || `Door ${cmd} sent`, type: 'success' });
      setTimeout(() => setCmdMsg({ text: '', type: '' }), 2500);
    } catch {
      setCmdMsg({ text: 'Error sending command', type: 'error' });
    }
  };

  const handleRenameSubmit = () => {
    if (renameValue.trim() && selectedRoom.__renameCallback) {
      selectedRoom.__renameCallback(renameValue.trim());
    }
    setIsRenaming(false);
  };

  const doorStatus = selectedRoom.doorStatus ?? 'LOCKED';
  const doorOnline = selectedRoom.doorOnline ?? false;
  const rfidOnline = selectedRoom.rfidOnline ?? false;

  return (
    <aside className="right-panel">
      {/* Header */}
      {isRenaming ? (
        <div style={{ marginBottom: 16 }}>
          <div className="panel-section-title" style={{ marginBottom: 8 }}>Rename Room</div>
          <input
            type="text"
            value={renameValue}
            onChange={e => setRenameValue(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleRenameSubmit(); if (e.key === 'Escape') setIsRenaming(false); }}
            autoFocus
            style={{ width: '100%', padding: 10, borderRadius: 6, border: '1px solid #d28b8b', fontSize: 14, boxSizing: 'border-box', marginBottom: 8 }}
          />
          <div style={{ display: 'flex', gap: 6 }}>
            <button onClick={handleRenameSubmit} style={{ flex: 1, padding: '8px', background: '#d28b8b', color: '#fff', border: 'none', borderRadius: 6, fontWeight: 600, cursor: 'pointer' }}>
              Save
            </button>
            <button onClick={() => setIsRenaming(false)} style={{ flex: 1, padding: '8px', background: '#f2f2f2', color: '#333', border: 'none', borderRadius: 6, fontWeight: 600, cursor: 'pointer' }}>
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{
                width: 40,
                height: 40,
                background: 'linear-gradient(135deg, #d28b8b 0%, #c77676 100%)',
                borderRadius: 10,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 2px 8px rgba(210, 139, 139, 0.3)'
              }}>
                <i className="fa-solid fa-door-closed" style={{ color: 'white', fontSize: 18 }}></i>
              </div>
              <div>
                <div style={{ fontSize: 11, color: '#999', fontWeight: 500, marginBottom: 2 }}>ROOM</div>
                <h3 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: '#333' }}>{selectedRoom.name}</h3>
              </div>
            </div>
            <button
              title="Rename Room"
              onClick={() => { setRenameValue(selectedRoom.name); setIsRenaming(true); }}
              style={{
                background: 'white',
                border: '1px solid #e0e0e0',
                borderRadius: 8,
                width: 36,
                height: 36,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                color: '#666',
                transition: 'all 0.2s',
                boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = '#f5f5f5';
                e.currentTarget.style.borderColor = '#d28b8b';
                e.currentTarget.style.color = '#d28b8b';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'white';
                e.currentTarget.style.borderColor = '#e0e0e0';
                e.currentTarget.style.color = '#666';
              }}
            >
              <i className="fa-solid fa-pen" style={{ fontSize: 14 }}></i>
            </button>
          </div>
          <div style={{ height: 1, background: 'linear-gradient(to right, #e0e0e0, transparent)', marginBottom: 16 }}></div>
        </div>
      )}

      {/* Door Status */}
      <div className="panel-section-title">Door Status</div>
      <div className={`panel-status-badge ${doorStatus === 'OPEN' ? 'open' : 'locked'}`}>
        <i className={`fa-solid ${doorStatus === 'OPEN' ? 'fa-lock-open' : 'fa-lock'}`}></i>
        {doorStatus}
      </div>

      {/* Controls */}
      <div className="panel-section-title" style={{ marginTop: 18 }}>Controls</div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
        <button className="door-btn open" style={{ flex: 1 }} onClick={() => sendDoorCmd('open')}>
          <i className="fa-solid fa-lock-open"></i> OPEN
        </button>
        <button className="door-btn close" style={{ flex: 1 }} onClick={() => sendDoorCmd('close')}>
          <i className="fa-solid fa-lock"></i> LOCK
        </button>
      </div>

      {cmdMsg.text && (
        <div className={`message ${cmdMsg.type}`} style={{ marginBottom: 12 }}>
          {cmdMsg.text}
        </div>
      )}

      {/* Device Status */}
      <div className="panel-section-title" style={{ marginTop: 10 }}>Devices</div>
      <div className="panel-device-list">
        <div className="panel-device-item">
          <div className="panel-device-label">
            <i className="fa-solid fa-wifi"></i> Door Controller
          </div>
          <span className={`device-dot ${doorOnline ? 'online' : 'offline'}`}>
            ● {doorOnline ? 'Online' : 'Offline'}
          </span>
        </div>
        <div className="panel-device-item">
          <div className="panel-device-label">
            <i className="fa-solid fa-credit-card"></i> RFID Reader
          </div>
          <span className={`device-dot ${rfidOnline ? 'online' : 'offline'}`}>
            ● {rfidOnline ? 'Online' : 'Offline'}
          </span>
        </div>
      </div>

      {/* Delete */}
      <div style={{ marginTop: 'auto', paddingTop: 20 }}>
        <button
          onClick={() => { if (selectedRoom.__deleteCallback) selectedRoom.__deleteCallback(); }}
          style={{ width: '100%', padding: '10px', background: '#fff1f1', color: '#d90429', border: '1px solid #f5b5b5', borderRadius: 6, fontWeight: 600, cursor: 'pointer' }}
        >
          <i className="fa-solid fa-trash"></i> Remove Room
        </button>
      </div>
    </aside>
  );
};

// ==================== Access Logs Component ====================
const AccessLogs = () => {
  const [logs, setLogs]           = useState([]);
  const [stats, setStats]         = useState(null);
  const [rooms, setRooms]         = useState([]);
  const [loading, setLoading]     = useState(true);
  const [statsLoading, setStatsLoading] = useState(true);

  // Filter & search state
  const [filterRoom,   setFilterRoom]   = useState('');
  const [filterResult, setFilterResult] = useState('all');
  const [search,       setSearch]       = useState('');
  const [searchInput,  setSearchInput]  = useState('');

  // Pagination
  const [offset, setOffset] = useState(0);
  const [total,  setTotal]  = useState(0);
  const LIMIT = 50;

  const token = () => localStorage.getItem('token');

  // โหลด rooms สำหรับ dropdown filter
  useEffect(() => {
    fetch('/api/rooms')
      .then(r => r.json())
      .then(d => setRooms(d.rooms || []))
      .catch(() => {});
  }, []);

  // โหลด stats
  useEffect(() => {
    setStatsLoading(true);
    fetch('/api/access-logs/stats', {
      headers: { 'Authorization': `Bearer ${token()}` }
    })
      .then(r => r.json())
      .then(d => { if (d.success) setStats(d.stats); })
      .catch(() => {})
      .finally(() => setStatsLoading(false));
  }, []);

  // โหลด logs เมื่อ filter / search / pagination เปลี่ยน
  useEffect(() => {
    fetchLogs();
  }, [filterRoom, filterResult, search, offset]);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        limit:  LIMIT,
        offset: offset,
        result: filterResult,
        ...(filterRoom && { room: filterRoom }),
        ...(search     && { search }),
      });
      const res  = await fetch(`/api/access-logs?${params}`, {
        headers: { 'Authorization': `Bearer ${token()}` }
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setLogs(data.logs  || []);
        setTotal(data.total || 0);
      }
    } catch (e) {
      console.error('Error fetching logs:', e);
    } finally {
      setLoading(false);
    }
  };

  // รีเซ็ต offset เมื่อ filter เปลี่ยน
  const handleFilterRoom   = (v) => { setFilterRoom(v);   setOffset(0); };
  const handleFilterResult = (v) => { setFilterResult(v); setOffset(0); };
  const handleSearch       = ()  => { setSearch(searchInput); setOffset(0); };

  const formatDateTime = (raw) => {
    if (!raw) return '-';
    // SQLite เก็บ UTC ไม่มี timezone suffix → เติม Z เพื่อให้ JS แปลงเป็นเวลาไทย (UTC+7)
    const utcStr = raw.includes('T') || raw.endsWith('Z') ? raw : raw.replace(' ', 'T') + 'Z';
    const d = new Date(utcStr);
    return d.toLocaleString('th-TH', {
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
      timeZone: 'Asia/Bangkok'
    });
  };

  const totalPages   = Math.ceil(total / LIMIT);
  const currentPage  = Math.floor(offset / LIMIT) + 1;

  return (
    <div>
      {/* Title */}
      <div className="page-title-box">
        <span className="page-title">Access Logs</span>
      </div>

      {/* Stats Cards */}
      <div className="quick-stats-title">Overview</div>
      <div className="stats" style={{ marginBottom: '24px' }}>
        {statsLoading ? (
          <div style={{ color: '#aaa', padding: '10px' }}>
            <i className="fa-solid fa-spinner fa-spin"></i> Loading...
          </div>
        ) : stats ? (
          <>
            <div className="stat-card">
              <div className="label">Total Scans</div>
              <b>{stats.total.toLocaleString()}</b>
            </div>
            <div className="stat-card" style={{ color: '#4caf50' }}>
              <div className="label">Granted</div>
              <b>{stats.granted.toLocaleString()}</b>
            </div>
            <div className="stat-card" style={{ color: '#e74c3c' }}>
              <div className="label">Denied</div>
              <b>{stats.denied.toLocaleString()}</b>
            </div>
            <div className="stat-card" style={{ color: '#4c6ef5' }}>
              <div className="label">Today</div>
              <b>{stats.today.toLocaleString()}</b>
            </div>
          </>
        ) : null}
      </div>

      {/* Filters Row */}
      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '16px', alignItems: 'center' }}>

        {/* Search */}
        <div style={{ display: 'flex', gap: '6px', flex: '1', minWidth: '200px' }}>
          <input
            type="text"
            placeholder="Search UUID / Name / Email / Student ID"
            value={searchInput}
            onChange={e => setSearchInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSearch()}
            style={{ flex: 1, padding: '8px 12px', border: '2px solid #fff', borderRadius: '6px', fontSize: '13px', background: 'rgba(255,255,255,0.95)', boxShadow: '0 1px 4px rgba(0,0,0,0.12)', outline: 'none' }}
          />
          <button
            onClick={handleSearch}
            style={{ padding: '8px 14px', background: '#d88b8b', color: '#fff', border: '2px solid #fff', borderRadius: '6px', cursor: 'pointer', fontSize: '13px' }}
          >
            <i className="fa-solid fa-magnifying-glass"></i>
          </button>
          {search && (
            <button
              onClick={() => { setSearchInput(''); setSearch(''); setOffset(0); }}
              style={{ padding: '8px 10px', background: '#e8e8e8', border: '2px solid #fff', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', color: '#444', fontWeight: '600' }}
              title="ล้างการค้นหา"
            >
              <i className="fa-solid fa-xmark"></i>
            </button>
          )}
        </div>

        {/* Room filter */}
        <select
          value={filterRoom}
          onChange={e => handleFilterRoom(e.target.value)}
          style={{ padding: '8px 12px', border: '1px solid #ddd', borderRadius: '6px', fontSize: '13px', minWidth: '130px' }}
        >
          <option value="">All Rooms</option>
          {rooms.map(r => (
            <option key={r.id} value={r.name}>{r.name}</option>
          ))}
        </select>

        {/* Result filter */}
        <div style={{ display: 'flex', gap: '6px' }}>
          {[
            { value: 'all',     label: 'All' },
            { value: 'granted', label: '✅ Granted' },
            { value: 'denied',  label: '❌ Denied' },
          ].map(opt => (
            <button
              key={opt.value}
              onClick={() => handleFilterResult(opt.value)}
              style={{
                padding: '8px 14px', borderRadius: '6px', fontSize: '13px', cursor: 'pointer',
                border: filterResult === opt.value ? '2px solid #fff' : '1px solid #ccc',
                background: filterResult === opt.value ? '#c0675f' : 'white',
                color: filterResult === opt.value ? 'white' : '#555',
                fontWeight: filterResult === opt.value ? '700' : '400',
                boxShadow: filterResult === opt.value ? '0 0 0 3px #c0675f55, inset 0 1px 3px rgba(0,0,0,0.2)' : 'none',
                outline: filterResult === opt.value ? '2px solid #c0675f' : 'none',
                transform: filterResult === opt.value ? 'scale(1.04)' : 'scale(1)',
                transition: 'all 0.15s',
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* Refresh */}
        <button
          onClick={() => fetchLogs()}
          style={{ padding: '8px 12px', background: '#e8e8e8', border: '1px solid #bbb', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', color: '#444', fontWeight: '600' }}
          title="รีเฟรช"
        >
          <i className="fa-solid fa-rotate-right"></i>
        </button>

        {/* Purge old logs */}
        <button
          onClick={async () => {
            if (!window.confirm('ต้องการลบ log ที่เก่ากว่า 30 วันทั้งหมดใช่ไหม?')) return;
            try {
              const res = await fetch('/api/access-logs/purge-old', {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token()}` }
              });
              const data = await res.json();
              if (res.ok) {
                alert(`ลบแล้ว ${data.deleted} รายการ`);
                fetchLogs();
              } else {
                alert(data.error || 'เกิดข้อผิดพลาด');
              }
            } catch {
              alert('เกิดข้อผิดพลาดในการเชื่อมต่อ');
            }
          }}
          style={{ padding: '8px 12px', background: '#fdecea', border: '1px solid #e57373', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', color: '#c62828', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '6px' }}
          title="ลบ log เก่ากว่า 30 วัน"
        >
          <i className="fa-solid fa-trash-clock"></i> Clear old logs
        </button>
      </div>

      {/* Table */}
      <div className="container">
        <div className="table-container">
          {loading ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#aaa' }}>
              <i className="fa-solid fa-spinner fa-spin" style={{ fontSize: '28px' }}></i>
              <p style={{ marginTop: '10px' }}>Loading...</p>
            </div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Date / Time</th>
                  <th>UUID (RFID)</th>
                  <th>User ID</th>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Room</th>
                  <th>Status</th>
                  <th>Method</th>
                </tr>
              </thead>
              <tbody>
                {logs.length === 0 ? (
                  <tr>
                    <td colSpan="10" style={{ textAlign: 'center', padding: '30px', color: '#aaa' }}>
                      <i className="fa-solid fa-inbox" style={{ fontSize: '28px', marginBottom: '8px', display: 'block' }}></i>
                      No records found
                    </td>
                  </tr>
                ) : logs.map((log, idx) => (
                  <tr key={log.id}>
                    <td style={{ color: '#aaa', fontSize: '12px' }}>{offset + idx + 1}</td>
                    <td style={{ whiteSpace: 'nowrap', fontSize: '13px' }}>
                      {formatDateTime(log.scanned_at)}
                    </td>
                    <td>
                      <span style={{ fontFamily: 'monospace', background: '#f2f2f2', padding: '2px 6px', borderRadius: '4px', fontSize: '12px' }}>
                        {log.uuid || '-'}
                      </span>
                    </td>
                    <td style={{ fontSize: '13px' }}>{log.user_id || '-'}</td>
                    <td style={{ fontSize: '13px', fontWeight: log.name ? '500' : '400', color: log.name ? '#333' : '#bbb' }}>
                      {log.name || 'Unknown'}
                    </td>
                    <td style={{ fontSize: '12px', color: '#555' }}>{log.email || '-'}</td>
                    <td style={{ fontSize: '12px' }}>
                      {log.role ? (
                        <span style={{
                          padding: '2px 8px', borderRadius: '10px', fontSize: '11px', fontWeight: '600',
                          background: log.role === 'admin' ? '#fff3e0' : '#e8f5e9',
                          color:      log.role === 'admin' ? '#e65100' : '#2e7d32',
                        }}>
                          {log.role}
                        </span>
                      ) : '-'}
                    </td>
                    <td style={{ fontSize: '13px', fontWeight: '500' }}>{log.room || '-'}</td>
                    <td>
                      <span style={{
                        padding: '4px 10px', borderRadius: '12px', fontSize: '12px', fontWeight: '600',
                        background: log.result === 'granted' ? '#d4edda' : '#f8d7da',
                        color:      log.result === 'granted' ? '#155724' : '#721c24',
                      }}>
                        {log.result === 'granted' ? '✅ Granted' : '❌ Denied'}
                      </span>
                    </td>
                    <td>
                      <span style={{
                        padding: '2px 8px', borderRadius: '10px', fontSize: '11px',
                        background: '#e3f2fd', color: '#1565c0', fontWeight: '500'
                      }}>
                        {log.method || 'rfid'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Pagination */}
        {total > LIMIT && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 4px', fontSize: '13px', color: '#666' }}>
            <span>Showing {offset + 1}–{Math.min(offset + LIMIT, total)} of {total.toLocaleString()} records</span>
            <div style={{ display: 'flex', gap: '6px' }}>
              <button
                disabled={offset === 0}
                onClick={() => setOffset(Math.max(0, offset - LIMIT))}
                style={{ padding: '6px 12px', borderRadius: '6px', border: '1px solid #ddd', background: offset === 0 ? '#f5f5f5' : '#fff', cursor: offset === 0 ? 'not-allowed' : 'pointer', color: offset === 0 ? '#bbb' : '#333' }}
              >
                ‹ Prev
              </button>
              <span style={{ padding: '6px 12px', background: '#d88b8b', color: '#fff', borderRadius: '6px', fontWeight: '600' }}>
                {currentPage} / {totalPages}
              </span>
              <button
                disabled={offset + LIMIT >= total}
                onClick={() => setOffset(offset + LIMIT)}
                style={{ padding: '6px 12px', borderRadius: '6px', border: '1px solid #ddd', background: offset + LIMIT >= total ? '#f5f5f5' : '#fff', cursor: offset + LIMIT >= total ? 'not-allowed' : 'pointer', color: offset + LIMIT >= total ? '#bbb' : '#333' }}
              >
                Next ›
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// ==================== Notification Bell Component ====================
const NotificationBell = ({ userEmail }) => {
  const [unreadCount, setUnreadCount] = React.useState(0);
  const [notifications, setNotifications] = React.useState([]);
  const [open, setOpen] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const panelRef = React.useRef(null);

  const token = () => localStorage.getItem('token');

  // poll unread count ทุก 30 วิ
  React.useEffect(() => {
    fetchUnreadCount();
    const interval = setInterval(fetchUnreadCount, 30000);
    return () => clearInterval(interval);
  }, []);

  // close panel เมื่อคลิกข้างนอก
  React.useEffect(() => {
    const handler = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const fetchUnreadCount = async () => {
    try {
      const res = await fetch('/api/notifications/unread-count', {
        headers: { 'Authorization': `Bearer ${token()}` }
      });
      const d = await res.json();
      if (d.success) setUnreadCount(d.unread_count);
    } catch {}
  };

  const fetchNotifications = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/notifications?limit=20', {
        headers: { 'Authorization': `Bearer ${token()}` }
      });
      const d = await res.json();
      if (d.success) {
        setNotifications(d.notifications);
        setUnreadCount(d.unread_count);
      }
    } catch {}
    setLoading(false);
  };

  const handleOpen = () => {
    setOpen(v => !v);
    if (!open) fetchNotifications();
  };

  const markRead = async (id) => {
    await fetch(`/api/notifications/${id}/read`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token()}` }
    });
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: 1 } : n));
    setUnreadCount(prev => Math.max(0, prev - 1));
  };

  const markAllRead = async () => {
    await fetch('/api/notifications/read-all', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token()}` }
    });
    setNotifications(prev => prev.map(n => ({ ...n, is_read: 1 })));
    setUnreadCount(0);
  };

  const deleteNotif = async (id, e) => {
    e.stopPropagation();
    await fetch(`/api/notifications/${id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token()}` }
    });
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  const iconMap = {
    booking_result: 'fa-calendar-check',
    rfid_denied:    'fa-shield-halved',
    reminder:       'fa-clock',
  };
  const colorMap = {
    booking_result: '#4c6ef5',
    rfid_denied:    '#e53935',
    reminder:       '#f59f00',
  };

  const formatTime = (raw) => {
    if (!raw) return '';
    // SQLite เก็บ UTC ไม่มี timezone suffix → ต้องเติม Z เพื่อให้ JS รู้ว่าเป็น UTC
    const utcStr = raw.includes('T') || raw.endsWith('Z') ? raw : raw.replace(' ', 'T') + 'Z';
    const d = new Date(utcStr);
    const now = new Date();
    const diff = Math.floor((now - d) / 60000);
    if (diff < 1)  return 'เมื่อกี้';
    if (diff < 60) return `${diff} นาทีที่แล้ว`;
    if (diff < 1440) return `${Math.floor(diff / 60)} ชั่วโมงที่แล้ว`;
    return d.toLocaleDateString('th-TH', { timeZone: 'Asia/Bangkok' });
  };

  return (
    <div ref={panelRef} style={{ position: 'relative', display: 'inline-block' }}>
      {/* Bell button */}
      <button
        onClick={handleOpen}
        style={{
          position: 'relative', background: 'transparent', border: 'none',
          cursor: 'pointer', padding: '2px 4px', borderRadius: '8px',
          color: '#d28b8b', fontSize: '20px',
          transition: 'background 0.2s', marginBottom: '12px',
        }}
        title="Notifications"
      >
        <i className="fa-solid fa-bell"></i>
        {unreadCount > 0 && (
          <span style={{
            position: 'absolute', top: '2px', right: '2px',
            background: '#e53935', color: '#fff',
            borderRadius: '10px', fontSize: '10px', fontWeight: '700',
            padding: '1px 5px', minWidth: '16px', textAlign: 'center',
            border: '2px solid #fff',
          }}>
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown Panel */}
      {open && (
        <div style={{
          position: 'fixed', right: '16px', top: 'auto', width: '268px',
          background: '#fff', borderRadius: '12px', zIndex: 9999,
          boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
          border: '1px solid #eee', overflow: 'hidden',
        }}>
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 16px', borderBottom: '1px solid #f0f0f0' }}>
            <span style={{ fontWeight: '700', fontSize: '15px', color: '#333' }}>
              Notifications {unreadCount > 0 && <span style={{ background: '#e53935', color: '#fff', borderRadius: '10px', fontSize: '11px', padding: '1px 7px', marginLeft: '6px' }}>{unreadCount}</span>}
            </span>
            {unreadCount > 0 && (
              <button onClick={markAllRead} style={{ background: 'none', border: 'none', color: '#4c6ef5', fontSize: '12px', cursor: 'pointer', fontWeight: '600' }}>
                Mark all read
              </button>
            )}
          </div>

          {/* List */}
          <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
            {loading ? (
              <div style={{ textAlign: 'center', padding: '30px', color: '#aaa' }}>
                <i className="fa-solid fa-spinner fa-spin"></i>
              </div>
            ) : notifications.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px', color: '#bbb' }}>
                <i className="fa-solid fa-bell-slash" style={{ fontSize: '28px', display: 'block', marginBottom: '10px' }}></i>
                No notifications
              </div>
            ) : notifications.map(n => (
              <div
                key={n.id}
                onClick={() => !n.is_read && markRead(n.id)}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '36px 1fr 20px',
                  gap: '10px',
                  alignItems: 'start',
                  padding: '12px 16px',
                  borderBottom: '1px solid #f5f5f5',
                  background: n.is_read ? '#fff' : '#f0f4ff',
                  cursor: n.is_read ? 'default' : 'pointer',
                  transition: 'background 0.15s',
                }}
              >
                <div style={{
                  width: '36px', height: '36px', borderRadius: '50%',
                  background: `${colorMap[n.type] || '#888'}22`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: colorMap[n.type] || '#888', fontSize: '15px',
                }}>
                  <i className={`fa-solid ${iconMap[n.type] || 'fa-bell'}`}></i>
                </div>
                <div style={{ overflow: 'hidden' }}>
                  <div style={{ fontWeight: n.is_read ? '400' : '600', fontSize: '13px', color: '#333', marginBottom: '3px', wordBreak: 'break-word' }}>{n.title}</div>
                  <div style={{ fontSize: '12px', color: '#666', lineHeight: '1.6', wordBreak: 'break-word' }}>{n.message}</div>
                  <div style={{ fontSize: '11px', color: '#aaa', marginTop: '4px' }}>{formatTime(n.created_at)}</div>
                </div>
                <button
                  onClick={(e) => deleteNotif(n.id, e)}
                  style={{ background: 'none', border: 'none', color: '#ccc', cursor: 'pointer', fontSize: '13px', padding: '2px 4px' }}
                  title="Delete"
                >
                  <i className="fa-solid fa-xmark"></i>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

const RegisterRequestsPage = ({ onPrefillUser }) => {
  const [requests, setRequests] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [toast, setToast] = React.useState({ message: '', type: '' });
  const [confirmModal, setConfirmModal] = React.useState({ open: false, id: null });

  const showToast = (msg, type = 'success') => setToast({ message: msg, type });

  const fetchRequests = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/rfid-register-requests', {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      const data = await res.json();
      if (data.success) setRequests(data.requests || []);
    } catch { /* silent */ }
    setLoading(false);
  };

  React.useEffect(() => { fetchRequests(); }, []);

  const handleDone = async (req) => {
    try {
      // ดึงข้อมูลจาก admin_users ผ่าน lookup API
      const token = localStorage.getItem('token');
      const lookupRes = await fetch(`/api/user/lookup?user_id=${encodeURIComponent(req.user_id)}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const lookupData = await lookupRes.json();

      if (lookupRes.ok && lookupData.success) {
        const u = lookupData.user;
        if (u.already_registered) {
          showToast(`${u.first_name} ${u.last_name} ลงทะเบียน RFID แล้ว`, 'error');
          return;
        }
        // ส่งข้อมูลไปเติมฟอร์ม Add User ใน RightPanel
        if (onPrefillUser) onPrefillUser({
          user_id: u.user_id,
          first_name: u.first_name,
          last_name: u.last_name,
          email: u.email,
        });
        showToast(`โหลดข้อมูล ${u.first_name} ${u.last_name} แล้ว — สแกนบัตร RFID แล้วกด Add RFID`, 'success');
      } else {
        showToast('ไม่พบข้อมูลผู้ใช้', 'error');
      }
    } catch {
      showToast('เกิดข้อผิดพลาด', 'error');
    }
  };

  const handleCancel = (id) => {
    setConfirmModal({ open: true, id });
  };

  const handleCancelConfirm = async () => {
    const id = confirmModal.id;
    setConfirmModal({ open: false, id: null });
    await fetch(`/api/rfid-register-requests/${id}/cancel`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
    });
    showToast('ยกเลิกคำขอแล้ว', 'success');
    fetchRequests();
  };

  const handleDeleteDone = async (id) => {
    if (!window.confirm('ต้องการลบรายการนี้ออกจากประวัติ?')) return;
    try {
      await fetch(`/api/rfid-register-requests/${id}/delete`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      showToast('ลบรายการสำเร็จ', 'success');
      fetchRequests();
    } catch {
      showToast('เกิดข้อผิดพลาด', 'error');
    }
  };

  const pendingReqs = requests.filter(r => r.status === 'pending');
  const doneReqs = requests.filter(r => r.status !== 'pending');

  return (
    <div>
      <Toast message={toast.message} type={toast.type} onClose={() => setToast({ message: '', type: '' })} />
      <ConfirmModal
        isOpen={confirmModal.open}
        title="⚠️ ยืนยันการยกเลิกคำขอ"
        message="ต้องการยกเลิกคำขอลงทะเบียน RFID นี้ใช่ไหม? คำขอจะถูกยกเลิกและผู้ใช้จะต้องส่งคำขอใหม่"
        confirmLabel="ยืนยันยกเลิก"
        confirmColor="#e74c3c"
        onConfirm={handleCancelConfirm}
        onCancel={() => setConfirmModal({ open: false, id: null })}
      />
      <div className="page-title-box">
        <span className="page-title">RFID Register Requests</span>
      </div>
      <div className="quick-stats-title">Pending Requests</div>
      <div className="container">
        {loading ? (
          <p style={{ padding: 20, color: '#aaa' }}>กำลังโหลด...</p>
        ) : pendingReqs.length === 0 ? (
          <p style={{ padding: 20, color: '#aaa', textAlign: 'center' }}>ไม่มีคำขอที่รอดำเนินการ</p>
        ) : (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>User ID</th>
                  <th>Full Name</th>
                  <th>Email</th>
                  <th>Request Date</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {pendingReqs.map(req => (
                  <tr key={req.id}>
                    <td style={{ fontFamily: 'monospace', fontWeight: 600 }}>{req.user_id}</td>
                    <td>{req.first_name} {req.last_name}</td>
                    <td>{req.email}</td>
                    <td>{new Date(req.created_at).toLocaleString('th-TH')}</td>
                    <td>
                      <div className="action-buttons">
                        <span
                          className="action-link edit"
                          onClick={() => handleDone(req)}
                          title="โหลดข้อมูลเข้าฟอร์มลงทะเบียน"
                        >
                          Select
                        </span>
                        <span
                          className="action-link delete"
                          onClick={() => handleCancel(req.id)}
                        >
                          Cancel
                        </span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {doneReqs.length > 0 && (
        <>
          <div className="quick-stats-title" style={{ marginTop: 20 }}>Already Done</div>
          <div className="container">
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>User ID</th>
                    <th>Full Name</th>
                    <th>Email</th>
                    <th>Status</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {doneReqs.map(req => (
                    <tr key={req.id} style={{ opacity: 0.75 }}>
                      <td style={{ fontFamily: 'monospace' }}>{req.user_id}</td>
                      <td>{req.first_name} {req.last_name}</td>
                      <td>{req.email}</td>
                      <td>{req.status}</td>
                      <td>
                        <span
                          className="action-link delete"
                          onClick={() => handleDeleteDone(req.id)}
                          title="ลบออกจากประวัติ"
                        >
                          Delete
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

// ==================== Main Admin Dashboard Component ====================
const AdminDashboard = ({ user, onLogout }) => {
  const [currentPage, setCurrentPage] = useState('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [profileMode, setProfileMode] = useState(false);
  const [uuid, setUuid] = useState('');
  const [uuidUserInfo, setUuidUserInfo] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [panelKey, setPanelKey] = useState(0); // increment เพื่อ remount RightPanel และ reset formData
  const [editingUser, setEditingUser] = useState(null);
  const [prefillData, setPrefillData] = useState(null);
  const [selectedRoom, setSelectedRoom] = useState(null);
  const [settingsRefreshKey, setSettingsRefreshKey] = useState(0);

  useEffect(() => {
    const SOCKET_URL = process.env.NODE_ENV === 'production' ? window.location.origin : 'http://localhost:5000';
    const socket = io(SOCKET_URL, { transports: ['websocket', 'polling'] });
    fetch('/api/reset_uuid', { method: 'POST' }).catch(err => {
      console.error('Error resetting UUID:', err);
    });
    socket.on('uuid_update', (data) => {
      console.log('uuid_update received:', data);
      // ถ้ามาจาก ESP32_Door ไม่ต้อง update Right Panel (แค่ door access ไม่ใช่ register)
      if (data.source === 'door') return;
      if (data.user_id) {
        setUuidUserInfo({ uuid: data.uuid, user_id: data.user_id, first_name: data.first_name, last_name: data.last_name, email: data.email, role: data.role });
      } else {
        setUuidUserInfo(null);
      }
      setUuid(data.uuid || '');
    });
    return () => { socket.disconnect(); };
  }, []);

  const handleFormSubmit = () => {
    // ไปหน้า RFID Registered และ refresh ตาราง
    setCurrentPage('users');
    setRefreshKey(prev => prev + 1);
    // Reset Right Panel กลับ idle — remount เพื่อล้าง formData ทั้งหมด
    setPrefillData(null);
    setEditingUser(null);
    setPanelKey(prev => prev + 1);
    fetch('/api/reset_uuid', { method: 'POST' })
      .then(() => {
        setUuid('');
        setUuidUserInfo(null);
      })
      .catch(() => {
        setUuid('');
        setUuidUserInfo(null);
      });
  };

  // ปุ่ม "ตกลง" เมื่อสแกนบัตรที่ลงทะเบียนแล้ว — แค่ reset idle ไม่ navigate
  const handleDismissRegistered = () => {
    setPanelKey(prev => prev + 1); // remount RightPanel เพื่อล้าง formData
    fetch('/api/reset_uuid', { method: 'POST' }).catch(() => {});
    setUuid('');
    setUuidUserInfo(null);
    setPrefillData(null);
  };

  const handleEditUser = (user) => {
    setEditingUser(user);
    setCurrentPage('users');
  };

  // เติมข้อมูลผู้ใช้ลงฟอร์ม Add User (ไม่ใช่ edit) — ใช้กับ Register Requests
  const handlePrefillUser = (userData) => {
    setPrefillData(userData);
    setEditingUser(null); // ต้องไม่เป็น edit mode
    // ไม่เปลี่ยนหน้า — RightPanel แสดงฟอร์มได้ทุกหน้า
  };

  const handleCancelEdit = () => {
    setEditingUser(null);
    setPrefillData(null);
    setPanelKey(prev => prev + 1); // remount RightPanel เพื่อล้าง formData
    fetch('/api/reset_uuid', { method: 'POST' }).catch(() => {});
    setUuid('');
    setUuidUserInfo(null);
  };

  // Add room — lives at top level so no stale closure issues
  const handleAddRoom = async (roomName) => {
    const trimmed = (roomName || '').trim();
    if (!trimmed) {
      alert('กรุณากรอกชื่อห้อง');
      return;
    }
    try {
      const res = await fetch('/api/rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: trimmed })
      });
      const data = await res.json();
      if (res.ok) {
        alert(`เพิ่มห้อง "${trimmed}" สำเร็จ`);
        setSettingsRefreshKey(k => k + 1); // trigger SystemSettings to re-fetch
        // Force a new add mode state to reset the input
        setSelectedRoom(null);
        setTimeout(() => setSelectedRoom({ __addMode: true }), 50);
      } else {
        alert(data.error || 'เพิ่มห้องไม่สำเร็จ');
      }
    } catch (err) {
      console.error('Add room error:', err);
      alert('เกิดข้อผิดพลาดในการเชื่อมต่อ');
    }
  };

  // When page changes away from settings, reset room selection
  const handlePageChange = (page) => {
    if (page !== 'settings') setSelectedRoom(null);
    setCurrentPage(page);
    setSidebarOpen(false);
  };

  // Default to Add Room panel when entering settings
  useEffect(() => {
    if (currentPage === 'settings' && !selectedRoom) {
      setSelectedRoom({ __addMode: true });
    }
  }, [currentPage]);

  const renderContent = () => {
    switch (currentPage) {
      case 'dashboard':
        return <DashboardContent onPrefillUser={handlePrefillUser} />;
      case 'users':
        return <UsersTable key={refreshKey} onRefresh={refreshKey} onEditUser={handleEditUser} onPrefillUser={handlePrefillUser} />;
      case 'register_requests':
        return <RegisterRequestsPage onPrefillUser={handlePrefillUser} />;
      case 'settings':
        return (
          <SystemSettings
            onSelectRoom={(room) => {
              setSelectedRoom(room);
            }}
            selectedRoom={selectedRoom}
            refreshKey={settingsRefreshKey}
          />
        );
      case 'bookings':
        return <BookingsPage />;
      case 'logs':
        return <AccessLogs key={Date.now()} />;
      case 'my-booking':
        return (
          <RoomBooking
            user={user}
            onLogout={onLogout}
            onNavigate={(view) => setCurrentPage(view)}
            embeddedMode={true}
          />
        );
      default:
        return <DashboardContent />;
    }
  };

  const renderRightPanel = () => {
    // ซ่อน right panel เมื่ออยู่หน้าจองห้องหรือลงทะเบียน RFID
    if (currentPage === 'my-booking') {
      return null;
    }
    if (currentPage === 'settings') {
      return (
        <RoomRightPanel
          selectedRoom={selectedRoom}
          onClose={() => setSelectedRoom({ __addMode: true })}
          onAddRoom={handleAddRoom}
        />
      );
    }
    return (
      <RightPanel
        key={panelKey}
        uuid={uuid}
        uuidUserInfo={uuidUserInfo}
        onFormSubmit={handleFormSubmit}
        onDismissRegistered={handleDismissRegistered}
        editingUser={editingUser}
        onCancelEdit={handleCancelEdit}
        onEditUser={handleEditUser}
        adminUser={user}
        prefillData={prefillData}
        onClearPrefill={() => setPrefillData(null)}
        profileMode={profileMode}
        onCloseProfile={() => setProfileMode(false)}
      />
    );
  };

  return (
    <div className="layout">
      {/* Overlay backdrop — mobile only, rendered via CSS */}
      <div
        className={`sidebar-overlay${sidebarOpen ? ' open' : ''}`}
        onClick={() => setSidebarOpen(false)}
      />

      {/* Sidebar — ไม่ห่อด้วย div เพิ่มเติม */}
      <Sidebar
        currentPage={currentPage}
        onPageChange={handlePageChange}
        onLogout={onLogout}
        user={user}
        sidebarOpen={sidebarOpen}
        onAvatarClick={() => {
          setCurrentPage('users');
          setSelectedRoom(null);
          setSidebarOpen(false);
          setProfileMode(prev => !prev);
        }}
      />

      {/* Mobile top bar — hidden on desktop via CSS */}
      <div className="mobile-topbar">
        <button className="hamburger-btn" onClick={() => setSidebarOpen(v => !v)}>
          <i className={`fa-solid ${sidebarOpen ? 'fa-xmark' : 'fa-bars'}`}></i>
        </button>
        <span className="mobile-topbar-title">Admin Dashboard</span>
        <div style={{ width: 34 }} />
      </div>

      <main className="main">
        <div id="main-content">
          {renderContent()}
        </div>
      </main>

      {renderRightPanel()}
    </div>
  );
};

export default AdminDashboard;