import React, { useState, useEffect } from 'react';

const BookingsPage = () => {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all'); // 'all', 'pending', 'approved', 'rejected'

  useEffect(() => {
    fetchBookings();
  }, []);

  const fetchBookings = async () => {
    try {
      const response = await fetch('/api/bookings/all', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setBookings(data.bookings || []);
      } else {
        console.error('Failed to fetch bookings');
      }
    } catch (error) {
      console.error('Error fetching bookings:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (bookingId) => {
    const remark = prompt('หมายเหตุ (ถ้ามี):');
    if (remark === null) return; // ยกเลิก

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
        fetchBookings();
      } else {
        alert(data.message || 'เกิดข้อผิดพลาด');
      }
    } catch (error) {
      console.error('Error approving booking:', error);
      alert('เกิดข้อผิดพลาดในการเชื่อมต่อ');
    }
  };

  const handleReject = async (bookingId) => {
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
        fetchBookings();
      } else {
        alert(data.message || 'เกิดข้อผิดพลาด');
      }
    } catch (error) {
      console.error('Error rejecting booking:', error);
      alert('เกิดข้อผิดพลาดในการเชื่อมต่อ');
    }
  };

  const handleDelete = async (bookingId) => {
    if (!window.confirm('คุณต้องการลบการจองนี้หรือไม่?')) return;

    try {
      const response = await fetch(`/api/bookings/${bookingId}/delete`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      const data = await response.json();
      
      if (response.ok) {
        alert('ลบการจองสำเร็จ');
        fetchBookings();
      } else {
        alert(data.message || 'เกิดข้อผิดพลาด');
      }
    } catch (error) {
      console.error('Error deleting booking:', error);
      alert('เกิดข้อผิดพลาดในการเชื่อมต่อ');
    }
  };

  const getStatusBadge = (status) => {
    const badges = {
      'approved': { text: 'อนุมัติแล้ว', class: 'status-approved' },
      'rejected': { text: 'ปฏิเสธ', class: 'status-rejected' },
      'pending': { text: 'รอการอนุมัติ', class: 'status-pending' }
    };
    return badges[status] || badges.pending;
  };

  const filteredBookings = bookings.filter(booking => {
    if (filter === 'all') return true;
    return booking.status === filter;
  });

  // Count statistics
  const stats = {
    total: bookings.length,
    pending: bookings.filter(b => b.status === 'pending').length,
    approved: bookings.filter(b => b.status === 'approved').length,
    rejected: bookings.filter(b => b.status === 'rejected').length
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '40px', color: '#666' }}>
        <i className="fas fa-spinner fa-spin" style={{ fontSize: '32px' }}></i>
        <p>กำลังโหลดข้อมูล...</p>
      </div>
    );
  }

  return (
    <div>
      {/* Page Title */}
      <div className="page-title-box">
        <h1 className="page-title">Booking Requests</h1>
      </div>

      {/* Statistics */}
      <div className="stats" style={{ marginBottom: '24px' }}>
        <div className="stat-card">
          <div className="label">Total Requests</div>
          <b>{stats.total}</b>
        </div>
        <div className="stat-card" style={{ color: '#f39c12' }}>
          <div className="label">Pending</div>
          <b>{stats.pending}</b>
        </div>
        <div className="stat-card" style={{ color: '#4caf50' }}>
          <div className="label">Approved</div>
          <b>{stats.approved}</b>
        </div>
        <div className="stat-card" style={{ color: '#e74c3c' }}>
          <div className="label">Rejected</div>
          <b>{stats.rejected}</b>
        </div>
      </div>

      {/* Filters */}
      <div style={{ marginBottom: '20px', display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
        {['all', 'pending', 'approved', 'rejected'].map(status => (
          <button
            key={status}
            onClick={() => setFilter(status)}
            style={{
              padding: '8px 16px',
              borderRadius: '6px',
              border: filter === status ? '2px solid #d28b8b' : '1px solid #ddd',
              background: filter === status ? '#d28b8b' : 'white',
              color: filter === status ? 'white' : '#333',
              cursor: 'pointer',
              fontWeight: filter === status ? '600' : '400',
              textTransform: 'capitalize'
            }}
          >
            {status === 'all' ? 'All' : status}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="container">
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>ผู้จอง</th>
                <th>Email</th>
                <th>ห้อง</th>
                <th>วันที่</th>
                <th>เวลาเริ่ม</th>
                <th>เวลาสิ้นสุด</th>
                <th>รายละเอียด</th>
                <th>สถานะ</th>
                <th>ผู้อนุมัติ</th>
                <th>หมายเหตุ</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredBookings.length === 0 ? (
                <tr>
                  <td colSpan="12" className="no-users">
                    {filter === 'all' ? 'ไม่มีข้อมูลการจอง' : `ไม่มีการจองที่${filter === 'pending' ? 'รอการอนุมัติ' : filter === 'approved' ? 'อนุมัติแล้ว' : 'ปฏิเสธแล้ว'}`}
                  </td>
                </tr>
              ) : (
                filteredBookings.map((booking, idx) => {
                  const badge = getStatusBadge(booking.status);
                  return (
                    <tr key={booking.id}>
                      <td>{booking.id}</td>
                      <td>{booking.user_name || '-'}</td>
                      <td>{booking.user_email}</td>
                      <td>{booking.room}</td>
                      <td>{booking.date}</td>
                      <td>{booking.start_time}</td>
                      <td>{booking.end_time}</td>
                      <td style={{ maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {booking.detail || '-'}
                      </td>
                      <td>
                        <span className={`status-badge ${badge.class}`}>
                          {badge.text}
                        </span>
                      </td>
                      <td>{booking.approved_by_name || '-'}</td>
                      <td style={{ maxWidth: '150px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {booking.remark || '-'}
                      </td>
                      <td>
                        <div className="action-buttons">
                          {booking.status === 'pending' && (
                            <>
                              <button
                                className="action-link edit"
                                onClick={() => handleApprove(booking.id)}
                                title="อนุมัติ"
                              >
                                <i className="fas fa-check"></i>
                              </button>
                              <button
                                className="action-link delete"
                                onClick={() => handleReject(booking.id)}
                                title="ปฏิเสธ"
                              >
                                <i className="fas fa-times"></i>
                              </button>
                            </>
                          )}
                          <button
                            className="action-link delete"
                            onClick={() => handleDelete(booking.id)}
                            title="ลบ"
                          >
                            <i className="fas fa-trash"></i>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default BookingsPage;