import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import './Auth.css';

const Login = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();
  const [siteTexts, setSiteTexts] = useState({});

  useEffect(() => {
    const loadSiteTexts = async () => {
      try {
        const response = await axios.get('/api/site-texts');
        const texts = {};
        response.data.allTexts?.forEach(text => {
          texts[text.text_key] = text.text_value;
        });
        setSiteTexts(texts);
        window.siteTexts = texts;
      } catch (error) {
        console.error('Error loading site texts:', error);
      }
    };
    loadSiteTexts();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const result = await login(username, password);
    
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
          <span className="terminal-title">SYSTEM_LOGIN.EXE</span>
        </div>
        
        <div className="auth-content">
          <h1 className="auth-title">
            <span className="blink">_</span>{siteTexts.login_title || 'ACCESS GRANTED'}
          </h1>
          
          <form onSubmit={handleSubmit} className="auth-form">
            <div className="input-group">
              <label>
                <span className="label-text">{siteTexts.login_username_label || 'USERNAME:'}</span>
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
                <span className="label-text">{siteTexts.login_password_label || 'PASSWORD:'}</span>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
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
              {loading ? (siteTexts.login_connecting || 'CONNECTING...') : (siteTexts.login_button || 'LOGIN')}
            </button>
          </form>

          <div className="auth-footer">
            <p>{siteTexts.login_no_account || 'No account?'} <Link to="/register" className="link">{siteTexts.login_register_link || 'REGISTER'}</Link></p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;

