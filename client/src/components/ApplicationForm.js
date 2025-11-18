import React, { useState } from 'react';
import axios from 'axios';
import './ApplicationForm.css';

const ApplicationForm = ({ onBack }) => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    skills: '',
    message: ''
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await axios.post('/api/applications', formData);
      setSuccess(true);
      setTimeout(() => {
        setSuccess(false);
        setFormData({ name: '', email: '', skills: '', message: '' });
      }, 3000);
    } catch (error) {
      setError(error.response?.data?.error || 'Failed to submit application');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="application-container">
        <div className="success-message">
          <div className="terminal-header">
            <div className="terminal-buttons">
            </div>
            <span className="terminal-title">APPLICATION_STATUS.exe</span>
          </div>
          <div className="success-content">
            <h1 className="success-title">
              <span className="blink">_</span>APPLICATION SUBMITTED
            </h1>
            <pre className="terminal-text">
{`> STATUS: SUCCESS
> APPLICATION RECEIVED
> PROCESSING...

Your application has been successfully submitted.
Our team will review your submission and contact you soon.

> THANK YOU FOR YOUR INTEREST
> RETURNING TO DOCUMENTATION...`}
            </pre>
            <button onClick={onBack} className="terminal-button">
              BACK TO DOCUMENTATION
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="application-container">
      <div className="application-box">
        <div className="terminal-header">
          <div className="terminal-buttons">
            <span className="btn red"></span>
            <span className="btn yellow"></span>
            <span className="btn green"></span>
          </div>
          <span className="terminal-title">APPLICATION_FORM.exe</span>
        </div>
        
        <div className="application-content">
          <h1 className="application-title">
            <span className="blink">_</span>JOIN OUR TEAM
          </h1>
          
          <form onSubmit={handleSubmit} className="application-form">
            <div className="input-group">
              <label>
                <span className="label-text">FULL NAME:</span>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  className="terminal-input"
                  required
                />
              </label>
            </div>

            <div className="input-group">
              <label>
                <span className="label-text">EMAIL:</span>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  className="terminal-input"
                  required
                />
              </label>
            </div>

            <div className="input-group">
              <label>
                <span className="label-text">SKILLS & EXPERIENCE:</span>
                <textarea
                  name="skills"
                  value={formData.skills}
                  onChange={handleChange}
                  className="terminal-input terminal-textarea"
                  rows="4"
                  required
                />
              </label>
            </div>

            <div className="input-group">
              <label>
                <span className="label-text">MESSAGE / MOTIVATION:</span>
                <textarea
                  name="message"
                  value={formData.message}
                  onChange={handleChange}
                  className="terminal-input terminal-textarea"
                  rows="5"
                  required
                />
              </label>
            </div>

            {error && <div className="error-message">{error}</div>}

            <div className="form-actions">
              <button
                type="button"
                onClick={onBack}
                className="terminal-button secondary"
              >
                BACK
              </button>
              <button
                type="submit"
                className="terminal-button"
                disabled={loading}
              >
                {loading ? 'SUBMITTING...' : 'SUBMIT APPLICATION'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default ApplicationForm;

