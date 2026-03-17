import React, { useState, useEffect, useRef } from 'react';
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
    const today = new Date().toISOString().split('T')[0];
    setSelectedDate(today);
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
        const roomNames = (data.rooms || []).map(r => r.name);
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
    if (slot.day !== undefined) {
      // ========== ROOM BY MODAL ==========
      // Check if switching to a different day
      if (currentDay !== null && currentDay !== slot.day) {
        // Reset when switching days
        setSelectedSlots([]);
        setRangeStartSlot(null);
        setCurrentDay(slot.day);
      } else if (currentDay === null) {
        setCurrentDay(slot.day);
      }

      if (rangeStartSlot === null) {
        // First click - start of range
        setRangeStartSlot(slot);
        setSelectedSlots([slot]);
      } else {
        // Second click - complete the range
        if (rangeStartSlot.day === slot.day) {
          const startTime = timeToMinutes(rangeStartSlot.time);
          const endTime = timeToMinutes(slot.time);
          const minTime = Math.min(startTime, endTime);
          const maxTime = Math.max(startTime, endTime);

          // Select all slots in range
          const newSlots = [];
          timeSlots.forEach(time => {
            const minutes = timeToMinutes(time);
            if (minutes >= minTime && minutes <= maxTime) {
              newSlots.push({ day: slot.day, time, dayOffset: slot.dayOffset });
            }
          });

          setSelectedSlots(newSlots);
          setRangeStartSlot(null);
        } else {
          // Different day - reset and start new
          setSelectedSlots([slot]);
          setRangeStartSlot(slot);
          setCurrentDay(slot.day);
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

  const isSlotSelected = (day, time, room) => {
    if (day !== null && day !== undefined) {
      return selectedSlots.some(s =>
        s.day === day && s.time === time
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
      const d = s.dayOffset;
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

  // Handle room-by-room booking confirmation
  const confirmRoomSelection = () => {
    if (selectedSlots.length === 0) {
      alert('กรุณาเลือกช่วงเวลาที่ต้องการจอง');
      return;
    }

    // Check if only one day is selected
    const uniqueDays = [...new Set(selectedSlots.map(s => s.dayOffset))];
    if (uniqueDays.length > 1) {
      alert('กรุณาเลือกเพียงวันเดียว');
      return;
    }

    const selections = selectedSlots.map(s => ({
      dayOffset: days.indexOf(s.day),
      time: s.time
    }));

    const rangesByDay = computeRangesByDay(selections);

    // Get the first (and only) day offset
    const dayOffset = uniqueDays[0];
    const ranges = rangesByDay[dayOffset];

    // Calculate the actual date from day of week
    // dayOffset: 0=จันทร์, 1=อังคาร, 2=พุธ, 3=พฤหัส, 4=ศุกร์, 5=เสาร์, 6=อาทิตย์
    const today = new Date();
    const currentDayOfWeek = today.getDay(); // 0=Sunday, 1=Monday, ..., 6=Saturday

    // Convert Thai day index to JavaScript day index
    // Thai: 0=จันทร์, 1=อังคาร, 2=พุธ, 3=พฤหัส, 4=ศุกร์, 5=เสาร์, 6=อาทิตย์
    // JS:   1=Monday, 2=Tuesday, 3=Wednesday, 4=Thursday, 5=Friday, 6=Saturday, 0=Sunday
    const targetDayJS = dayOffset === 6 ? 0 : dayOffset + 1;

    // Calculate days until target day
    let daysUntilTarget = targetDayJS - currentDayOfWeek;
    if (daysUntilTarget <= 0) {
      // If the day has passed or is today, go to next week
      daysUntilTarget += 7;
    }

    const baseDate = new Date(today);
    baseDate.setDate(today.getDate() + daysUntilTarget);
    const dateStr = baseDate.toISOString().slice(0, 10);

    setRoomSelections({
      room: selectedRoom,
      date: dateStr,
      start_time: ranges[0].start,
      end_time: ranges[0].end
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
    const detail = formData.get('detail') || '';

    let bookingsToCreate = [];

    if (roomSelections) {
      // Room-by-room booking (single booking)
      bookingsToCreate.push({
        room: formData.get('room'),
        date: formData.get('date'),
        start_time: formData.get('start_time'),
        end_time: formData.get('end_time'),
        detail: detail
      });
    } else if (daySelections) {
      // Day-by-day booking (single booking)
      bookingsToCreate.push({
        room: formData.get('room'),
        date: formData.get('date'),
        start_time: formData.get('start_time'),
        end_time: formData.get('end_time'),
        detail: detail
      });
    }

    try {
      const response = await fetch('/api/bookings/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ bookings: bookingsToCreate })
      });

      const data = await response.json();

      if (response.ok) {
        alert('ส่งคำขอจองสำเร็จ!');
        fetchRequests();
        closeRequestDialog();
      } else {
        alert(data.message || 'เกิดข้อผิดพลาด');
      }
    } catch (error) {
      console.error('Error creating booking:', error);
      alert('เกิดข้อผิดพลาดในการเชื่อมต่อ');
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

      {/* Embedded header — แสดงเฉพาะตอน embed */}
      {embeddedMode && (
        <div style={{ marginBottom: 20 }}>
          <div className="page-title-box" style={{ marginBottom: 16 }}>
            <span className="page-title">Room Booking</span>
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
        </div>
      )}

      {/* Stats Grid */}
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

                  <label>รายละเอียด
                    <textarea name="detail" rows="3" placeholder="กรุณาระบุวัตถุประสงค์ในการใช้ห้อง..."></textarea>
                  </label>

                  <div className="modal-actions">
                    <button type="submit" className="request-btn">ส่งคำขอ</button>
                    <button type="button" className="request-btn cancel" onClick={closeRequestDialog}>
                      ยกเลิก
                    </button>
                  </div>
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
              <label>ห้อง:
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
                  {days.map((day, dayIdx) => (
                    <tr key={day}>
                      <td>{day}</td>
                      {timeSlots.map(time => {
                        const isSelected = isSlotSelected(day, time);
                        return (
                          <td
                            key={time}
                            className={`slot ${isSelected ? 'selected' : ''}`}
                            onClick={() => handleSlotClick({ day, time, dayOffset: dayIdx })}
                          >
                          </td>
                        );
                      })}
                    </tr>
                  ))}
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

      {/* Day By Modal */}
      {showDayByModal && (
        <div className="modal open">
          <div className="modal-overlay" onClick={closeDayByModal}></div>
          <div className="modal-content large">
            <h2>เลือกจองตามวัน/เวลาที่ต้องการ</h2>

            <div className="day-controls">
              <label>วันที่:
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                />
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
              <i className="fas fa-info-circle"></i> หมายเหตุ: กรุณาเลือกเพียงห้องเดียว | คลิกช่วงเวลา 2 ครั้งเพื่อเลือกช่องเวลาตั้งแต่เริ่มต้นถึงสิ้นสุด
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
                  {rooms.map(room => (
                    <tr key={room}>
                      <td>{room}</td>
                      {timeSlots.map(time => {
                        const isSelected = isSlotSelected(null, time, room);
                        return (
                          <td
                            key={time}
                            className={`slot ${isSelected ? 'selected' : ''}`}
                            onClick={() => handleSlotClick({ room, time })}
                          >
                          </td>
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
    </div>
  );
};

export default RoomBooking;