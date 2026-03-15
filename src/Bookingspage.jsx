import React, { useState, useEffect } from 'react';

// ==================== Remark Modal (Bug #7 Fix) ====================
const RemarkModal = ({ isOpen, mode, onConfirm, onCancel }) => {
  const [remark, setRemark] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  React.useEffect(() => { if (isOpen) setRemark(''); }, [isOpen]);
  if (!isOpen) return null;
  const isApprove = mode === 'approve';
  const handleConfirm = async () => {
    if (!isApprove && !remark.trim()) return;
    setLoading(true);
    await onConfirm(remark.trim());
    setLoading(false);
  };
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.45)' }} onClick={onCancel} />
      <div style={{ position: 'relative', background: '#fff', borderRadius: '12px', padding: '28px', width: '400px', maxWidth: '90vw', boxShadow: '0 10px 40px rgba(0,0,0,0.2)' }}>
        <h3 style={{ margin: '0 0 6px', color: '#333', fontSize: '18px' }}>{isApprove ? '✅ อนุมัติการจอง' : '❌ ปฏิเสธการจอง'}</h3>
        <p style={{ margin: '0 0 16px', color: '#666', fontSize: '14px' }}>{isApprove ? 'ระบุหมายเหตุ (ถ้ามี)' : 'กรุณาระบุเหตุผลในการปฏิเสธ'}</p>
        <textarea autoFocus value={remark} onChange={e => setRemark(e.target.value)}
          placeholder={isApprove ? 'หมายเหตุ (ไม่บังคับ)' : 'เหตุผลในการปฏิเสธ *'} rows={3}
          style={{ width: '100%', padding: '10px', border: `1px solid ${!isApprove && !remark.trim() ? '#ffcdd2' : '#ddd'}`, borderRadius: '8px', fontSize: '14px', resize: 'vertical', fontFamily: 'inherit', boxSizing: 'border-box' }}
        />
        {!isApprove && !remark.trim() && <p style={{ color: '#d32f2f', fontSize: '12px', margin: '4px 0 0' }}>* จำเป็นต้องระบุเหตุผล</p>}
        <div style={{ display: 'flex', gap: '10px', marginTop: '16px' }}>
          <button onClick={handleConfirm} disabled={loading || (!isApprove && !remark.trim())}
            style={{ flex: 1, padding: '11px', borderRadius: '8px', border: 'none', background: isApprove ? '#4caf50' : '#e74c3c', color: '#fff', fontWeight: '600', fontSize: '14px', cursor: 'pointer', opacity: loading || (!isApprove && !remark.trim()) ? 0.6 : 1 }}>
            {loading ? '...' : isApprove ? 'อนุมัติ' : 'ปฏิเสธ'}
          </button>
          <button onClick={onCancel} disabled={loading}
            style={{ flex: 1, padding: '11px', borderRadius: '8px', border: '1px solid #ddd', background: '#fff', color: '#333', fontWeight: '600', fontSize: '14px', cursor: 'pointer' }}>
            ยกเลิก
          </button>
        </div>
      </div>
    </div>
  );
};

const BookingsPage = () => {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  // Bug #7 Fix: Modal state แทน prompt/alert
  const [remarkModal, setRemarkModal] = useState({ open: false, mode: '', bookingId: null });
  const [confirmDelete, setConfirmDelete] = useState({ open: false, bookingId: null });
  const [toast, setToast] = useState({ message: '', type: '' });

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast({ message: '', type: '' }), 3000);
  };

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

  const handleApprove = (bookingId) => {
    setRemarkModal({ open: true, mode: 'approve', bookingId });
  };

  const handleReject = (bookingId) => {
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
        fetchBookings();
      } else {
        showToast(data.message || 'เกิดข้อผิดพลาด', 'error');
      }
    } catch {
      showToast('เกิดข้อผิดพลาดในการเชื่อมต่อ', 'error');
    }
  };

  const handleDelete = (bookingId) => {
    setConfirmDelete({ open: true, bookingId });
  };

  const handleDeleteConfirm = async () => {
    const { bookingId } = confirmDelete;
    setConfirmDelete({ open: false, bookingId: null });
    try {
      const response = await fetch(`/api/bookings/${bookingId}/delete`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      const data = await response.json();
      if (response.ok) {
        showToast('ลบการจองสำเร็จ', 'success');
        fetchBookings();
      } else {
        showToast(data.message || 'เกิดข้อผิดพลาด', 'error');
      }
    } catch {
      showToast('เกิดข้อผิดพลาดในการเชื่อมต่อ', 'error');
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
    <>
      {/* Remark Modal */}
      {remarkModal.open && (
        <RemarkModal
          isOpen={remarkModal.open}
          mode={remarkModal.mode}
          onConfirm={handleRemarkConfirm}
          onCancel={() => setRemarkModal({ open: false, mode: '', bookingId: null })}
        />
      )}

      {/* Delete Confirm Modal */}
      {confirmDelete.open && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.45)' }} onClick={() => setConfirmDelete({ open: false, bookingId: null })} />
          <div style={{ position: 'relative', background: '#fff', borderRadius: '12px', padding: '28px', width: '360px', maxWidth: '90vw', boxShadow: '0 10px 40px rgba(0,0,0,0.2)', textAlign: 'center' }}>
            <i className="fa-solid fa-triangle-exclamation" style={{ fontSize: '36px', color: '#f39c12', marginBottom: '12px' }}></i>
            <h3 style={{ margin: '0 0 8px', color: '#333' }}>ยืนยันการลบ</h3>
            <p style={{ color: '#666', fontSize: '14px', marginBottom: '20px' }}>คุณต้องการลบการจองนี้หรือไม่? ไม่สามารถย้อนกลับได้</p>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={handleDeleteConfirm} style={{ flex: 1, padding: '11px', borderRadius: '8px', border: 'none', background: '#e74c3c', color: '#fff', fontWeight: '600', cursor: 'pointer' }}>ลบ</button>
              <button onClick={() => setConfirmDelete({ open: false, bookingId: null })} style={{ flex: 1, padding: '11px', borderRadius: '8px', border: '1px solid #ddd', background: '#fff', color: '#333', fontWeight: '600', cursor: 'pointer' }}>ยกเลิก</button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast.message && (
        <div style={{ position: 'fixed', bottom: '24px', right: '24px', zIndex: 3000, background: toast.type === 'success' ? '#4caf50' : '#e74c3c', color: '#fff', padding: '14px 20px', borderRadius: '10px', boxShadow: '0 4px 16px rgba(0,0,0,0.2)', fontSize: '14px', fontWeight: '500' }}>
          <i className={`fa-solid ${toast.type === 'success' ? 'fa-circle-check' : 'fa-circle-exclamation'}`} style={{ marginRight: '8px' }}></i>
          {toast.message}
        </div>
      )}

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
              padding: '8px 18px',
              borderRadius: '8px',
              border: filter === status ? '2px solid #fff' : '1px solid #ccc',
              background: filter === status ? '#c0675f' : 'white',
              color: filter === status ? 'white' : '#555',
              cursor: 'pointer',
              fontWeight: filter === status ? '700' : '400',
              textTransform: 'capitalize',
              boxShadow: filter === status ? '0 0 0 3px #c0675f55, inset 0 1px 3px rgba(0,0,0,0.2)' : 'none',
              outline: filter === status ? '2px solid #c0675f' : 'none',
              transform: filter === status ? 'scale(1.05)' : 'scale(1)',
              transition: 'all 0.15s',
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
                <th>Booker</th>
                <th>Email</th>
                <th>Room</th>
                <th>Date</th>
                <th>Start Time</th>
                <th>End Time</th>
                <th>Details</th>
                <th>Status</th>
                <th>Approved By</th>
                <th>Remarks</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredBookings.length === 0 ? (
                <tr>
                <td colSpan="11" className="no-users">
                    {filter === 'all' ? 'ไม่มีข้อมูลการจอง' : `ไม่มีการจองที่${filter === 'pending' ? 'รอการอนุมัติ' : filter === 'approved' ? 'อนุมัติแล้ว' : 'ปฏิเสธแล้ว'}`}
                  </td>
                </tr>
              ) : (
                filteredBookings.map((booking, idx) => {
                  const badge = getStatusBadge(booking.status);
                  return (
                    <tr key={booking.id}>
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
                          {booking.status === 'pending' ? (
                            <>
                              <button
                                className="action-link accept"
                                onClick={() => handleApprove(booking.id)}
                              >
                                Accept
                              </button>
                              <button
                                className="action-link decline"
                                onClick={() => handleReject(booking.id)}
                              >
                                Decline
                              </button>
                            </>
                          ) : (
                            <button
                              className="action-link delete"
                              onClick={() => handleDelete(booking.id)}
                              title="ลบ"
                            >
                              <i className="fas fa-trash"></i>
                            </button>
                          )}
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
    </>
  );
};

export default BookingsPage;