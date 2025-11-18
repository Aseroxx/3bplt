import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './Auth.css';

const Register = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { register } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    setLoading(true);

    const result = await register(username, password);
    
    if (result.success) {
      navigate('/menu');
    } else {
      setError(result.error);
    }
    
    setLoading(false);
  };

  return (
    <div className="auth-container">
      <div className="auth-box">
        <div className="terminal-header">
          <div className="terminal-buttons">
          </div>
          <span className="terminal-title">SYSTEM_REGISTER.EXE</span>
        </div>
        
        <div className="auth-content">
          <h1 className="auth-title">
            <span className="blink">_</span>CREATE ACCOUNT
          </h1>
          
          <form onSubmit={handleSubmit} className="auth-form">
            <div className="input-group">
              <label>
                <span className="label-text">USERNAME:</span>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="terminal-input"
                  required
                />
              </label>
            </div>

            <div className="input-group">
              <label>
                <span className="label-text">PASSWORD:</span>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="terminal-input"
                  required
                />
              </label>
            </div>

            <div className="input-group">
              <label>
                <span className="label-text">CONFIRM PASSWORD:</span>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="terminal-input"
                  required
                />
              </label>
            </div>

            {error && <div className="error-message">{error}</div>}

            <button
              type="submit"
              className="terminal-button"
              disabled={loading}
            >
              {loading ? 'CREATING...' : 'REGISTER'}
            </button>
          </form>

          <div className="auth-footer">
            <p>Already have an account? <Link to="/login" className="link">LOGIN</Link></p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Register;

