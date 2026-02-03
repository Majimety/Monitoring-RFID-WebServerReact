import React, { useState, useEffect } from 'react';
import Login from './Login';
import Signup from './Signup';
import AdminDashboard from './AdminDashboard';

const App = () => {
  const [currentView, setCurrentView] = useState('login'); // 'login', 'signup', 'dashboard'
  const [user, setUser] = useState(null);

  // Check if user is already logged in
  useEffect(() => {
    const token = localStorage.getItem('token');
    const storedUser = localStorage.getItem('user');
    
    if (token && storedUser) {
      try {
        const userData = JSON.parse(storedUser);
        setUser(userData);
        setCurrentView('dashboard');
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
    setCurrentView('dashboard');
    console.log('View changed to dashboard');
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

  // Default fallback
  return <Login onLogin={handleLogin} />;
};

export default App;