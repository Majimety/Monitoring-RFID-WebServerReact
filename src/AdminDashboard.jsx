import React, { useState, useEffect } from 'react';
import io from 'socket.io-client';
import './AdminDashboard.css';

// ==================== Sidebar Component ====================
const Sidebar = ({ currentPage, onPageChange }) => {
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
            // Fallback to SVG if PNG not found
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
      </div>
    </aside>
  );
};

// ==================== Right Panel Component ====================
const RightPanel = ({ uuid, onFormSubmit }) => {
  const [formData, setFormData] = useState({
    uuid: '',
    user_id: '',
    first_name: '',
    last_name: '',
    email: ''
  });
  const [searchUserId, setSearchUserId] = useState('');
  const [message, setMessage] = useState({ text: '', type: '' });

  useEffect(() => {
    setFormData(prev => ({ ...prev, uuid: uuid || '' }));
  }, [uuid]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage({ text: '', type: '' });

    try {
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
          email: ''
        });
        setTimeout(() => {
          if (onFormSubmit) onFormSubmit();
        }, 1000);
      }
    } catch (error) {
      setMessage({ text: 'Error adding user', type: 'error' });
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
          email: user.email || ''
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

      <h3>USER ID:</h3>

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
        <button type="submit">Add RFID</button>
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
    totalBooking: 0,
    bookingRequest: 0,
    registerRequest: 10
  });

  const bookings = [
    {
      room: 'EN4401',
      date: '25 Jul 2020',
      time: '11:00 - 12:00',
      detail: 'Project Meeting'
    },
    {
      room: 'EN4401',
      date: '26 Jul 2020',
      time: '14:00 - 15:00',
      detail: 'Seminar'
    }
  ];

  useEffect(() => {
    setStats({
      totalBooking: bookings.length + 10,
      bookingRequest: bookings.length,
      registerRequest: 10
    });
  }, []);

  const handleAccept = (index) => {
    alert(`Accepted booking ${index + 1}`);
  };

  const handleDecline = (index) => {
    alert(`Declined booking ${index + 1}`);
  };

  return (
    <div>
      <div className="page-title-box">
        <span className="page-title">Admin Dashboard</span>
      </div>

      <div className="quick-stats-title">Quick Stats</div>

      <div className="stats">
        <div className="stat-card">
          <div className="label">Total Booking</div>
          <b>{stats.totalBooking}</b>
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

      <div className="bookings-title">Bookings</div>

      <div className="container">
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Room</th>
                <th>Date</th>
                <th>Time</th>
                <th>Detail</th>
                <th>Decision</th>
              </tr>
            </thead>
            <tbody>
              {bookings.map((booking, index) => (
                <tr key={index}>
                  <td>{booking.room}</td>
                  <td>{booking.date}</td>
                  <td>{booking.time}</td>
                  <td>{booking.detail}</td>
                  <td>
                    <span className="btn-accept" onClick={() => handleAccept(index)}>
                      Accept
                    </span>{' '}
                    |{' '}
                    <span className="btn-decline" onClick={() => handleDecline(index)}>
                      Decline
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

// ==================== Users Table Component ====================
const UsersTable = ({ onRefresh }) => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadUsers();
  }, [onRefresh]);

  const loadUsers = async () => {
    try {
      const response = await fetch('/api/users');
      const data = await response.json();
      setUsers(data.users || []);
      setLoading(false);
    } catch (error) {
      console.error('Error loading users:', error);
      setLoading(false);
    }
  };

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
                          <a href={`/edit/${user.id}`} className="action-link edit">
                            Edit
                          </a>
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
                      <a href={`/edit/${user.id}`} className="action-link edit">
                        Edit
                      </a>
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

// ==================== System Settings Component ====================
const SystemSettings = () => {
  const [doorStatus, setDoorStatus] = useState('LOCKED');

  const openDoor = async () => {
    try {
      const response = await fetch('/api/door/open', { method: 'POST' });
      const data = await response.json();
      alert(data.message);
      setDoorStatus('OPEN');
    } catch (error) {
      alert('Error opening door');
    }
  };

  const closeDoor = async () => {
    try {
      const response = await fetch('/api/door/close', { method: 'POST' });
      const data = await response.json();
      alert(data.message);
      setDoorStatus('LOCKED');
    } catch (error) {
      alert('Error closing door');
    }
  };

  return (
    <div>
      <div className="page-title-box">
        <div className="page-title">System Settings</div>
      </div>

      <div className="door-stats">
        <div className="stat-card">
          <div className="label">Status</div>
          <div className={`door-status ${doorStatus.toLowerCase()}`}>
            {doorStatus}
          </div>

          <div className="door-actions">
            <button className="door-btn open" onClick={openDoor}>
              OPEN
            </button>
            <button className="door-btn close" onClick={closeDoor}>
              CLOSE
            </button>
          </div>
        </div>

        <div className="stat-card empty"></div>
        <div className="stat-card empty"></div>
      </div>
    </div>
  );
};

// ==================== Main Admin Dashboard Component ====================
const AdminDashboard = () => {
  const [currentPage, setCurrentPage] = useState('dashboard');
  const [uuid, setUuid] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    // Initialize Socket.IO
    const socket = io({ transports: ['websocket', 'polling'] });

    // Reset UUID on load
    fetch('/api/reset_uuid', { method: 'POST' }).catch(err => {
      console.error('Error resetting UUID:', err);
    });

    // Listen for UUID updates
    socket.on('uuid_update', (data) => {
      setUuid(data.uuid || '');
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  const handleFormSubmit = () => {
    setRefreshKey(prev => prev + 1);
  };

  const renderContent = () => {
    switch (currentPage) {
      case 'dashboard':
        return <DashboardContent />;
      case 'users':
        return <UsersTable onRefresh={refreshKey} />;
      case 'settings':
        return <SystemSettings />;
      case 'bookings':
        return <div className="page-title-box"><span className="page-title">Booking Requests (Coming Soon)</span></div>;
      case 'logs':
        return <div className="page-title-box"><span className="page-title">Access Logs (Coming Soon)</span></div>;
      default:
        return <DashboardContent />;
    }
  };

  return (
    <div className="layout">
      <Sidebar currentPage={currentPage} onPageChange={setCurrentPage} />

      <main className="main">
        <div id="main-content">
          {renderContent()}
        </div>
      </main>

      <RightPanel uuid={uuid} onFormSubmit={handleFormSubmit} />
    </div>
  );
};

export default AdminDashboard;