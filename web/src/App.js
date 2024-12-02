import React, { useState } from 'react';

const SignUp = () => {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [name, setName] = useState('');
    const [error, setError] = useState('');

    const handleSubmit = async (e) => {
        e.preventDefault();

        // Basic validation (client-side)
        if (!username || !password || !name) {
            setError("All fields are required.");
            return;
        }

        const userData = { username, password, name };

        try {
            const response = await fetch('http://localhost:8080/api/signup', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(userData),
            }) ;

            if (response.ok) {
                alert('Account created successfully!');
                // Redirect to login page or dashboard
            } else {
                const errorData = await response.text();
                console.log('Error response:', errorData); // Log error details
                setError(errorData|| 'Something went wrong');
            }
        } catch (err) {
            console.log('Fetch error:', err); // Log fetch error details
            setError('Server error dmm: ' + err.message);
        }
    };

    return (
        <div>
            <h2>Sign Up ddmm</h2>
            <form onSubmit={handleSubmit}>
                <div>
                    <label>Name:</label>
                    <input type="text" value={name} onChange={(e) => setName(e.target.value)} />
                </div>
                <div>
                    <label>Username:</label>
                    <input type="text" value={username} onChange={(e) => setUsername(e.target.value)} />
                </div>
                <div>
                    <label>Password:</label>
                    <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
                </div>
                {error && <div style={{ color: 'red' }}>{error}</div>}
                <button type="submit">Sign Up</button>
            </form>
        </div>
    );
};

export default SignUp;

