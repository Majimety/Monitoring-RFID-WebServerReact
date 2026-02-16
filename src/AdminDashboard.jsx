import React, { useState, useEffect } from 'react';
import io from 'socket.io-client';
import './AdminDashboard.css';
import BookingsPage from './Bookingspage';

// ==================== Sidebar Component ====================
const Sidebar = ({ currentPage, onPageChange, onLogout, user }) => {
  const menuItems = [
    { id: 'dashboard', icon: 'fa-house', title: 'Dashboard' },
    { id: 'users', icon: 'fa-id-card', title: 'RFID Users' },
    { id: 'bookings', icon: 'fa-calendar-check', title: 'Booking Requests' },
    { id: 'logs', icon: 'fa-clock-rotate-left', title: 'Access Logs' },
    { id: 'settings', icon: 'fa-gear', title: 'System Settings' }
  ];

  return (
    <aside className="sidebar">
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
const RightPanel = ({ uuid, onFormSubmit, editingUser, onCancelEdit }) => {
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

  // Update form when uuid changes (for adding new user)
  useEffect(() => {
    if (!editingUser) {
      setFormData(prev => ({ ...prev, uuid: uuid || '' }));
    }
  }, [uuid, editingUser]);

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
    } else {
      // Reset form when not editing
      setFormData({
        uuid: uuid || '',
        user_id: '',
        first_name: '',
        last_name: '',
        email: '',
        role: 'student'
      });
    }
  }, [editingUser, uuid]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage({ text: '', type: '' });

    try {
      if (editingUser) {
        // Update existing user
        const response = await fetch(`/api/update_user/${editingUser.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData)
        });

        const data = await response.json();
        setMessage({
          text: data.message,
          type: data.success ? 'success' : 'error'
        });

        if (data.success) {
          // Auto-hide success message after 2 seconds
          setTimeout(() => {
            setMessage({ text: '', type: '' });
            if (onCancelEdit) onCancelEdit();
            if (onFormSubmit) onFormSubmit();
          }, 2000);
        }
      } else {
        // Add new user
        const response = await fetch('/api/add_user', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData)
        });

        const data = await response.json();
        setMessage({
          text: data.message,
          type: data.success ? 'success' : 'error'
        });

        if (data.success) {
          setFormData({
            uuid: '',
            user_id: '',
            first_name: '',
            last_name: '',
            email: '',
            role: 'student'
          });
          // Auto-hide success message after 2 seconds
          setTimeout(() => {
            setMessage({ text: '', type: '' });
            if (onFormSubmit) onFormSubmit();
          }, 2000);
        }
      }
    } catch (error) {
      setMessage({ text: 'Error saving user', type: 'error' });
    }
  };

  const handleSearch = async () => {
    if (!searchUserId.trim()) return;

    try {
      const response = await fetch('/api/users');
      const data = await response.json();
      const user = data.users.find(
        u => u.user_id === searchUserId.trim()
      );

      if (user) {
        setFormData({
          uuid: user.uuid || '',
          user_id: user.user_id || '',
          first_name: user.first_name || '',
          last_name: user.last_name || '',
          email: user.email || '',
          role: user.role || 'student'
        });
      } else {
        alert('ไม่พบ User ID นี้');
      }
    } catch (error) {
      alert('Error searching user');
    }
  };

  const handleSearchKey = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSearch();
    }
  };

  const handleCancel = () => {
    setMessage({ text: '', type: '' });
    if (onCancelEdit) onCancelEdit();
  };

  return (
    <aside className="right-panel">
      <div className="search-box">
        <i className="fa fa-search"></i>
        <input
          type="text"
          placeholder="Search User ID"
          value={searchUserId}
          onChange={(e) => setSearchUserId(e.target.value)}
          onKeyDown={handleSearchKey}
        />
      </div>

      <h3>{editingUser ? 'Edit User' : 'Add User'}</h3>

      <form onSubmit={handleSubmit}>
        <input
          type="text"
          name="uuid"
          placeholder="RFID"
          value={formData.uuid}
          readOnly
          required
        />
        <input
          type="text"
          name="user_id"
          placeholder="User ID"
          value={formData.user_id}
          onChange={handleInputChange}
          required
        />
        <input
          type="text"
          name="first_name"
          placeholder="First Name"
          value={formData.first_name}
          onChange={handleInputChange}
          required
        />
        <input
          type="text"
          name="last_name"
          placeholder="Last Name"
          value={formData.last_name}
          onChange={handleInputChange}
          required
        />
        <input
          type="email"
          name="email"
          placeholder="Email"
          value={formData.email}
          onChange={handleInputChange}
          required
        />

        {/* Custom Role Selector */}
        <div className="role-selector">
          <label>Role:</label>
          <div className="role-options">
            <button
              type="button"
              className={`role-btn ${formData.role === 'student' ? 'active' : ''}`}
              onClick={() => setFormData(prev => ({ ...prev, role: 'student' }))}
            >
              <i className="fa-solid fa-user-graduate"></i>
              <span>Student</span>
            </button>
            <button
              type="button"
              className={`role-btn ${formData.role === 'admin' ? 'active' : ''}`}
              onClick={() => setFormData(prev => ({ ...prev, role: 'admin' }))}
            >
              <i className="fa-solid fa-user-shield"></i>
              <span>Admin</span>
            </button>
          </div>
        </div>

        {editingUser ? (
          <>
            <button type="submit">Update User</button>
            <button type="button" onClick={handleCancel}>Cancel</button>
          </>
        ) : (
          <button type="submit">Add RFID</button>
        )}
      </form>

      {message.text && (
        <div className={`message ${message.type}`}>
          {message.text}
        </div>
      )}
    </aside>
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

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      // Fetch bookings
      const bookingResponse = await fetch('/api/bookings/all', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (bookingResponse.ok) {
        const bookingData = await bookingResponse.json();
        const allBookings = bookingData.bookings || [];
        
        // Filter only pending bookings for dashboard
        const pendingBookings = allBookings.filter(b => b.status === 'pending');
        setBookings(pendingBookings.slice(0, 10)); // Show only first 10

        // Calculate stats
        setStats({
          totalRequest: pendingBookings.length + 0, // Booking + Register requests
          bookingRequest: pendingBookings.length,
          registerRequest: 0 // Can be updated based on other API
        });
      }
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAccept = async (bookingId) => {
    const remark = prompt('หมายเหตุ (ถ้ามี):');
    if (remark === null) return;

    try {
      const response = await fetch(`/api/bookings/${bookingId}/approve`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ remark })
      });

      const data = await response.json();
      
      if (response.ok) {
        alert('อนุมัติการจองสำเร็จ');
        fetchDashboardData(); // Refresh data
      } else {
        alert(data.message || 'เกิดข้อผิดพลาด');
      }
    } catch (error) {
      console.error('Error approving booking:', error);
      alert('เกิดข้อผิดพลาดในการเชื่อมต่อ');
    }
  };

  const handleDecline = async (bookingId) => {
    const remark = prompt('เหตุผลในการปฏิเสธ:');
    if (!remark) return;

    try {
      const response = await fetch(`/api/bookings/${bookingId}/reject`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ remark })
      });

      const data = await response.json();
      
      if (response.ok) {
        alert('ปฏิเสธการจองสำเร็จ');
        fetchDashboardData(); // Refresh data
      } else {
        alert(data.message || 'เกิดข้อผิดพลาด');
      }
    } catch (error) {
      console.error('Error rejecting booking:', error);
      alert('เกิดข้อผิดพลาดในการเชื่อมต่อ');
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
                  <td colSpan="6" style={{textAlign: 'center', padding: '20px'}}>
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
                      <span
                        className="btn-accept"
                        onClick={() => handleAccept(booking.id)}
                      >
                        Accept
                      </span>
                      {' | '}
                      <span
                        className="btn-decline"
                        onClick={() => handleDecline(booking.id)}
                      >
                        Decline
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
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
          placeholder="Room Number (EN 1234)"
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

// ==================== Main Admin Dashboard Component ====================
const AdminDashboard = ({ user, onLogout }) => {
  const [currentPage, setCurrentPage] = useState('dashboard');
  const [uuid, setUuid] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);
  const [editingUser, setEditingUser] = useState(null);
  const [selectedRoom, setSelectedRoom] = useState(null);
  const [settingsRefreshKey, setSettingsRefreshKey] = useState(0);

  useEffect(() => {
    const socket = io({ transports: ['websocket', 'polling'] });
    fetch('/api/reset_uuid', { method: 'POST' }).catch(err => {
      console.error('Error resetting UUID:', err);
    });
    socket.on('uuid_update', (data) => {
      setUuid(data.uuid || '');
    });
    return () => { socket.disconnect(); };
  }, []);

  const handleFormSubmit = () => {
    setRefreshKey(prev => prev + 1);
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
        return <div className="page-title-box"><span className="page-title">Access Logs (Coming Soon)</span></div>;
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
        onFormSubmit={handleFormSubmit}
        editingUser={editingUser}
        onCancelEdit={handleCancelEdit}
      />
    );
  };

  return (
    <div className="layout">
      <Sidebar
        currentPage={currentPage}
        onPageChange={handlePageChange}
        onLogout={onLogout}
        user={user}
      />

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