import React, { useState, useEffect, useRef, useMemo } from 'react';
import './RoomBooking.css';

// ==================== Notification Bell ====================
const NotificationBell = ({ userEmail }) => {
  const [unreadCount, setUnreadCount] = React.useState(0);
  const [notifications, setNotifications] = React.useState([]);
  const [open, setOpen] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const panelRef = React.useRef(null);
  const token = () => localStorage.getItem('token');

  React.useEffect(() => {
    fetchUnreadCount();
    const iv = setInterval(fetchUnreadCount, 30000);
    return () => clearInterval(iv);
  }, []);

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
    } catch { }
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
    } catch { }
    setLoading(false);
  };

  const handleOpen = () => {
    setOpen(v => !v);
    if (!open) fetchNotifications();
  };

  const markRead = async (id) => {
    await fetch(`/api/notifications/${id}/read`, {
      method: 'POST', headers: { 'Authorization': `Bearer ${token()}` }
    });
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: 1 } : n));
    setUnreadCount(prev => Math.max(0, prev - 1));
  };

  const markAllRead = async () => {
    await fetch('/api/notifications/read-all', {
      method: 'POST', headers: { 'Authorization': `Bearer ${token()}` }
    });
    setNotifications(prev => prev.map(n => ({ ...n, is_read: 1 })));
    setUnreadCount(0);
  };

  const deleteNotif = async (id, e) => {
    e.stopPropagation();
    await fetch(`/api/notifications/${id}`, {
      method: 'DELETE', headers: { 'Authorization': `Bearer ${token()}` }
    });
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  const iconMap = { booking_result: 'fa-calendar-check', reminder: 'fa-clock' };
  const colorMap = { booking_result: '#4c6ef5', reminder: '#f59f00' };

  const formatTime = (raw) => {
    if (!raw) return '';
    const diff = Math.floor((new Date() - new Date(raw)) / 60000);
    if (diff < 1) return 'just now';
    if (diff < 60) return `${diff}m ago`;
    if (diff < 1440) return `${Math.floor(diff / 60)}h ago`;
    return new Date(raw).toLocaleDateString('th-TH');
  };

  return (
    <div ref={panelRef} style={{ position: 'relative', display: 'inline-block' }}>
      <button
        onClick={handleOpen}
        style={{ position: 'relative', background: 'transparent', border: 'none', cursor: 'pointer', padding: '8px 10px', color: '#d28b8b', fontSize: '20px' }}
        title="Notifications"
      >
        <i className="fa-solid fa-bell"></i>
        {unreadCount > 0 && (
          <span style={{ position: 'absolute', top: '2px', right: '2px', background: '#e53935', color: '#fff', borderRadius: '10px', fontSize: '10px', fontWeight: '700', padding: '1px 5px', border: '2px solid #fff' }}>
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div style={{ position: 'absolute', right: 0, top: '44px', width: '340px', background: '#fff', borderRadius: '12px', zIndex: 9999, boxShadow: '0 8px 32px rgba(0,0,0,0.18)', border: '1px solid #eee', overflow: 'hidden' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 16px', borderBottom: '1px solid #f0f0f0' }}>
            <span style={{ fontWeight: '700', fontSize: '15px', color: '#333' }}>
              Notifications
              {unreadCount > 0 && (
                <span style={{ background: '#e53935', color: '#fff', borderRadius: '10px', fontSize: '11px', padding: '1px 7px', marginLeft: '6px' }}>
                  {unreadCount}
                </span>
              )}
            </span>
            {unreadCount > 0 && (
              <button onClick={markAllRead} style={{ background: 'none', border: 'none', color: '#4c6ef5', fontSize: '12px', cursor: 'pointer', fontWeight: '600' }}>
                Mark all read
              </button>
            )}
          </div>

          <div style={{ maxHeight: '380px', overflowY: 'auto' }}>
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
                style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', padding: '12px 16px', borderBottom: '1px solid #f5f5f5', background: n.is_read ? '#fff' : '#f0f4ff', cursor: n.is_read ? 'default' : 'pointer' }}
              >
                <div style={{ width: '34px', height: '34px', borderRadius: '50%', flexShrink: 0, background: `${colorMap[n.type] || '#888'}22`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: colorMap[n.type] || '#888', fontSize: '14px' }}>
                  <i className={`fa-solid ${iconMap[n.type] || 'fa-bell'}`}></i>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: n.is_read ? '400' : '600', fontSize: '13px', color: '#333', marginBottom: '3px' }}>{n.title}</div>
                  <div style={{ fontSize: '12px', color: '#666', lineHeight: '1.4' }}>{n.message}</div>
                  <div style={{ fontSize: '11px', color: '#aaa', marginTop: '4px' }}>{formatTime(n.created_at)}</div>
                </div>
                <button onClick={(e) => deleteNotif(n.id, e)} style={{ background: 'none', border: 'none', color: '#ccc', cursor: 'pointer', fontSize: '13px' }} title="Delete">
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


// ==================== RFID Status Popup ====================
const RfidStatusPopup = ({ mode, onClose }) => {
  // mode: 'register' = ยังไม่ได้ส่งคำขอ, 'warning' = มี pending แล้ว / หลังส่งคำขอ
  const [step, setStep] = React.useState(mode); // 'register' | 'sent' | 'warning'
  const [sending, setSending] = React.useState(false);
  const [err, setErr] = React.useState('');

  const handleSend = async () => {
    setSending(true);
    setErr('');
    try {
      const res = await fetch('/api/rfid-register-request', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setStep('sent');
      } else {
        setErr(data.error || 'เกิดข้อผิดพลาด');
      }
    } catch {
      setErr('ไม่สามารถเชื่อมต่อ server ได้');
    } finally {
      setSending(false);
    }
  };

  const overlayStyle = {
    position: 'fixed', inset: 0, zIndex: 9999,
    display: 'flex', alignItems: 'center', justifyContent: 'center'
  };
  const backdropStyle = { position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.6)' };
  const boxStyle = {
    position: 'relative', background: '#fff', borderRadius: 16,
    padding: '36px 32px', maxWidth: 420, width: '90%',
    boxShadow: '0 16px 50px rgba(0,0,0,0.25)', textAlign: 'center'
  };
  const btnPrimary = {
    background: '#d88b8b', color: '#fff', border: 'none',
    padding: '12px 40px', borderRadius: 10, fontSize: 15,
    fontWeight: 600, cursor: 'pointer', width: '100%', marginTop: 8
  };

  // Step: warning — ไม่สามารถใช้งานระบบจองได้
  if (step === 'warning') {
    return (
      <div style={overlayStyle}>
        <div style={backdropStyle} />
        <div style={boxStyle}>
          <div style={{ fontSize: 52, marginBottom: 16 }}>⚠️</div>
          <h3 style={{ color: '#e67e22', marginBottom: 12, fontSize: 18 }}>
            ไม่สามารถใช้งานระบบการจองได้
          </h3>
          <p style={{ color: '#555', fontSize: 14, lineHeight: 1.8, marginBottom: 24 }}>
            โปรดไปดำเนินการลงทะเบียน RFID กับ Admin
            <br />
            <span style={{ color: '#999', fontSize: 12 }}>
              เมื่อ Admin ลงทะเบียน RFID ให้เรียบร้อยแล้ว<br />
              คุณจะสามารถใช้งานระบบจองห้องได้
            </span>
          </p>
          <button onClick={onClose} style={btnPrimary}>รับทราบ</button>
        </div>
      </div>
    );
  }

  // Step: sent — ส่งคำขอสำเร็จแล้ว
  if (step === 'sent') {
    return (
      <div style={overlayStyle}>
        <div style={backdropStyle} />
        <div style={boxStyle}>
          <div style={{ fontSize: 52, marginBottom: 16 }}>✅</div>
          <h3 style={{ color: '#4caf50', marginBottom: 10 }}>ส่งคำขอสำเร็จ!</h3>
          <p style={{ color: '#555', fontSize: 14, marginBottom: 24 }}>
            Admin จะดำเนินการลงทะเบียน RFID ให้คุณเร็วๆ นี้
          </p>
          <button onClick={() => setStep('warning')} style={btnPrimary}>
            ตกลง
          </button>
        </div>
      </div>
    );
  }

  // Step: register — ยังไม่ได้ส่งคำขอเลย
  return (
    <div style={overlayStyle}>
      <div style={backdropStyle} />
      <div style={boxStyle}>
        <div style={{ fontSize: 52, marginBottom: 16 }}>🪪</div>
        <h3 style={{ color: '#333', marginBottom: 10 }}>ยังไม่ได้ลงทะเบียน RFID</h3>
        <p style={{ color: '#666', fontSize: 14, marginBottom: 8 }}>
          คุณยังไม่ได้ทำการลงทะเบียนบัตร RFID
        </p>
        <p style={{ color: '#888', fontSize: 13, marginBottom: 20 }}>
          กรุณาแตะบัตรที่เครื่องอ่าน RFID ก่อน<br />
          แล้วกดปุ่มด้านล่างเพื่อแจ้ง Admin
        </p>
        {err && (
          <p style={{ color: '#e74c3c', fontSize: 13, marginBottom: 10 }}>{err}</p>
        )}
        <button
          onClick={handleSend}
          disabled={sending}
          style={{ ...btnPrimary, opacity: sending ? 0.7 : 1 }}
        >
          {sending ? 'กำลังส่ง...' : '📨 ส่งคำขอ Register Request'}
        </button>
      </div>
    </div>
  );
};

// ==================== Admin Booking View (Embedded Tab UI) ====================
const AdminBookingView = ({
  rooms, selectedRoom, setSelectedRoom,
  selectedDate, setSelectedDate,
  selectedSlots, setSelectedSlots,
  rangeStartSlot, setRangeStartSlot,
  currentDay, setCurrentDay,
  currentRoom, setCurrentRoom,
  weekStart, setWeekStart,
  weekDays, timeSlots, today,
  isSlotSelected, isSlotPast, handleSlotClick,
  confirmRoomSelection, confirmDaySelection,
  floorKeys, floorGroups, selectedFloor, setSelectedFloor, roomsOnFloor,
  shiftWeek, formatWeekLabel,
  showRequestDialog, setShowRequestDialog,
  roomSelections, setRoomSelections,
  daySelections, setDaySelections,
  handleSubmitRequest, closeRequestDialog,
  detailError, setDetailError,
  bookingError, setBookingError,
  showSuccessPopup, setShowSuccessPopup,
  requests, stats, getStatusBadge,
}) => {
  const [activeTab, setActiveTab] = React.useState('room'); // 'room' | 'day'

  // ── Booked slots state ──
  // roomByBooked: { [dateStr]: [{start_time, end_time}] }  สำหรับ tab ห้อง
  // dayByBooked:  { [room]:    [{start_time, end_time}] }  สำหรับ tab วัน
  const [roomByBooked, setRoomByBooked] = React.useState({});
  const [dayByBooked,  setDayByBooked]  = React.useState({});

  // fetch booked slots ของห้องที่เลือก ทุกวันในสัปดาห์ (tab ห้อง)
  React.useEffect(() => {
    if (!selectedRoom || !weekDays || weekDays.length === 0) return;
    setRoomByBooked({}); // reset ก่อน เพื่อไม่ให้ข้อมูลห้องเก่าค้างอยู่
    let cancelled = false;
    const fetchAll = async () => {
      const results = {};
      await Promise.all(weekDays.map(async (dayObj) => {
        try {
          const res = await fetch(
            `/api/bookings/schedule?room=${encodeURIComponent(selectedRoom)}&date=${dayObj.dateStr}`
          );
          if (res.ok) {
            const data = await res.json();
            results[dayObj.dateStr] = data.booked_slots || [];
          }
        } catch { /* silent */ }
      }));
      if (!cancelled) setRoomByBooked(results);
    };
    fetchAll();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedRoom, weekStart]); // ใช้ weekStart แทน weekDays เพื่อป้องกัน infinite loop

  // fetch booked slots ของทุกห้องในชั้น สำหรับวันที่เลือก (tab วัน)
  React.useEffect(() => {
    if (!selectedDate || !roomsOnFloor || roomsOnFloor.length === 0) return;
    setDayByBooked({}); // reset ก่อน
    let cancelled = false;
    const fetchAll = async () => {
      const results = {};
      await Promise.all(roomsOnFloor.map(async (room) => {
        try {
          const res = await fetch(
            `/api/bookings/schedule?room=${encodeURIComponent(room)}&date=${selectedDate}`
          );
          if (res.ok) {
            const data = await res.json();
            results[room] = data.booked_slots || [];
          }
        } catch { /* silent */ }
      }));
      if (!cancelled) setDayByBooked(results);
    };
    fetchAll();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDate, selectedFloor]); // ใช้ selectedFloor แทน roomsOnFloor เพื่อป้องกัน infinite loop

  // ตรวจว่า slot นั้น overlap กับ booking ที่ approved แล้ว
  const isRoomSlotBooked = (dateStr, timeStr) => {
    const slots = roomByBooked[dateStr] || [];
    const t = timeToMinutes(timeStr);
    return slots.some(s => t >= timeToMinutes(s.start_time) && t < timeToMinutes(s.end_time));
  };

  const isDaySlotBooked = (room, timeStr) => {
    const slots = dayByBooked[room] || [];
    const t = timeToMinutes(timeStr);
    return slots.some(s => t >= timeToMinutes(s.start_time) && t < timeToMinutes(s.end_time));
  };

  // helper แปลง HH:MM เป็นนาที (ใช้ใน isBooked)
  const timeToMinutes = (t) => {
    const [hh, mm] = (t || '00:00').split(':').map(Number);
    return hh * 60 + (mm || 0);
  };

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    setSelectedSlots([]);
    setRangeStartSlot(null);
    setCurrentDay(null);
    setCurrentRoom(null);
  };

  const tabBtnStyle = (tab) => ({
    padding: '9px 28px',
    borderRadius: '10px',
    border: activeTab === tab ? '2px solid #fff' : '1px solid #ccc',
    background: activeTab === tab ? '#c0675f' : 'white',
    color: activeTab === tab ? 'white' : '#555',
    cursor: 'pointer',
    fontWeight: activeTab === tab ? '700' : '500',
    fontSize: '14px',
    boxShadow: activeTab === tab ? '0 0 0 3px #c0675f55, inset 0 1px 3px rgba(0,0,0,0.2)' : 'none',
    outline: activeTab === tab ? '2px solid #c0675f' : 'none',
    transform: activeTab === tab ? 'scale(1.04)' : 'scale(1)',
    transition: 'all 0.15s',
  });

  return (
    <div>
      {/* Title */}
      <div className="page-title-box" style={{ marginBottom: 16 }}>
        <span className="page-title">Room Booking</span>
      </div>

      {/* Tab Buttons */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
        <button style={tabBtnStyle('room')} onClick={() => handleTabChange('room')}>
          <i className="fa-solid fa-door-open" style={{ marginRight: 6 }}></i>เลือกจองตามห้อง
        </button>
        <button style={tabBtnStyle('day')} onClick={() => handleTabChange('day')}>
          <i className="fa-solid fa-calendar-day" style={{ marginRight: 6 }}></i>เลือกจองตามวัน
        </button>
      </div>

      {/* ── Tab: เลือกจองตามห้อง ── */}
      {activeTab === 'room' && (
        <div style={{ background: '#f3eaea', borderRadius: 15, padding: 20, boxShadow: '0 2px 6px rgba(0,0,0,.15)', marginBottom: 20 }}>
          {/* Room selector */}
          <div style={{ marginBottom: 12 }}>
            <label style={{ fontWeight: 600, fontSize: 14, display: 'flex', alignItems: 'center', gap: 10 }}>
              ห้อง:
              <select
                value={selectedRoom}
                onChange={(e) => {
                  setSelectedRoom(e.target.value);
                  setSelectedSlots([]);
                  setRangeStartSlot(null);
                  setCurrentDay(null);
                }}
                style={{ padding: '7px 12px', border: '1px solid #ddd', borderRadius: 6, fontSize: 14 }}
              >
                {rooms.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </label>
          </div>

          <p style={{ color: '#d88b8b', fontSize: 13, fontWeight: 600, background: '#fff5f5', padding: '8px 12px', borderRadius: 6, border: '1px solid #fdd', marginBottom: 12 }}>
            <i className="fas fa-info-circle"></i> คลิก 2 ครั้งเพื่อเลือกช่วงเวลาตั้งแต่เริ่มต้นถึงสิ้นสุด | เลือกได้เพียงวันเดียว
          </p>

          {/* Week nav */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <button type="button" onClick={() => shiftWeek(-1)}
              style={{ background: '#d88b8b', border: 'none', borderRadius: 8, padding: '7px 14px', cursor: 'pointer', color: 'white', fontSize: 15 }}>
              <i className="fa-solid fa-chevron-left"></i>
            </button>
            <span style={{ fontWeight: 600, fontSize: 14, color: '#333' }}>สัปดาห์: {formatWeekLabel(weekStart)}</span>
            <button type="button" onClick={() => shiftWeek(1)}
              style={{ background: '#d88b8b', border: 'none', borderRadius: 8, padding: '7px 14px', cursor: 'pointer', color: 'white', fontSize: 15 }}>
              <i className="fa-solid fa-chevron-right"></i>
            </button>
          </div>

          {/* Grid */}
          <div className="grid-wrapper">
            <table className="booking-grid">
              <thead>
                <tr>
                  <th>วัน / เวลา</th>
                  {timeSlots.map(time => <th key={time}>{time}</th>)}
                </tr>
              </thead>
              <tbody>
                {weekDays.map((dayObj) => {
                  const isPast = dayObj.date < today;
                  return (
                    <tr key={dayObj.dateStr}>
                      <td className="day-label">
                        <span className="day-name">{dayObj.name}</span>
                        <span className="day-date">{dayObj.date.getDate()}</span>
                      </td>
                      {timeSlots.map(time => {
                        const isSelected = isSlotSelected(dayObj.dateStr, time);
                        const isPastSlot = isPast || isSlotPast(dayObj.dateStr, time);
                        const isBooked   = !isPastSlot && isRoomSlotBooked(dayObj.dateStr, time);
                        const blocked    = isPastSlot || isBooked;
                        return (
                          <td key={time}
                            className={`slot${isSelected ? ' selected' : ''}${blocked ? ' disabled' : ''}`}
                            title={isBooked ? 'มีการจองแล้ว' : undefined}
                            style={isBooked ? { background: '#fde8e8', cursor: 'not-allowed' } : undefined}
                            onClick={() => !blocked && handleSlotClick({ date: dayObj.dateStr, time })}
                          />
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div style={{ marginTop: 14 }}>
            <button className="request-btn" onClick={confirmRoomSelection}
              style={{ width: '100%' }}>
              ยืนยันการจอง
            </button>
          </div>
        </div>
      )}

      {/* ── Tab: เลือกจองตามวัน ── */}
      {activeTab === 'day' && (
        <div style={{ background: '#f3eaea', borderRadius: 15, padding: 20, boxShadow: '0 2px 6px rgba(0,0,0,.15)', marginBottom: 20 }}>
          {/* Date picker */}
          <div style={{ marginBottom: 12 }}>
            <label style={{ fontWeight: 600, fontSize: 14, display: 'flex', alignItems: 'center', gap: 10 }}>
              วันที่:
              <input
                type="date"
                value={selectedDate}
                min={(() => { const n = new Date(); return `${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,'0')}-${String(n.getDate()).padStart(2,'0')}`; })()}
                onChange={(e) => {
                  setSelectedDate(e.target.value);
                  setSelectedSlots([]);
                  setRangeStartSlot(null);
                  setCurrentRoom(null);
                }}
                style={{ padding: '7px 12px', border: '1px solid #ddd', borderRadius: 6, fontSize: 14 }}
              />
            </label>
          </div>

          {/* Floor nav */}
          {floorKeys.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <button type="button"
                onClick={() => { const idx = floorKeys.indexOf(selectedFloor); if (idx > 0) { setSelectedFloor(floorKeys[idx-1]); setSelectedSlots([]); setRangeStartSlot(null); setCurrentRoom(null); } }}
                disabled={floorKeys.indexOf(selectedFloor) === 0}
                style={{ background: '#d88b8b', border: 'none', borderRadius: 8, padding: '7px 14px', cursor: floorKeys.indexOf(selectedFloor) === 0 ? 'not-allowed' : 'pointer', color: 'white', fontSize: 15, opacity: floorKeys.indexOf(selectedFloor) === 0 ? 0.4 : 1 }}>
                <i className="fa-solid fa-chevron-left"></i>
              </button>
              <div style={{ flex: 1, textAlign: 'center', fontWeight: 700, fontSize: 14, color: '#333', background: '#fff5f5', borderRadius: 8, padding: '8px 12px', border: '1px solid #fdd' }}>
                {selectedFloor === 'อื่นๆ' ? 'อื่นๆ' : (() => {
                  const list = floorGroups[selectedFloor] || [];
                  if (list.length === 0) return `ชั้นที่ ${selectedFloor}`;
                  if (list.length === 1) return `ชั้นที่ ${selectedFloor}  (${list[0]})`;
                  return `ชั้นที่ ${selectedFloor}  (${list[0]} - ${list[list.length-1]})`;
                })()}
              </div>
              <button type="button"
                onClick={() => { const idx = floorKeys.indexOf(selectedFloor); if (idx < floorKeys.length-1) { setSelectedFloor(floorKeys[idx+1]); setSelectedSlots([]); setRangeStartSlot(null); setCurrentRoom(null); } }}
                disabled={floorKeys.indexOf(selectedFloor) === floorKeys.length - 1}
                style={{ background: '#d88b8b', border: 'none', borderRadius: 8, padding: '7px 14px', cursor: floorKeys.indexOf(selectedFloor) === floorKeys.length-1 ? 'not-allowed' : 'pointer', color: 'white', fontSize: 15, opacity: floorKeys.indexOf(selectedFloor) === floorKeys.length-1 ? 0.4 : 1 }}>
                <i className="fa-solid fa-chevron-right"></i>
              </button>
            </div>
          )}

          <p style={{ color: '#d88b8b', fontSize: 13, fontWeight: 600, background: '#fff5f5', padding: '8px 12px', borderRadius: 6, border: '1px solid #fdd', marginBottom: 12 }}>
            <i className="fas fa-info-circle"></i> กรุณาเลือกเพียงห้องเดียว | คลิก 2 ครั้งเพื่อเลือกช่วงเวลา
          </p>

          {/* Grid */}
          <div className="grid-wrapper">
            <table className="booking-grid">
              <thead>
                <tr>
                  <th>ห้อง / เวลา</th>
                  {timeSlots.map(time => <th key={time}>{time}</th>)}
                </tr>
              </thead>
              <tbody>
                {roomsOnFloor.map(room => (
                  <tr key={room}>
                    <td>{room}</td>
                    {timeSlots.map(time => {
                      const isSelected = isSlotSelected(null, time, room);
                      const isPastSlot = isSlotPast(selectedDate, time);
                      const isBooked   = !isPastSlot && isDaySlotBooked(room, time);
                      const blocked    = isPastSlot || isBooked;
                      return (
                        <td key={time}
                          className={`slot${isSelected ? ' selected' : ''}${blocked ? ' disabled' : ''}`}
                          title={isBooked ? 'มีการจองแล้ว' : undefined}
                          style={isBooked ? { background: '#fde8e8', cursor: 'not-allowed' } : undefined}
                          onClick={() => !blocked && handleSlotClick({ room, time })}
                        />
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={{ marginTop: 14 }}>
            <button className="request-btn" onClick={confirmDaySelection}
              style={{ width: '100%' }}>
              ยืนยันการจอง
            </button>
          </div>
        </div>
      )}

      {/* Request Form Modal (หลังยืนยัน grid) */}
      {showRequestDialog && (roomSelections || daySelections) && (
        <div className="modal open">
          <div className="modal-overlay" onClick={closeRequestDialog}></div>
          <div className="modal-content">
            <h2 id="formTitle">รายละเอียดการจอง</h2>
            <form onSubmit={handleSubmitRequest}>
              <label>ห้อง
                <input name="room" value={roomSelections?.room || daySelections?.room || ''} readOnly required />
              </label>
              <label>วันที่จอง
                <input type="date" name="date" value={roomSelections?.date || daySelections?.date || ''} readOnly required />
              </label>
              <label>เวลาเริ่ม
                <input type="time" name="start_time" value={roomSelections?.start_time || daySelections?.start_time || ''} readOnly required />
              </label>
              <label>เวลาสิ้นสุด
                <input type="time" name="end_time" value={roomSelections?.end_time || daySelections?.end_time || ''} readOnly required />
              </label>
              <label style={{ display: 'block', marginBottom: 4, fontWeight: 600, fontSize: 14 }}>
                เหตุผล / วัตถุประสงค์ <span style={{ color: '#e74c3c' }}>*</span>
                <textarea name="detail" rows="3" placeholder="เหตุผลในการใช้ห้อง *" required
                  style={{ borderColor: detailError ? '#e74c3c' : undefined }}
                  onChange={() => setDetailError(false)}
                ></textarea>
              </label>
              {detailError && (
                <p style={{ color: '#e74c3c', fontSize: 13, marginTop: -10, marginBottom: 10 }}>* จำเป็นต้องระบุเหตุผล</p>
              )}
              <div className="modal-actions">
                <button type="submit" className="request-btn">ยืนยันการจอง</button>
                <button type="button" className="request-btn cancel" onClick={closeRequestDialog}>ยกเลิก</button>
              </div>
              {bookingError && (
                <p style={{ color: '#e74c3c', fontSize: 13, marginTop: 10, textAlign: 'center' }}>
                  <i className="fa-solid fa-circle-exclamation" style={{ marginRight: 4 }}></i>{bookingError}
                </p>
              )}
            </form>
          </div>
        </div>
      )}

      {/* Success Popup — Admin */}
      {showSuccessPopup && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.45)' }} onClick={() => setShowSuccessPopup(false)} />
          <div style={{ position: 'relative', background: '#fff', borderRadius: 20, padding: '40px 36px', maxWidth: 380, width: '90%', textAlign: 'center', boxShadow: '0 20px 60px rgba(0,0,0,0.25)' }}>
            <div style={{ width: 72, height: 72, borderRadius: '50%', background: '#e8f5e9', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 18px' }}>
              <i className="fa-solid fa-check" style={{ fontSize: 32, color: '#4caf50' }}></i>
            </div>
            <h3 style={{ color: '#333', fontSize: 20, fontWeight: 700, marginBottom: 10 }}>จองห้องสำเร็จ!</h3>
            <p style={{ color: '#666', fontSize: 14, marginBottom: 28, lineHeight: 1.6 }}>
              ห้องถูกจองและอนุมัติเรียบร้อยแล้ว
            </p>
            <button onClick={() => setShowSuccessPopup(false)}
              style={{ background: '#d88b8b', color: '#fff', border: 'none', borderRadius: 10, padding: '12px 48px', fontSize: 15, fontWeight: 600, cursor: 'pointer', width: '100%' }}>
              ตกลง
            </button>
          </div>
        </div>
      )}

      {/* My Requests Table */}
      <div className="section" style={{ marginTop: 4 }}>
        <div className="section-title">My Requests</div>
        <div className="table-container">
          <div className="table-responsive">
            <table>
              <thead>
                <tr>
                  <th>ห้อง</th>
                  <th>วันที่จอง</th>
                  <th>เวลาเริ่ม</th>
                  <th>เวลาสิ้นสุด</th>
                  <th>รายละเอียด</th>
                  <th>สถานะ</th>
                  <th>ผู้ตรวจสอบ</th>
                  <th>หมายเหตุ</th>
                </tr>
              </thead>
              <tbody>
                {requests.length === 0 ? (
                  <tr><td colSpan="8" style={{ textAlign: 'center', color: '#aaa' }}>ไม่มีข้อมูล</td></tr>
                ) : requests.map((req, idx) => {
                  const badge = getStatusBadge(req.status);
                  return (
                    <tr key={idx}>
                      <td>{req.room}</td>
                      <td>{req.date}</td>
                      <td>{req.start_time}</td>
                      <td>{req.end_time}</td>
                      <td>{req.detail}</td>
                      <td><span className={`status-badge ${badge.class}`}>{badge.text}</span></td>
                      <td>{req.approved_by_name || '-'}</td>
                      <td>{req.remark || '-'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

const RoomBooking = ({ user, onLogout, onNavigate, embeddedMode = false }) => {
  // Ensure mobile viewport
  React.useEffect(() => {
    let meta = document.querySelector("meta[name=viewport]");
    if (!meta) {
      meta = document.createElement("meta");
      meta.name = "viewport";
      document.head.appendChild(meta);
    }
    meta.content = "width=device-width, initial-scale=1, maximum-scale=1";
  }, []);
  const [requests, setRequests] = useState([]);
  const [stats, setStats] = useState({ approved: 0, rejected: 0, pending: 0, usedLimit: 0 });
  const [showRequestDialog, setShowRequestDialog] = useState(false);
  const [showRfidPopup, setShowRfidPopup] = useState(false); // false | 'register' | 'warning'
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const profileMenuRef = useRef(null);
  const [isRfidRegistered, setIsRfidRegistered] = useState(true);
  const [showRoomByModal, setShowRoomByModal] = useState(false);
  const [showDayByModal, setShowDayByModal] = useState(false);
  const [rooms, setRooms] = useState([]);
  const [selectedRoom, setSelectedRoom] = useState('');
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedSlots, setSelectedSlots] = useState([]);
  const [roomSelections, setRoomSelections] = useState(null);
  const [daySelections, setDaySelections] = useState(null);
  const [rangeStartSlot, setRangeStartSlot] = useState(null);
  const [currentDay, setCurrentDay] = useState(null);
  const [currentRoom, setCurrentRoom] = useState(null);
  const [detailError, setDetailError] = useState(false);
  const [bookingError, setBookingError] = useState('');

  // ── Booked slots สำหรับ student modal ──
  const [studentRoomBooked, setStudentRoomBooked] = useState({});
  const [studentDayBooked,  setStudentDayBooked]  = useState({});
  const [showSuccessPopup, setShowSuccessPopup] = useState(false);

  const getStartOfWeek = (date) => {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    const day = d.getDay(); // 0=Sunday, 1=Monday, ..., 6=Saturday
    const diffToMonday = (day + 6) % 7; // Monday -> 0, Sunday -> 6
    d.setDate(d.getDate() - diffToMonday);
    return d;
  };

  const addDays = (date, days) => {
    const d = new Date(date);
    d.setDate(d.getDate() + days);
    return d;
  };

  // ใช้ local date string แทน toISOString() (UTC) เพื่อป้องกันวันเลื่อน 1 วัน ใน UTC+7
  const formatIsoDate = (date) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };

  const [weekStart, setWeekStart] = useState(getStartOfWeek(new Date()));

  const days = ['จันทร์', 'อังคาร', 'พุธ', 'พฤหัส', 'ศุกร์', 'เสาร์', 'อาทิตย์'];
  const startHour = 8;
  const endHour = 20;

  // Generate time slots
  const generateTimeSlots = () => {
    const slots = [];
    for (let h = startHour; h <= endHour; h++) {
      slots.push((h < 10 ? '0' + h : h) + ':00');
    }
    return slots;
  };

  const timeSlots = generateTimeSlots();

  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  const weekDays = useMemo(() => {
    return days.map((name, idx) => {
      const date = addDays(weekStart, idx);
      return { name, date, dateStr: formatIsoDate(date) };
    });
  }, [days, weekStart]);

  // Close profile dropdown when clicking outside
  useEffect(() => {
    const handler = (e) => {
      if (profileMenuRef.current && !profileMenuRef.current.contains(e.target)) {
        setProfileMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    fetchRequests();
    fetchRooms();
    checkRfidStatus();
    const todayStr = new Date().toISOString().split('T')[0];
    setSelectedDate(todayStr);
    setWeekStart(getStartOfWeek(new Date()));
  }, []);

  const checkRfidStatus = async () => {
    // Admin ที่ embed มาจาก dashboard ไม่ block การจอง แม้ยังไม่ลง RFID
    if (embeddedMode) {
      setIsRfidRegistered(true);
      return;
    }
    try {
      const res = await fetch('/api/rfid-register-status', {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setIsRfidRegistered(data.is_rfid_registered);
          if (!data.is_rfid_registered) {
            if (data.has_pending_request) {
              setShowRfidPopup('warning');
            } else {
              setShowRfidPopup('register');
            }
          }
        }
      }
    } catch { /* silent */ }
  };

  const fetchRooms = async () => {
    try {
      const res = await fetch('/api/rooms');
      if (res.ok) {
        const data = await res.json();
        // เรียงห้องตามชั้น: EN41xx < EN42xx < EN43xx ... แล้วตามตัวอักษร
        const roomNames = (data.rooms || [])
          .map(r => r.name)
          .sort((a, b) => {
            const fa = a.match(/^EN\d(\d)/i);
            const fb = b.match(/^EN\d(\d)/i);
            const floorA = fa ? parseInt(fa[1], 10) : 99;
            const floorB = fb ? parseInt(fb[1], 10) : 99;
            if (floorA !== floorB) return floorA - floorB;
            return a.localeCompare(b);
          });
        setRooms(roomNames);
        if (roomNames.length > 0) setSelectedRoom(roomNames[0]);
      }
    } catch (e) {
      console.error('Error fetching rooms:', e);
    }
  };

  const fetchRequests = async () => {
    try {
      const response = await fetch('/api/bookings/my-requests', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setRequests(data.bookings || []);
        updateStats(data.bookings || []);
      }
    } catch (error) {
      console.error('Error fetching requests:', error);
    }
  };

  const updateStats = (data) => {
    const approved = data.filter(r => r.status === 'approved').length;
    const rejected = data.filter(r => r.status === 'rejected').length;
    const pending = data.filter(r => r.status === 'pending').length;

    setStats({
      approved,
      rejected,
      pending,
      usedLimit: approved + pending
    });
  };

  // Time conversion helpers
  const timeToMinutes = (t) => {
    const [hh, mm] = t.split(':').map(Number);
    return hh * 60 + mm;
  };

  const minutesToTime = (m) => {
    const hh = Math.floor(m / 60);
    const mm = m % 60;
    return (hh < 10 ? '0' + hh : '' + hh) + ':' + (mm < 10 ? '0' + mm : '' + mm);
  };

  // Handle slot selection with improved logic
  const handleSlotClick = (slot) => {
    if (slot.date) {
      // ========== ROOM BY MODAL ==========
      const slotDate = slot.date;
      const slotDateObj = new Date(slotDate);
      slotDateObj.setHours(0, 0, 0, 0);

      // Prevent selecting past dates
      if (slotDateObj < today) return;

      // Check if switching to a different date
      if (currentDay !== null && currentDay !== slotDate) {
        // Reset when switching dates
        setSelectedSlots([]);
        setRangeStartSlot(null);
        setCurrentDay(slotDate);
      } else if (currentDay === null) {
        setCurrentDay(slotDate);
      }

      if (rangeStartSlot === null) {
        // First click - start of range
        setRangeStartSlot({ date: slotDate, time: slot.time });
        setSelectedSlots([{ date: slotDate, time: slot.time }]);
      } else {
        // Second click - complete the range
        if (rangeStartSlot.date === slotDate) {
          const startTime = timeToMinutes(rangeStartSlot.time);
          const endTime = timeToMinutes(slot.time);
          const minTime = Math.min(startTime, endTime);
          const maxTime = Math.max(startTime, endTime);

          // Select all slots in range
          const newSlots = [];
          timeSlots.forEach(time => {
            const minutes = timeToMinutes(time);
            if (minutes >= minTime && minutes <= maxTime) {
              newSlots.push({ date: slotDate, time });
            }
          });

          setSelectedSlots(newSlots);
          setRangeStartSlot(null);
        } else {
          // Different date - reset and start new
          setSelectedSlots([{ date: slotDate, time: slot.time }]);
          setRangeStartSlot({ date: slotDate, time: slot.time });
          setCurrentDay(slotDate);
        }
      }
    } else {
      // ========== DAY BY MODAL ==========
      // Check if switching to a different room
      if (currentRoom !== null && currentRoom !== slot.room) {
        // Reset when switching rooms
        setSelectedSlots([]);
        setRangeStartSlot(null);
        setCurrentRoom(slot.room);
      } else if (currentRoom === null) {
        setCurrentRoom(slot.room);
      }

      if (rangeStartSlot === null) {
        // First click - start of range
        setRangeStartSlot(slot);
        setSelectedSlots([slot]);
      } else {
        // Second click - complete the range
        if (rangeStartSlot.room === slot.room) {
          const startTime = timeToMinutes(rangeStartSlot.time);
          const endTime = timeToMinutes(slot.time);
          const minTime = Math.min(startTime, endTime);
          const maxTime = Math.max(startTime, endTime);

          // Select all slots in range
          const newSlots = [];
          timeSlots.forEach(time => {
            const minutes = timeToMinutes(time);
            if (minutes >= minTime && minutes <= maxTime) {
              newSlots.push({ room: slot.room, time });
            }
          });

          setSelectedSlots(newSlots);
          setRangeStartSlot(null);
        } else {
          // Different room - reset and start new
          setSelectedSlots([slot]);
          setRangeStartSlot(slot);
          setCurrentRoom(slot.room);
        }
      }
    }
  };

  const isSlotSelected = (dateStr, time, room) => {
    if (dateStr !== null && dateStr !== undefined) {
      return selectedSlots.some(s =>
        s.date === dateStr && s.time === time
      );
    } else if (room !== null && room !== undefined) {
      return selectedSlots.some(s =>
        s.room === room && s.time === time
      );
    }
    return false;
  };

  // Compute merged ranges
  const computeRangesByDay = (selections) => {
    const groups = {};
    selections.forEach(s => {
      const d = s.date;
      groups[d] = groups[d] || [];
      groups[d].push(timeToMinutes(s.time));
    });

    const result = {};
    Object.keys(groups).forEach(d => {
      const arr = Array.from(new Set(groups[d])).sort((a, b) => a - b);
      if (arr.length === 0) {
        result[d] = [];
        return;
      }
      const minStart = arr[0];
      const maxEnd = arr[arr.length - 1] + 60;
      result[d] = [{ start: minutesToTime(minStart), end: minutesToTime(maxEnd) }];
    });
    return result;
  };

  const computeRangesForRoom = (cells, room) => {
    const times = Array.from(new Set(
      cells.filter(c => c.room === room).map(c => timeToMinutes(c.time))
    )).sort((a, b) => a - b);

    if (times.length === 0) return [];
    const minStart = times[0];
    const maxEnd = times[times.length - 1] + 60;
    return [{ start: minutesToTime(minStart), end: minutesToTime(maxEnd) }];
  };

  // ==================== Floor grouping for Day By Modal ====================
  // Group rooms by floor: EN4101–EN4199 = ชั้น 1, EN4201–EN4299 = ชั้น 2, etc.
  // Falls back to "อื่นๆ" for rooms that don't match ENxx## pattern
  const getFloorFromRoom = (roomName) => {
    const m = roomName.match(/^EN\d(\d)/i); // EN4[1]01 → floor digit
    if (m) return parseInt(m[1], 10);
    return null; // อื่นๆ
  };

  const floorGroups = useMemo(() => {
    const groups = {};
    rooms.forEach(r => {
      const fl = getFloorFromRoom(r);
      const key = fl !== null ? fl : 'อื่นๆ';
      if (!groups[key]) groups[key] = [];
      groups[key].push(r);
    });
    return groups;
  }, [rooms]);

  const floorKeys = useMemo(() => {
    return Object.keys(floorGroups).sort((a, b) => {
      if (a === 'อื่นๆ') return 1;
      if (b === 'อื่นๆ') return -1;
      return Number(a) - Number(b);
    });
  }, [floorGroups]);

  const [selectedFloor, setSelectedFloor] = useState(null); // null = not yet set

  // Auto-set floor when floorKeys populate
  useEffect(() => {
    if (floorKeys.length > 0 && selectedFloor === null) {
      setSelectedFloor(floorKeys[0]);
    }
  }, [floorKeys]);

  const roomsOnFloor = useMemo(() => {
    if (selectedFloor === null) return rooms;
    return floorGroups[selectedFloor] || [];
  }, [selectedFloor, floorGroups, rooms]);

  // ── fetch booked slots สำหรับ student Room By Modal ──
  useEffect(() => {
    if (!selectedRoom || weekDays.length === 0) return;
    setStudentRoomBooked({});
    let cancelled = false;
    const fetchAll = async () => {
      const results = {};
      await Promise.all(weekDays.map(async (dayObj) => {
        try {
          const res = await fetch(
            `/api/bookings/schedule?room=${encodeURIComponent(selectedRoom)}&date=${dayObj.dateStr}`
          );
          if (res.ok) {
            const d = await res.json();
            results[dayObj.dateStr] = d.booked_slots || [];
          }
        } catch { /* silent */ }
      }));
      if (!cancelled) setStudentRoomBooked(results);
    };
    fetchAll();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedRoom, weekStart]); // weekStart แทน weekDays ป้องกัน infinite loop

  // ── fetch booked slots สำหรับ student Day By Modal ──
  useEffect(() => {
    if (!selectedDate || roomsOnFloor.length === 0) return;
    setStudentDayBooked({});
    let cancelled = false;
    const fetchAll = async () => {
      const results = {};
      await Promise.all(roomsOnFloor.map(async (room) => {
        try {
          const res = await fetch(
            `/api/bookings/schedule?room=${encodeURIComponent(room)}&date=${selectedDate}`
          );
          if (res.ok) {
            const d = await res.json();
            results[room] = d.booked_slots || [];
          }
        } catch { /* silent */ }
      }));
      if (!cancelled) setStudentDayBooked(results);
    };
    fetchAll();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDate, selectedFloor]); // selectedFloor แทน roomsOnFloor ป้องกัน infinite loop

  // ==================== Past-slot check for Day By Modal ====================
  // ใช้ local ISO string "YYYY-MM-DDThh:mm:00" เพื่อ parse ถูก timezone (ไม่ใช่ UTC)
  const isSlotPast = (dateStr, timeStr) => {
    const slotDate = new Date(`${dateStr}T${timeStr}:00`);
    return slotDate <= new Date();
  };

  const shiftWeek = (deltaWeeks) => {
    setWeekStart(prev => addDays(prev, deltaWeeks * 7));
    setSelectedSlots([]);
    setRangeStartSlot(null);
    setCurrentDay(null);
  };

  const formatWeekLabel = (start) => {
    const end = addDays(start, 6);
    const startStr = start.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' });
    const endStr = end.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' });
    return `${startStr} - ${endStr}`;
  };

  // Handle room-by-room booking confirmation
  const confirmRoomSelection = () => {
    if (selectedSlots.length === 0) {
      alert('กรุณาเลือกช่วงเวลาที่ต้องการจอง');
      return;
    }

    // Check if only one date is selected
    const uniqueDates = [...new Set(selectedSlots.map(s => s.date))];
    if (uniqueDates.length > 1) {
      alert('กรุณาเลือกเพียงวันเดียว');
      return;
    }

    const dateStr = uniqueDates[0];

    // Validate no past slots selected
    const hasPast = selectedSlots.some(s => isSlotPast(s.date, s.time));
    if (hasPast) {
      alert('ไม่สามารถจองเวลาที่ผ่านมาแล้วได้ กรุณาเลือกเวลาใหม่');
      setSelectedSlots([]);
      setRangeStartSlot(null);
      return;
    }

    const rangesByDay = computeRangesByDay(selectedSlots);
    const ranges = rangesByDay[dateStr] || [];

    setRoomSelections({
      room: selectedRoom,
      date: dateStr,
      start_time: ranges[0]?.start || '',
      end_time: ranges[0]?.end || ''
    });
    setShowRoomByModal(false);
    setShowRequestDialog(true);
  };

  // Handle day-by-day booking confirmation
  const confirmDaySelection = () => {
    if (selectedSlots.length === 0) {
      alert('กรุณาเลือกห้องและช่วงเวลา');
      return;
    }

    // Validate selected date is not in the past
    const today0 = new Date();
    today0.setHours(0, 0, 0, 0);
    const chosenDate = new Date(selectedDate);
    chosenDate.setHours(0, 0, 0, 0);
    if (chosenDate < today0) {
      alert('ไม่สามารถจองวันที่ผ่านมาแล้วได้');
      return;
    }

    // Validate no past time slots
    const hasPast = selectedSlots.some(s => isSlotPast(selectedDate, s.time));
    if (hasPast) {
      alert('ไม่สามารถจองเวลาที่ผ่านมาแล้วได้ กรุณาเลือกเวลาใหม่');
      setSelectedSlots([]);
      setRangeStartSlot(null);
      return;
    }

    const roomsInSelection = [...new Set(selectedSlots.map(s => s.room))];
    if (roomsInSelection.length > 1) {
      alert('กรุณาเลือกเพียงห้องเดียว');
      return;
    }

    const room = roomsInSelection[0];
    const ranges = computeRangesForRoom(selectedSlots, room);
    setDaySelections({
      date: selectedDate,
      room,
      start_time: ranges[0].start,
      end_time: ranges[0].end
    });
    setShowDayByModal(false);
    setShowRequestDialog(true);
  };

  // Submit booking request
  const handleSubmitRequest = async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const detail = (formData.get('detail') || '').trim();

    if (!detail) {
      setDetailError(true);
      return;
    }
    setDetailError(false);
    setBookingError('');

    const bookingData = {
      room: formData.get('room'),
      date: formData.get('date'),
      start_time: formData.get('start_time'),
      end_time: formData.get('end_time'),
      detail: detail
    };

    try {
      if (embeddedMode) {
        // ══ Admin: สร้าง + approve ทันที ══
        const res = await fetch('/api/bookings/admin-create', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          },
          body: JSON.stringify({ booking: bookingData })
        });
        const data = await res.json();
        if (res.ok && data.success) {
          setShowSuccessPopup(true);
          fetchRequests();
          closeRequestDialog();
        } else {
          setBookingError(data.message || 'เกิดข้อผิดพลาด');
        }
      } else {
        // ══ Student: ส่งคำขอรอ approve ══
        const res = await fetch('/api/bookings/create', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          },
          body: JSON.stringify({ bookings: [bookingData] })
        });
        const data = await res.json();
        if (res.ok && data.success) {
          setShowSuccessPopup(true);
          fetchRequests();
          closeRequestDialog();
        } else {
          setBookingError(data.message || 'เกิดข้อผิดพลาด');
        }
      }
    } catch (error) {
      console.error('Error creating booking:', error);
      setBookingError('เกิดข้อผิดพลาดในการเชื่อมต่อ');
    }
  };

  const closeRequestDialog = () => {
    setShowRequestDialog(false);
    setRoomSelections(null);
    setDaySelections(null);
    setSelectedSlots([]);
    setRangeStartSlot(null);
    setCurrentDay(null);
    setCurrentRoom(null);
    setDetailError(false);
    setBookingError('');
  };

  const closeLogoutConfirm = () => {
    setShowLogoutConfirm(false);
  };

  const closeRoomByModal = () => {
    setShowRoomByModal(false);
    setSelectedSlots([]);
    setRangeStartSlot(null);
    setCurrentDay(null);
  };

  const closeDayByModal = () => {
    setShowDayByModal(false);
    setSelectedSlots([]);
    setRangeStartSlot(null);
    setCurrentRoom(null);
  };

  const getStatusBadge = (status) => {
    const badges = {
      'approved': { text: 'อนุมัติแล้ว', class: 'status-approved' },
      'rejected': { text: 'ปฏิเสธ', class: 'status-rejected' },
      'pending': { text: 'รอการอนุมัติ', class: 'status-pending' }
    };
    return badges[status] || badges.pending;
  };

  return (
    <div className="room-booking-layout" style={embeddedMode ? { background: 'transparent', padding: 0 } : {}}>
      {/* RFID Register Popup */}
      {showRfidPopup && (
        <RfidStatusPopup
          mode={showRfidPopup}
          onClose={() => setShowRfidPopup(false)}
        />
      )}
      {/* Header — ซ่อนเมื่อ embed ใน AdminDashboard */}
      {!embeddedMode && (
        <header className="booking-header">
          <div className="header-content">
            <div className="logo-section">
              <img src="/logo/enkku_logo.png" alt="Logo" className="header-logo" />
              <h1>Room Access Control</h1>
            </div>

            <div className="user-section" style={{ display: 'flex', alignItems: 'center', gap: '8px' }} ref={profileMenuRef}>
              <NotificationBell userEmail={user?.email} />
              <div style={{ position: 'relative', display: 'inline-block' }}>
                <button
                  className="user-info profile-button"
                  onClick={() => setProfileMenuOpen(v => !v)}
                >
                  <i className="fa-solid fa-user"></i>
                  <span className='profileIcon'>{user?.first_name} {user?.last_name}</span>
                  <i className="fa-solid fa-caret-down" style={{ marginLeft: 6, fontSize: '0.8em' }}></i>
                </button>
                {profileMenuOpen && (
                  <div style={{
                    position: 'absolute',
                    right: 0,
                    top: 'calc(100% + 6px)',
                    minWidth: 160,
                    background: '#fff',
                    borderRadius: 10,
                    boxShadow: '0 10px 30px rgba(0,0,0,0.15)',
                    zIndex: 999,
                    overflow: 'hidden'
                  }}>
                    <button
                      className="dropdown-item"
                      onClick={() => {
                        setProfileMenuOpen(false);
                        onNavigate && onNavigate('profile');
                      }}
                    >
                      <i className="fa-solid fa-user" style={{ marginRight: 8 }}></i>Profile
                    </button>
                    <button
                      className="dropdown-item logout-button"
                      onClick={() => {
                        setProfileMenuOpen(false);
                        setShowLogoutConfirm(true);
                      }}
                    >
                      <i className="fa-solid fa-right-from-bracket" style={{ marginRight: 8 }}></i>Logout
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          <button className="request-btn-main" onClick={() => {
            if (!isRfidRegistered) {
              setShowRfidPopup('warning');
              return;
            }
            setSelectedSlots([]);
            setRoomSelections(null);
            setDaySelections(null);
            setRangeStartSlot(null);
            setCurrentDay(null);
            setCurrentRoom(null);
            setShowRequestDialog(true);
          }}>
            <i className="fas fa-plus"></i> ส่งคำขอใหม่
          </button>
        </header>
      )}

      {/* ══════════════════════════════════════════════════════
          EMBEDDED MODE (Admin Dashboard) — Tab UI แทน Modal
          ══════════════════════════════════════════════════════ */}
      {embeddedMode ? (
        <AdminBookingView
          rooms={rooms}
          selectedRoom={selectedRoom}
          setSelectedRoom={setSelectedRoom}
          selectedDate={selectedDate}
          setSelectedDate={setSelectedDate}
          selectedSlots={selectedSlots}
          setSelectedSlots={setSelectedSlots}
          rangeStartSlot={rangeStartSlot}
          setRangeStartSlot={setRangeStartSlot}
          currentDay={currentDay}
          setCurrentDay={setCurrentDay}
          currentRoom={currentRoom}
          setCurrentRoom={setCurrentRoom}
          weekStart={weekStart}
          setWeekStart={setWeekStart}
          weekDays={weekDays}
          timeSlots={timeSlots}
          today={today}
          isSlotSelected={isSlotSelected}
          isSlotPast={isSlotPast}
          handleSlotClick={handleSlotClick}
          confirmRoomSelection={confirmRoomSelection}
          confirmDaySelection={confirmDaySelection}
          floorKeys={floorKeys}
          floorGroups={floorGroups}
          selectedFloor={selectedFloor}
          setSelectedFloor={setSelectedFloor}
          roomsOnFloor={roomsOnFloor}
          shiftWeek={shiftWeek}
          formatWeekLabel={formatWeekLabel}
          showRequestDialog={showRequestDialog}
          setShowRequestDialog={setShowRequestDialog}
          roomSelections={roomSelections}
          setRoomSelections={setRoomSelections}
          daySelections={daySelections}
          setDaySelections={setDaySelections}
          handleSubmitRequest={handleSubmitRequest}
          closeRequestDialog={closeRequestDialog}
          detailError={detailError}
          setDetailError={setDetailError}
          bookingError={bookingError}
          setBookingError={setBookingError}
          showSuccessPopup={showSuccessPopup}
          setShowSuccessPopup={setShowSuccessPopup}
          requests={requests}
          stats={stats}
          getStatusBadge={getStatusBadge}
        />
      ) : (
      <>{/* ══ Non-embedded (student) layout ══ */}
      <div className="stats-grid">
        <div className="stat-card approved">
          <div className="stat-icon"><i className="fas fa-check-square"></i></div>
          <div className="stat-label">Approved</div>
          <div className="stat-number">{stats.approved}</div>
        </div>

        <div className="stat-card rejected">
          <div className="stat-icon"><i className="fas fa-times-square"></i></div>
          <div className="stat-label">Rejected</div>
          <div className="stat-number">{stats.rejected}</div>
        </div>

        <div className="stat-card pending">
          <div className="stat-icon"><i className="fas fa-clock"></i></div>
          <div className="stat-label">Pending</div>
          <div className="stat-number">{stats.pending}</div>
        </div>

        <div className="stat-card limit">
          <div className="stat-icon"><i className="fas fa-list"></i></div>
          <div className="stat-label">Booking Limits</div>
          <div className="stat-number">{stats.usedLimit} / 3</div>
        </div>
      </div>

      {/* Requests Table */}
      <div className="section">
        <div className="section-title">My Requests</div>
        <div className="table-container">
          <div className="table-responsive"><table>
            <thead>
              <tr>
                <th style={{ width: '120px' }}>ประเภทห้อง</th>
                <th style={{ width: '110px' }}>วันที่จอง</th>
                <th style={{ width: '90px' }}>เวลาเริ่ม</th>
                <th style={{ width: '100px' }}>เวลาสิ้นสุด</th>
                <th style={{ width: '250px' }}>รายละเอียดการจอง</th>
                <th style={{ width: '100px' }}>สถานะ</th>
                <th style={{ width: '150px' }}>ผู้ตรวจสอบ</th>
                <th style={{ width: '150px' }}>หมายเหตุ</th>
              </tr>
            </thead>
            <tbody>
              {requests.length === 0 ? (
                <tr>
                  <td colSpan="8" style={{ textAlign: 'center' }}>ไม่มีข้อมูล</td>
                </tr>
              ) : (
                requests.map((req, idx) => {
                  const badge = getStatusBadge(req.status);
                  return (
                    <tr key={idx}>
                      <td>{req.room}</td>
                      <td>{req.date}</td>
                      <td>{req.start_time}</td>
                      <td>{req.end_time}</td>
                      <td>{req.detail}</td>
                      <td>
                        <span className={`status-badge ${badge.class}`}>
                          {badge.text}
                        </span>
                      </td>
                      <td>{req.approved_by_name || '-'}</td>
                      <td>{req.remark || '-'}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table></div>
        </div>
      </div>

      {/* Request Dialog */}
      {showRequestDialog && (
        <div className="modal open">
          <div className="modal-overlay" onClick={closeRequestDialog}></div>
          <div className="modal-content">
            {!roomSelections && !daySelections && (
              <>
                <h2 className="dialog-head">รายละเอียดการจอง</h2>
                <div className="dialog-buttons">
                  <button className="dialog-btn" onClick={() => {
                    setSelectedSlots([]);
                    setCurrentDay(null);
                    setShowRequestDialog(false);
                    setShowRoomByModal(true);
                  }}>
                    เลือกจองตามห้อง
                  </button>
                  <button className="dialog-btn" onClick={() => {
                    setSelectedSlots([]);
                    setCurrentRoom(null);
                    setSelectedFloor(floorKeys[0] ?? null);
                    setShowRequestDialog(false);
                    setShowDayByModal(true);
                  }}>
                    เลือกจองตามวัน
                  </button>
                </div>
              </>
            )}

            {(roomSelections || daySelections) && (
              <>
                <h2 id="formTitle">รายละเอียดการจอง</h2>
                <form onSubmit={handleSubmitRequest}>
                  <label>ห้อง
                    <input
                      name="room"
                      value={roomSelections?.room || daySelections?.room || ''}
                      readOnly
                      required
                    />
                  </label>

                  <label>วันที่จอง
                    <input
                      type="date"
                      name="date"
                      value={roomSelections?.date || daySelections?.date || ''}
                      readOnly
                      required
                    />
                  </label>

                  <label>เวลาเริ่ม
                    <input
                      type="time"
                      name="start_time"
                      value={roomSelections?.start_time || daySelections?.start_time || ''}
                      readOnly
                      required
                    />
                  </label>

                  <label>เวลาสิ้นสุด
                    <input
                      type="time"
                      name="end_time"
                      value={roomSelections?.end_time || daySelections?.end_time || ''}
                      readOnly
                      required
                    />
                  </label>

                  <label style={{ display: 'block', marginBottom: 4, fontWeight: 600, fontSize: 14 }}>
                    เหตุผล / วัตถุประสงค์ <span style={{ color: '#e74c3c' }}>*</span>
                    <textarea
                      name="detail"
                      rows="3"
                      placeholder="เหตุผลในการใช้ห้อง *"
                      required
                      style={{ borderColor: detailError ? '#e74c3c' : undefined }}
                      onChange={() => setDetailError(false)}
                    ></textarea>
                  </label>
                  {detailError && (
                    <p style={{ color: '#e74c3c', fontSize: 13, marginTop: -10, marginBottom: 10 }}>
                      * จำเป็นต้องระบุเหตุผล
                    </p>
                  )}

                  <div className="modal-actions">
                    <button type="submit" className="request-btn">ส่งคำขอ</button>
                    <button type="button" className="request-btn cancel" onClick={closeRequestDialog}>
                      ยกเลิก
                    </button>
                  </div>
                  {bookingError && (
                    <p style={{ color: '#e74c3c', fontSize: 13, marginTop: 10, textAlign: 'center' }}>
                      <i className="fa-solid fa-circle-exclamation" style={{ marginRight: 4 }}></i>{bookingError}
                    </p>
                  )}
                </form>
              </>
            )}
          </div>
        </div>
      )}

      {/* Logout Confirm Dialog */}
      {showLogoutConfirm && (
        <div className="modal open">
          <div className="modal-overlay" onClick={closeLogoutConfirm}></div>
          <div className="modal-content">
            <h2 className="dialog-head">ยืนยันการออกจากระบบ</h2>
            <p style={{ color: '#555', fontSize: 14, marginTop: 10, marginBottom: 20, textAlign: 'center' }}>
              คุณต้องการออกจากระบบใช่หรือไม่?
            </p>
            <div className="modal-actions">
              <button
                className="request-btn cancel"
                onClick={closeLogoutConfirm}
                type="button"
              >
                ยกเลิก
              </button>
              <button
                className="request-btn logout-button"
                onClick={() => {
                  setShowLogoutConfirm(false);
                  onLogout();
                }}
                type="button"
              >
                ออกจากระบบ
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Room By Modal */}
      {showRoomByModal && (
        <div className="modal open">
          <div className="modal-overlay" onClick={closeRoomByModal}></div>
          <div className="modal-content large">
            <h2>เลือกจองตามห้องที่ต้องการ</h2>

            <div className="room-selector">
              <label>Room:
                <select
                  value={selectedRoom}
                  onChange={(e) => setSelectedRoom(e.target.value)}
                >
                  {rooms.map(r => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              </label>
            </div>

            <p style={{
              marginTop: '10px',
              marginBottom: '15px',
              color: '#d88b8b',
              fontSize: '14px',
              fontWeight: '600',
              background: '#fff5f5',
              padding: '10px',
              borderRadius: '6px',
              border: '1px solid #fdd'
            }}>
              <i className="fas fa-info-circle"></i> หมายเหตุ: กรุณาเลือกเพียงวันเดียว | คลิกช่วงเวลา 2 ครั้งเพื่อเลือกช่องเวลาตั้งแต่เริ่มต้นถึงสิ้นสุด
            </p>

            {/* Week label กลาง + ลูกศรซ้าย-ขวาคร่อมตาราง */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <button
                type="button"
                onClick={() => shiftWeek(-1)}
                style={{ background: '#d88b8b', border: 'none', borderRadius: 8, padding: '8px 14px', cursor: 'pointer', color: 'white', fontSize: 16 }}
              >
                <i className="fa-solid fa-chevron-left"></i>
              </button>
              <div style={{ fontWeight: 600, fontSize: 15, color: '#333', textAlign: 'center' }}>
                สัปดาห์: {formatWeekLabel(weekStart)}
              </div>
              <button
                type="button"
                onClick={() => shiftWeek(1)}
                style={{ background: '#d88b8b', border: 'none', borderRadius: 8, padding: '8px 14px', cursor: 'pointer', color: 'white', fontSize: 16 }}
              >
                <i className="fa-solid fa-chevron-right"></i>
              </button>
            </div>

            <div className="grid-wrapper">
              <table className="booking-grid">
                <thead>
                  <tr>
                    <th>วัน / เวลา</th>
                    {timeSlots.map(time => (
                      <th key={time}>{time}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {weekDays.map((dayObj, dayIdx) => {
                    const isPast = dayObj.date < today;
                    return (
                      <tr key={dayObj.dateStr}>
                        <td className="day-label">
                          <span className="day-name">{dayObj.name}</span>
                          <span className="day-date">{dayObj.date.getDate()}</span>
                        </td>
                        {timeSlots.map(time => {
                          const isSelected = isSlotSelected(dayObj.dateStr, time);
                          const isPastSlot = isPast || isSlotPast(dayObj.dateStr, time);
                          const t = timeToMinutes(time);
                          const isBooked = !isPastSlot && (studentRoomBooked[dayObj.dateStr] || []).some(
                            s => t >= timeToMinutes(s.start_time) && t < timeToMinutes(s.end_time)
                          );
                          const blocked = isPastSlot || isBooked;
                          const cellClasses = `slot ${isSelected ? 'selected' : ''} ${blocked ? 'disabled' : ''}`;
                          return (
                            <td
                              key={time}
                              className={cellClasses}
                              title={isBooked ? 'มีการจองแล้ว' : undefined}
                              style={isBooked ? { background: '#fde8e8', cursor: 'not-allowed' } : undefined}
                              onClick={() => !blocked && handleSlotClick({ date: dayObj.dateStr, time, dayOffset: dayIdx })}
                            >
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="modal-actions">
              <button className="request-btn" onClick={confirmRoomSelection}>ยืนยัน</button>
              <button className="request-btn cancel" onClick={closeRoomByModal}>ปิด</button>
            </div>
          </div>
        </div>
      )}

      {/* ══ Success Popup ══ */}
      {showSuccessPopup && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 9999,
          display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.45)' }}
               onClick={() => setShowSuccessPopup(false)} />
          <div style={{
            position: 'relative', background: '#fff', borderRadius: 20,
            padding: '40px 36px', maxWidth: 380, width: '90%', textAlign: 'center',
            boxShadow: '0 20px 60px rgba(0,0,0,0.25)'
          }}>
            {/* ไอคอนวงกลมสีเขียว */}
            <div style={{
              width: 72, height: 72, borderRadius: '50%',
              background: '#e8f5e9', display: 'flex', alignItems: 'center',
              justifyContent: 'center', margin: '0 auto 18px'
            }}>
              <i className="fa-solid fa-check" style={{ fontSize: 32, color: '#4caf50' }}></i>
            </div>
            <h3 style={{ color: '#333', fontSize: 20, fontWeight: 700, marginBottom: 10 }}>
              ส่งคำขอจองสำเร็จ!
            </h3>
            <p style={{ color: '#666', fontSize: 14, marginBottom: 28, lineHeight: 1.6 }}>
              คำขอของคุณถูกส่งเรียบร้อยแล้ว<br />
              รอการอนุมัติจาก Admin
            </p>
            <button
              onClick={() => setShowSuccessPopup(false)}
              style={{
                background: '#d88b8b', color: '#fff', border: 'none',
                borderRadius: 10, padding: '12px 48px', fontSize: 15,
                fontWeight: 600, cursor: 'pointer', width: '100%'
              }}
            >
              ตกลง
            </button>
          </div>
        </div>
      )}

      {/* Day By Modal */}
      {showDayByModal && (
        <div className="modal open">
          <div className="modal-overlay" onClick={closeDayByModal}></div>
          <div className="modal-content large">
            <h2>เลือกจองตามวัน/เวลาที่ต้องการ</h2>

            {/* Date picker */}
            <div className="day-controls">
              <label>วันที่:
                <input
                  type="date"
                  value={selectedDate}
                  min={(() => { const n = new Date(); return `${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,'0')}-${String(n.getDate()).padStart(2,'0')}`; })()}
                  onChange={(e) => {
                    setSelectedDate(e.target.value);
                    setSelectedSlots([]);
                    setRangeStartSlot(null);
                    setCurrentRoom(null);
                  }}
                />
              </label>
            </div>

            {/* Floor navigation */}
            {floorKeys.length > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '12px 0' }}>
                <button
                  type="button"
                  onClick={() => {
                    const idx = floorKeys.indexOf(selectedFloor);
                    if (idx > 0) {
                      setSelectedFloor(floorKeys[idx - 1]);
                      setSelectedSlots([]);
                      setRangeStartSlot(null);
                      setCurrentRoom(null);
                    }
                  }}
                  disabled={floorKeys.indexOf(selectedFloor) === 0}
                  style={{
                    background: '#d88b8b', border: 'none', borderRadius: 8,
                    padding: '8px 16px', cursor: floorKeys.indexOf(selectedFloor) === 0 ? 'not-allowed' : 'pointer',
                    color: 'white', fontSize: 16,
                    opacity: floorKeys.indexOf(selectedFloor) === 0 ? 0.4 : 1
                  }}
                >
                  <i className="fa-solid fa-chevron-left"></i>
                </button>

                <div style={{
                  flex: 1, textAlign: 'center', fontWeight: 700, fontSize: 15,
                  color: '#333', background: '#fff5f5', borderRadius: 8,
                  padding: '9px 12px', border: '1px solid #fdd'
                }}>
                  {selectedFloor === 'อื่นๆ'
                    ? 'อื่นๆ'
                    : (() => {
                        const list = floorGroups[selectedFloor] || [];
                        if (list.length === 0) return `ชั้นที่ ${selectedFloor}`;
                        if (list.length === 1) return `ชั้นที่ ${selectedFloor}  (${list[0]})`;
                        return `ชั้นที่ ${selectedFloor}  (${list[0]} - ${list[list.length - 1]})`;
                      })()
                  }
                </div>

                <button
                  type="button"
                  onClick={() => {
                    const idx = floorKeys.indexOf(selectedFloor);
                    if (idx < floorKeys.length - 1) {
                      setSelectedFloor(floorKeys[idx + 1]);
                      setSelectedSlots([]);
                      setRangeStartSlot(null);
                      setCurrentRoom(null);
                    }
                  }}
                  disabled={floorKeys.indexOf(selectedFloor) === floorKeys.length - 1}
                  style={{
                    background: '#d88b8b', border: 'none', borderRadius: 8,
                    padding: '8px 16px', cursor: floorKeys.indexOf(selectedFloor) === floorKeys.length - 1 ? 'not-allowed' : 'pointer',
                    color: 'white', fontSize: 16,
                    opacity: floorKeys.indexOf(selectedFloor) === floorKeys.length - 1 ? 0.4 : 1
                  }}
                >
                  <i className="fa-solid fa-chevron-right"></i>
                </button>
              </div>
            )}

            <p style={{
              marginTop: '6px', marginBottom: '15px', color: '#d88b8b',
              fontSize: '14px', fontWeight: '600', background: '#fff5f5',
              padding: '10px', borderRadius: '6px', border: '1px solid #fdd'
            }}>
              <i className="fas fa-info-circle"></i> หมายเหตุ: กรุณาเลือกเพียงห้องเดียว | คลิก 2 ครั้งเพื่อเลือกช่วงเวลาตั้งแต่เริ่มต้นถึงสิ้นสุด
            </p>

            <div className="grid-wrapper">
              <table className="booking-grid">
                <thead>
                  <tr>
                    <th>ห้อง / เวลา</th>
                    {timeSlots.map(time => (
                      <th key={time}>{time}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {roomsOnFloor.map(room => (
                    <tr key={room}>
                      <td>{room}</td>
                    {timeSlots.map(time => {
                        const isSelected = isSlotSelected(null, time, room);
                        const isPastSlot = isSlotPast(selectedDate, time);
                        const t = timeToMinutes(time);
                        const isBooked = !isPastSlot && (studentDayBooked[room] || []).some(
                          s => t >= timeToMinutes(s.start_time) && t < timeToMinutes(s.end_time)
                        );
                        const blocked = isPastSlot || isBooked;
                        return (
                          <td
                            key={time}
                            className={`slot${isSelected ? ' selected' : ''}${blocked ? ' disabled' : ''}`}
                            title={isBooked ? 'มีการจองแล้ว' : undefined}
                            style={isBooked ? { background: '#fde8e8', cursor: 'not-allowed' } : undefined}
                            onClick={() => !blocked && handleSlotClick({ room, time })}
                          />
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="modal-actions">
              <button className="request-btn" onClick={confirmDaySelection}>ยืนยัน</button>
              <button className="request-btn cancel" onClick={closeDayByModal}>ปิด</button>
            </div>
          </div>
        </div>
      )}
    </> /* end non-embedded */
    )} {/* end embeddedMode ternary */}
    </div>
  );
};

export default RoomBooking;