import React from 'react';
import { useNavigate } from 'react-router-dom';

function HomePage({ onLogout }) {
  const navigate = useNavigate();

  const logout = async () => {
    try {
      // Call the backend to log out (invalidate the session or token)
      const response = await fetch('/auth/logout', {
        method: 'POST',
        credentials: 'include', // Ensure cookies are sent with the request
      });

      if (response.ok) {
        alert('Logged out successfully');
        onLogout(); // Update the app state to reflect the user is logged out
        navigate('/'); // Redirect to the WelcomePage
      } else {
         let error = await response.text();
         alert(error);
      }
    } catch (error) {
      console.error('Error logging out:', error);
      alert('Error logging out');
    }
  };

  return (
    <div>
      <h1>You're logged in</h1>
      <button onClick={logout}>Log Out</button>
    </div>
  );
}

export default HomePage;

