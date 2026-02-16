import React, { useState, useEffect } from 'react';
import './RoomBooking.css';

const RoomBooking = ({ user, onLogout, onNavigate }) => {
  const [requests, setRequests] = useState([]);
  const [stats, setStats] = useState({ approved: 0, rejected: 0, pending: 0, usedLimit: 0 });
  const [showRequestDialog, setShowRequestDialog] = useState(false);
  const [showRoomByModal, setShowRoomByModal] = useState(false);
  const [showDayByModal, setShowDayByModal] = useState(false);
  const [selectedRoom, setSelectedRoom] = useState('4101');
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedSlots, setSelectedSlots] = useState([]);
  const [roomSelections, setRoomSelections] = useState(null);
  const [daySelections, setDaySelections] = useState(null);
  const [rangeStartSlot, setRangeStartSlot] = useState(null);

  const rooms = ['4101', '4210', '4303', '4309', '4410', 'คลับภาควิชา'];
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

  // Fetch booking requests
  useEffect(() => {
    fetchRequests();

    // Set default date to today
    const today = new Date().toISOString().split('T')[0];
    setSelectedDate(today);
  }, []);

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

  // Handle slot selection with range support
  const handleSlotClick = (slot) => {
    if (slot.day !== undefined) {
      // Room By Modal - Range selection by day
      if (rangeStartSlot === null) {
        // First click - set start of range
        setRangeStartSlot(slot);
        if (!isSlotSelected(slot.day, slot.time)) {
          setSelectedSlots([...selectedSlots, slot]);
        }
      } else {
        // Second click - select range between start and current
        if (rangeStartSlot.day === slot.day) {
          // Same day - select all times between
          const startTime = timeToMinutes(rangeStartSlot.time);
          const endTime = timeToMinutes(slot.time);
          const minTime = Math.min(startTime, endTime);
          const maxTime = Math.max(startTime, endTime);

          // Get all times in range
          const newSlots = [];
          timeSlots.forEach(time => {
            const minutes = timeToMinutes(time);
            if (minutes >= minTime && minutes <= maxTime) {
              const slotObj = { day: slot.day, time, dayOffset: slot.dayOffset };
              if (!selectedSlots.some(s => s.day === slotObj.day && s.time === slotObj.time)) {
                newSlots.push(slotObj);
              }
            }
          });

          setSelectedSlots([...selectedSlots, ...newSlots]);
          setRangeStartSlot(null);
        } else {
          // Different day - just click on individual slot
          const exists = selectedSlots.find(s =>
            s.day === slot.day && s.time === slot.time
          );
          if (exists) {
            setSelectedSlots(selectedSlots.filter(s =>
              !(s.day === slot.day && s.time === slot.time)
            ));
          } else {
            setSelectedSlots([...selectedSlots, slot]);
          }
          setRangeStartSlot(null);
        }
      }
    } else {
      // Day By Modal - Range selection by room
      if (rangeStartSlot === null) {
        // First click - set start of range
        setRangeStartSlot(slot);
        if (!isSlotSelected(null, slot.time, slot.room)) {
          setSelectedSlots([...selectedSlots, slot]);
        }
      } else {
        // Second click - select range between start and current
        if (rangeStartSlot.room === slot.room) {
          // Same room - select all times between
          const startTime = timeToMinutes(rangeStartSlot.time);
          const endTime = timeToMinutes(slot.time);
          const minTime = Math.min(startTime, endTime);
          const maxTime = Math.max(startTime, endTime);

          // Get all times in range
          const newSlots = [];
          timeSlots.forEach(time => {
            const minutes = timeToMinutes(time);
            if (minutes >= minTime && minutes <= maxTime) {
              const slotObj = { room: slot.room, time };
              if (!selectedSlots.some(s => s.room === slotObj.room && s.time === slotObj.time)) {
                newSlots.push(slotObj);
              }
            }
          });

          setSelectedSlots([...selectedSlots, ...newSlots]);
          setRangeStartSlot(null);
        } else {
          // Different room - just click on individual slot
          const exists = selectedSlots.find(s =>
            s.room === slot.room && s.time === slot.time
          );
          if (exists) {
            setSelectedSlots(selectedSlots.filter(s =>
              !(s.room === slot.room && s.time === slot.time)
            ));
          } else {
            setSelectedSlots([...selectedSlots, slot]);
          }
          setRangeStartSlot(null);
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
  };

  const closeRoomByModal = () => {
    setShowRoomByModal(false);
    setSelectedSlots([]);
    setRangeStartSlot(null);
  };

  const closeDayByModal = () => {
    setShowDayByModal(false);
    setSelectedSlots([]);
    setRangeStartSlot(null);
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
    <div className="room-booking-layout">
      {/* Header */}
      <header className="booking-header">
        <div className="header-content">
          <div className="logo-section">
            <img src="/logo/enkku_logo.png" alt="Logo" className="header-logo" />
            <h1>Room Access Control</h1>
          </div>

          <div className="user-section">
            <button className="logout-btn" onClick={onLogout}>
              <i className="fa-solid fa-right-from-bracket"></i>
              Logout
            </button>
            <button className="user-info profile-button" onClick={() => onNavigate && onNavigate('profile')}>
              <i className="fa-solid fa-user"></i>
              <span className='profileIcon'>{user?.first_name} {user?.last_name}</span>
            </button>
          </div>
        </div>

        <button className="request-btn-main" onClick={() => {
          setSelectedSlots([]);
          setRoomSelections(null);
          setDaySelections(null);
          setRangeStartSlot(null);
          setShowRequestDialog(true);
        }}>
          <i className="fas fa-plus"></i> ส่งคำขอใหม่
        </button>
      </header>

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
          <table>
            <thead>
              <tr>
                <th>ประเภทห้อง</th>
                <th>วันที่จอง</th>
                <th>เวลาเริ่ม</th>
                <th>เวลาสิ้นสุด</th>
                <th>รายละเอียดการจอง</th>
                <th>สถานะ</th>
                <th>ผู้ตรวจสอบ</th>
                <th>หมายเหตุ</th>
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
                      <td>{req.approved_by || '-'}</td>
                      <td>{req.remark || '-'}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
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
                    setShowRequestDialog(false);
                    setShowRoomByModal(true);
                  }}>
                    เลือกจองตามห้องที่ต้องการ
                  </button>
                  <button className="dialog-btn" onClick={() => {
                    setSelectedSlots([]);
                    setShowRequestDialog(false);
                    setShowDayByModal(true);
                  }}>
                    เลือกจองตามวัน/เวลาที่ต้องการ
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