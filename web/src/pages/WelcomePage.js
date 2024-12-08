import React from 'react';
import { Link } from 'react-router-dom';

function WelcomePage() {
  return (
    <div>
      <h1>Hello new user!</h1>
      <p>Please sign in to continue.</p>
      <Link to="/auth">
        <button>Go to Sign In</button>
      </Link>
    </div>
  );
}

export default WelcomePage;

