import React, { useState, useEffect } from 'react';
import Login from './Login';
import Signup from './Signup';
import AdminDashboard from './AdminDashboard';
import RoomBooking from './RoomBooking';

const App = () => {
  const [currentView, setCurrentView] = useState('login'); // 'login', 'signup', 'dashboard', 'booking'
  const [user, setUser] = useState(null);

  // Check if user is already logged in
  useEffect(() => {
    const token = localStorage.getItem('token');
    const storedUser = localStorage.getItem('user');
    
    if (token && storedUser) {
      try {
        const userData = JSON.parse(storedUser);
        setUser(userData);
        
        // Route based on email domain
        if (userData.email) {
          if (userData.email.endsWith('@kku.ac.th')) {
            setCurrentView('dashboard'); // Admin Dashboard
          } else if (userData.email.endsWith('@kkumail.com')) {
            setCurrentView('booking'); // Room Booking
          } else {
            setCurrentView('dashboard'); // Default to dashboard
          }
        } else {
          setCurrentView('dashboard');
        }
      } catch (err) {
        console.error('Error parsing user data:', err);
        localStorage.removeItem('token');
        localStorage.removeItem('user');
      }
    }
  }, []);

  const handleLogin = (userData) => {
    console.log('handleLogin called with:', userData);
    setUser(userData);
    
    // Route based on email domain
    if (userData.email) {
      if (userData.email.endsWith('@kku.ac.th')) {
        setCurrentView('dashboard'); // Admin Dashboard for @kku.ac.th
      } else if (userData.email.endsWith('@kkumail.com')) {
        setCurrentView('booking'); // Room Booking for @kkumail.com
      } else {
        setCurrentView('dashboard'); // Default
      }
    } else {
      setCurrentView('dashboard');
    }
    
    console.log('View changed to:', userData.email?.endsWith('@kkumail.com') ? 'booking' : 'dashboard');
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
    setCurrentView('login');
  };

  // Render based on current view
  if (currentView === 'login') {
    return (
      <Login 
        onLogin={handleLogin}
        onSwitchToSignup={() => setCurrentView('signup')}
      />
    );
  }

  if (currentView === 'signup') {
    return (
      <Signup 
        onSwitchToLogin={() => setCurrentView('login')}
      />
    );
  }

  if (currentView === 'dashboard' && user) {
    return (
      <AdminDashboard 
        user={user}
        onLogout={handleLogout}
      />
    );
  }

  if (currentView === 'booking' && user) {
    return (
      <RoomBooking 
        user={user}
        onLogout={handleLogout}
      />
    );
  }

  // Default fallback
  return <Login onLogin={handleLogin} />;
};

export default App;