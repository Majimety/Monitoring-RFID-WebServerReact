import React, { useState, useEffect } from 'react';
import io from 'socket.io-client';
import './AdminDashboard.css';
import BookingsPage from './Bookingspage';

// ==================== Sidebar Component ====================
const Sidebar = ({ currentPage, onPageChange, onLogout, user, sidebarOpen }) => {
  const menuItems = [
    { id: 'dashboard', icon: 'fa-house', title: 'Dashboard' },
    { id: 'users', icon: 'fa-id-card', title: 'RFID Users' },
    { id: 'bookings', icon: 'fa-calendar-check', title: 'Booking Requests' },
    { id: 'logs', icon: 'fa-clock-rotate-left', title: 'Access Logs' },
    { id: 'settings', icon: 'fa-gear', title: 'System Settings' }
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
        <div className="sidebar-user">
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
const RightPanel = ({ uuid, uuidUserInfo, onFormSubmit, editingUser, onCancelEdit, onEditUser, adminUser }) => {
  const [formData, setFormData] = useState({
    uuid: '',
    user_id: '',
    first_name: '',
    last_name: '',
    email: '',
    role: 'student'
  });
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
        // New card scanned → reset all fields for fresh entry
        setFormData({ uuid: uuid, user_id: '', first_name: '', last_name: '', email: '', role: 'student' });
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

  const handleSearch = async () => {
    if (!searchUserId.trim()) return;
    try {
      const response = await fetch('/api/users');
      const data = await response.json();
      const user = data.users.find(u => u.user_id === searchUserId.trim());
      if (user) {
        // Trigger edit mode directly — same as clicking Edit in the table
        if (onEditUser) {
          onEditUser(user);
        }
        setSearchUserId('');
      } else {
        alert('ไม่พบ User ID นี้');
      }
    } catch (error) {
      alert('Error searching user');
    }
  };

  const handleSearchKey = (e) => {
    if (e.key === 'Enter') { e.preventDefault(); handleSearch(); }
  };

  const handleCancel = () => {
    setMessage({ text: '', type: '' });
    if (onCancelEdit) onCancelEdit();
  };

  // ---- Render States ----
  // State 1: Editing existing user (from table edit button)
  const isEditing = !!editingUser;
  // State 2: UUID scanned & already registered
  const isRegistered = uuid && uuidUserInfo;
  // State 3: UUID scanned & NOT registered yet → show add form
  const isNewScan = uuid && !uuidUserInfo && !editingUser;
  // State 4: No UUID scanned, not editing
  const isIdle = !uuid && !editingUser;

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
            onChange={(e) => setSearchUserId(e.target.value)}
            onKeyDown={handleSearchKey}
          />
        </div>
        <div style={{ flexShrink: 0 }}>
          <NotificationBell userEmail={adminUser?.email} />
        </div>
      </div>

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
            onClick={() => { if (onFormSubmit) onFormSubmit(); }}
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
          <div style={{ background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: 6, padding: '8px 12px', marginBottom: 14, fontSize: 12, color: '#92400e' }}>
            <i className="fa-solid fa-circle-info" style={{ marginRight: 6 }}></i>
            บัตรใหม่ — กรอกข้อมูลเพื่อลงทะเบียน
          </div>
          <form onSubmit={handleSubmit}>
            <input type="text" name="uuid" placeholder="RFID" value={formData.uuid} readOnly required style={{ background: '#f5f5f5' }} />
            <input type="text" name="user_id" placeholder="User ID" value={formData.user_id} onChange={handleInputChange} required />
            <input type="text" name="first_name" placeholder="First Name" value={formData.first_name} onChange={handleInputChange} required />
            <input type="text" name="last_name" placeholder="Last Name" value={formData.last_name} onChange={handleInputChange} required />
            <input type="email" name="email" placeholder="Email" value={formData.email} onChange={handleInputChange} required />
            <div className="role-selector">
              <label>Role:</label>
              <div className="role-options">
                <button type="button" className={`role-btn ${formData.role === 'student' ? 'active' : ''}`} onClick={() => setFormData(prev => ({ ...prev, role: 'student' }))}>
                  <i className="fa-solid fa-user-graduate"></i><span>Student</span>
                </button>
                <button type="button" className={`role-btn ${formData.role === 'admin' ? 'active' : ''}`} onClick={() => setFormData(prev => ({ ...prev, role: 'admin' }))}>
                  <i className="fa-solid fa-user-shield"></i><span>Admin</span>
                </button>
              </div>
            </div>
            <button type="submit">Add RFID</button>
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
            <div className="role-selector">
              <label>Role:</label>
              <div className="role-options">
                <button type="button" className={`role-btn ${formData.role === 'student' ? 'active' : ''}`} onClick={() => setFormData(prev => ({ ...prev, role: 'student' }))}>
                  <i className="fa-solid fa-user-graduate"></i><span>Student</span>
                </button>
                <button type="button" className={`role-btn ${formData.role === 'admin' ? 'active' : ''}`} onClick={() => setFormData(prev => ({ ...prev, role: 'admin' }))}>
                  <i className="fa-solid fa-user-shield"></i><span>Admin</span>
                </button>
              </div>
            </div>
            <button type="submit">Update User</button>
            <button type="button" onClick={handleCancel} style={{ marginTop: 8 }}>Cancel</button>
          </form>
          {message.text && <div className={`message ${message.type}`}>{message.text}</div>}
        </div>
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
const DashboardContent = () => {
  const [stats, setStats] = useState({
    totalRequest: 0,
    bookingRequest: 0,
    registerRequest: 0
  });
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);

  // Bug #7 Fix: Modal state แทน prompt/alert
  const [remarkModal, setRemarkModal] = useState({ open: false, mode: '', bookingId: null });
  const [toast, setToast] = useState({ message: '', type: '' });

  const showToast = (message, type = 'success') => setToast({ message, type });

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      const bookingResponse = await fetch('/api/bookings/all', {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      if (bookingResponse.ok) {
        const bookingData = await bookingResponse.json();
        const allBookings = bookingData.bookings || [];
        const pendingBookings = allBookings.filter(b => b.status === 'pending');
        setBookings(pendingBookings.slice(0, 10));
        setStats({
          totalRequest: pendingBookings.length,
          bookingRequest: pendingBookings.length,
          registerRequest: 0
        });
      }
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

        <div className="bookings-title">Recent Booking Requests</div>

        <div className="container">
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>ผู้จอง</th>
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
                        <span className="btn-accept" onClick={() => handleAccept(booking.id)}>Accept</span>
                        {' | '}
                        <span className="btn-decline" onClick={() => handleDecline(booking.id)}>Decline</span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  );
};

// ==================== Users Table Component ====================
const UsersTable = ({ onRefresh, onEditUser }) => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadUsers = async () => {
    try {
      const response = await fetch('/api/users');
      const data = await response.json();
      setUsers(data.users || []);
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

  const adminCount = users.filter(u => u.role === 'admin').length;
  const studentCount = users.filter(u => u.role === 'student').length;

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
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

      <div className="bookings-title">Users</div>

      <div className="container">
        {users.length > 0 ? (
          <>
            {/* Desktop Table View */}
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>ID</th>
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
                      <td>{user.id}</td>
                      <td>{user.uuid}</td>
                      <td>{user.user_id}</td>
                      <td>{user.first_name}</td>
                      <td>{user.last_name}</td>
                      <td>{user.email}</td>
                      <td>{user.role}</td>
                      <td>
                        <div className="action-buttons">
                          <span
                            className="action-link edit"
                            onClick={() => handleEdit(user.id)}
                          >
                            Edit
                          </span>
                          <span
                            className="action-link delete"
                            onClick={() => handleDelete(user.id)}
                          >
                            Delete
                          </span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Card View */}
            <div className="mobile-cards">
              {users.map(user => (
                <div key={user.id} className="user-card">
                  <div className="card-header">
                    <div className="card-id">ID: {user.id}</div>
                    <div className="card-actions">
                      <span
                        className="action-link edit"
                        onClick={() => handleEdit(user.id)}
                      >
                        Edit
                      </span>
                      <span
                        className="action-link delete"
                        onClick={() => handleDelete(user.id)}
                      >
                        Delete
                      </span>
                    </div>
                  </div>

                  <div className="card-field">
                    <div className="field-label">UUID:</div>
                    <div className="field-value">{user.uuid}</div>
                  </div>

                  <div className="card-field">
                    <div className="field-label">User ID:</div>
                    <div className="field-value">{user.user_id}</div>
                  </div>

                  <div className="card-field">
                    <div className="field-label">Name:</div>
                    <div className="field-value">
                      {user.first_name} {user.last_name}
                    </div>
                  </div>

                  <div className="card-field">
                    <div className="field-label">Email:</div>
                    <div className="field-value">{user.email}</div>
                  </div>

                  <div className="card-field">
                    <div className="field-label">Role:</div>
                    <div className="field-value">{user.role}</div>
                  </div>
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className="no-users">
            <p>No users found.</p>
          </div>
        )}
      </div>
    </div>
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
      setRooms(updated);
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

      <div className="rooms-grid">
        {rooms.length === 0 && (
          <div className="no-rooms">
            <i className="fa-solid fa-door-open" style={{ fontSize: 40, color: '#d28b8b', marginBottom: 12 }}></i>
            <p>ยังไม่มีห้อง กดปุ่ม "Add Room" เพื่อเพิ่ม</p>
          </div>
        )}
        {rooms.map(room => (
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
        ))}
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
        headers: { 'Content-Type': 'application/json' },
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
    const d = new Date(raw);
    return d.toLocaleString('th-TH', {
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit'
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
            style={{ flex: 1, padding: '8px 12px', border: '1px solid #ddd', borderRadius: '6px', fontSize: '13px' }}
          />
          <button
            onClick={handleSearch}
            style={{ padding: '8px 14px', background: '#d88b8b', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '13px' }}
          >
            <i className="fa-solid fa-magnifying-glass"></i>
          </button>
          {search && (
            <button
              onClick={() => { setSearchInput(''); setSearch(''); setOffset(0); }}
              style={{ padding: '8px 10px', background: '#f2f2f2', border: '1px solid #ddd', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', color: '#666' }}
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
                border: filterResult === opt.value ? '2px solid #d88b8b' : '1px solid #ddd',
                background: filterResult === opt.value ? '#d88b8b' : 'white',
                color: filterResult === opt.value ? 'white' : '#333',
                fontWeight: filterResult === opt.value ? '600' : '400',
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* Refresh */}
        <button
          onClick={() => fetchLogs()}
          style={{ padding: '8px 12px', background: '#f2f2f2', border: '1px solid #ddd', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', color: '#555' }}
          title="รีเฟรช"
        >
          <i className="fa-solid fa-rotate-right"></i>
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
                  <th>Student ID</th>
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
    const d = new Date(raw);
    const now = new Date();
    const diff = Math.floor((now - d) / 60000);
    if (diff < 1)  return 'just now';
    if (diff < 60) return `${diff}m ago`;
    if (diff < 1440) return `${Math.floor(diff/60)}h ago`;
    return d.toLocaleDateString('th-TH');
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
                  display: 'flex', alignItems: 'flex-start', gap: '12px',
                  padding: '12px 16px', borderBottom: '1px solid #f5f5f5',
                  background: n.is_read ? '#fff' : '#f0f4ff',
                  cursor: n.is_read ? 'default' : 'pointer',
                  transition: 'background 0.15s',
                }}
              >
                <div style={{
                  width: '36px', height: '36px', borderRadius: '50%', flexShrink: 0,
                  background: `${colorMap[n.type] || '#888'}22`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: colorMap[n.type] || '#888', fontSize: '15px',
                }}>
                  <i className={`fa-solid ${iconMap[n.type] || 'fa-bell'}`}></i>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: n.is_read ? '400' : '600', fontSize: '13px', color: '#333', marginBottom: '3px' }}>{n.title}</div>
                  <div style={{ fontSize: '12px', color: '#666', lineHeight: '1.4', wordBreak: 'break-word' }}>{n.message}</div>
                  <div style={{ fontSize: '11px', color: '#aaa', marginTop: '4px' }}>{formatTime(n.created_at)}</div>
                </div>
                <button
                  onClick={(e) => deleteNotif(n.id, e)}
                  style={{ background: 'none', border: 'none', color: '#ccc', cursor: 'pointer', fontSize: '13px', padding: '2px 4px', flexShrink: 0 }}
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

// ==================== Main Admin Dashboard Component ====================
const AdminDashboard = ({ user, onLogout }) => {
  const [currentPage, setCurrentPage] = useState('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [uuid, setUuid] = useState('');
  const [uuidUserInfo, setUuidUserInfo] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [editingUser, setEditingUser] = useState(null);
  const [selectedRoom, setSelectedRoom] = useState(null);
  const [settingsRefreshKey, setSettingsRefreshKey] = useState(0);

  useEffect(() => {
    const socket = io(window.location.origin, { transports: ['websocket', 'polling'] });
    fetch('/api/reset_uuid', { method: 'POST' }).catch(err => {
      console.error('Error resetting UUID:', err);
    });
    socket.on('uuid_update', (data) => {
      console.log('uuid_update received:', data);
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
    setRefreshKey(prev => prev + 1);
    // Reset uuid via API — the socket uuid_update event will clear uuid state naturally
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

  const handleEditUser = (user) => {
    setEditingUser(user);
    setCurrentPage('users');
  };

  const handleCancelEdit = () => {
    setEditingUser(null);
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
        return <DashboardContent />;
      case 'users':
        return <UsersTable onRefresh={refreshKey} onEditUser={handleEditUser} />;
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
        return <AccessLogs />;
      default:
        return <DashboardContent />;
    }
  };

  const renderRightPanel = () => {
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
        uuid={uuid}
        uuidUserInfo={uuidUserInfo}
        onFormSubmit={handleFormSubmit}
        editingUser={editingUser}
        onCancelEdit={handleCancelEdit}
        onEditUser={handleEditUser}
        adminUser={user}
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