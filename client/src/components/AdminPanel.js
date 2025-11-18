import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import './AdminPanel.css';

const AdminPanel = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('elements');
  const [banners, setBanners] = useState([]);
  const [editingBanner, setEditingBanner] = useState(null);
  const [siteTexts, setSiteTexts] = useState([]);
  const [editingText, setEditingText] = useState(null);

  useEffect(() => {
    if (user?.role === 'admin') {
      loadBanners();
      loadSiteTexts();
    }
  }, [user]);

  const loadBanners = async () => {
    try {
      const response = await axios.get('/api/admin/banners');
      setBanners(response.data.banners);
    } catch (error) {
      console.error('Error loading banners:', error);
    }
  };

  const loadSiteTexts = async () => {
    try {
      const response = await axios.get('/api/site-texts');
      setSiteTexts(response.data.allTexts || []);
    } catch (error) {
      console.error('Error loading site texts:', error);
    }
  };

  const handleUpdateSiteText = async (textKey, textValue) => {
    try {
      const token = localStorage.getItem('token');
      await axios.put(`/api/admin/site-texts/${textKey}`, 
        { text_value: textValue },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      await loadSiteTexts();
      setEditingText(null);
      alert('Site text updated successfully');
      // Reload the menu to show changes
      if (window.__bookMenuReload) {
        window.__bookMenuReload();
      }
    } catch (error) {
      console.error('Error updating site text:', error);
      alert('Error updating site text');
    }
  };



  const handleUpdateBanner = async (bannerId, updates) => {
    try {
      await axios.put(`/api/admin/banners/${bannerId}`, updates);
      await loadBanners();
      setEditingBanner(null);
    } catch (error) {
      console.error('Error updating banner:', error);
      alert('Error updating banner');
    }
  };

  const handleDeleteBanner = async (bannerId) => {
    if (window.confirm('Delete this banner?')) {
      try {
        await axios.delete(`/api/admin/banners/${bannerId}`);
        await loadBanners();
      } catch (error) {
        console.error('Error deleting banner:', error);
        alert('Error deleting banner');
      }
    }
  };


  if (user?.role !== 'admin') {
    return (
      <div className="admin-container">
        <div className="admin-box">
          <h1>ACCESS DENIED</h1>
          <p>Admin privileges required</p>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-container">
      <div className="admin-header">
        <div className="terminal-header">
          <div className="terminal-buttons">
          </div>
          <span className="terminal-title">ADMIN_PANEL</span>
        </div>
        <div className="admin-user-info">
          <span>ADMIN: {user?.username}</span>
          <button onClick={() => navigate('/menu')} className="admin-button" style={{ marginRight: '10px' }}>RETURN TO MENU</button>
          <button onClick={logout} className="logout-btn">LOGOUT</button>
        </div>
      </div>

      <div className="admin-tabs">
        <button
          className={`tab-button ${activeTab === 'elements' ? 'active' : ''}`}
          onClick={() => setActiveTab('elements')}
        >
          PAGE ELEMENTS
        </button>
        <button
          className={`tab-button ${activeTab === 'texts' ? 'active' : ''}`}
          onClick={() => setActiveTab('texts')}
        >
          SITE TEXTS
        </button>
        <button
          className="tab-button design-button"
          onClick={() => {
            navigate('/menu?design=true');
          }}
        >
          DESIGN MODE
        </button>
      </div>

      <div className="admin-content">
        {activeTab === 'elements' && (
          <div className="banners-section">
            <h2>PAGE ELEMENTS</h2>
            
            <div className="banners-list">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h3>ELEMENTS ON PAGE ({banners.length})</h3>
                <button 
                  onClick={() => navigate('/menu?design=true&add=textarea')}
                  className="admin-button"
                  style={{ marginLeft: 'auto' }}
                >
                  + ADD TEXTAREA
                </button>
              </div>
              {banners.length === 0 ? (
                <p style={{ color: '#888', textAlign: 'center', padding: '20px' }}>
                  No elements on the page. Use DESIGN MODE to add elements.
                </p>
              ) : (
                banners.map((banner) => (
                  <div key={banner.id} className="banner-item">
                    {editingBanner === banner.id ? (
                      <BannerEditor
                        banner={banner}
                        onSave={(updates) => handleUpdateBanner(banner.id, updates)}
                        onCancel={() => setEditingBanner(null)}
                      />
                    ) : (
                      <>
                        <div className="banner-preview">
                          {banner.type === 'text' ? (
                            <div style={{
                              minWidth: '100px',
                              minHeight: '50px',
                              padding: '10px',
                              background: '#1a1a1a',
                              border: '1px solid #ff00ff',
                              color: banner.color || '#ff00ff',
                              fontSize: `${Math.min(banner.font_size || 16, 14)}px`,
                              fontFamily: banner.font_family || 'JetBrains Mono',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              textAlign: 'center'
                            }}>
                              {banner.text_content || 'TEXT'}
                            </div>
                          ) : (
                            <img src={banner.url} alt="Element" style={{ maxWidth: '100px', maxHeight: '100px', objectFit: 'contain' }} />
                          )}
                          <div className="banner-info">
                            <p><strong>Type:</strong> {banner.type?.toUpperCase()}</p>
                            {banner.type === 'text' && (
                              <>
                                <p><strong>Text:</strong> {banner.text_content?.substring(0, 50)}...</p>
                                <p><strong>Font:</strong> {banner.font_family || 'JetBrains Mono'}</p>
                                <p><strong>Font Size:</strong> {banner.font_size || 16}px</p>
                              </>
                            )}
                            <p><strong>Position:</strong> ({banner.position_x}, {banner.position_y})</p>
                            <p><strong>Rotation:</strong> {banner.rotation}°</p>
                            <p><strong>Size:</strong> {banner.width}x{banner.height}</p>
                            <p><strong>Z-Index:</strong> {banner.z_index}</p>
                            <p><strong>Active:</strong> {banner.is_active ? 'YES' : 'NO'}</p>
                          </div>
                        </div>
                        <div className="banner-actions">
                          <button onClick={() => navigate(`/menu?design=true&element=${banner.id}`)} className="admin-button small">EDIT</button>
                          <button onClick={() => handleDeleteBanner(banner.id)} className="admin-button small delete">DELETE</button>
                        </div>
                      </>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {activeTab === 'texts' && (
          <div className="banners-section">
            <h2>SITE TEXTS</h2>
            <p style={{ color: '#888', marginBottom: '20px' }}>
              Edit all text labels and messages displayed on the site. Changes are saved permanently.
            </p>
            
            <div className="banners-list">
              <h3>EDITABLE TEXTS ({siteTexts.length})</h3>
              {siteTexts.length === 0 ? (
                <p style={{ color: '#888', textAlign: 'center', padding: '20px' }}>
                  Loading site texts...
                </p>
              ) : (
                siteTexts.map((text) => (
                  <div key={text.id} className="banner-item">
                    {editingText === text.text_key ? (
                      <div className="banner-editor">
                        <div className="form-group">
                          <label>KEY: {text.text_key}</label>
                          {text.description && (
                            <p style={{ color: '#888', fontSize: '12px', marginBottom: '10px' }}>
                              {text.description}
                            </p>
                          )}
                          <textarea
                            value={text.text_value || ''}
                            onChange={(e) => {
                              const updatedTexts = siteTexts.map(t => 
                                t.text_key === text.text_key 
                                  ? { ...t, text_value: e.target.value }
                                  : t
                              );
                              setSiteTexts(updatedTexts);
                            }}
                            style={{
                              width: '100%',
                              minHeight: '100px',
                              padding: '10px',
                              background: '#1a1a1a',
                              border: '1px solid #ff00ff',
                              color: '#ff00ff',
                              fontFamily: 'JetBrains Mono',
                              fontSize: '14px',
                              resize: 'vertical'
                            }}
                          />
                        </div>
                        <div className="form-actions">
                          <button
                            onClick={() => handleUpdateSiteText(text.text_key, text.text_value)}
                            className="admin-button small"
                          >
                            SAVE
                          </button>
                          <button
                            onClick={() => {
                              setEditingText(null);
                              loadSiteTexts(); // Reload to reset changes
                            }}
                            className="admin-button small"
                          >
                            CANCEL
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="banner-preview">
                          <div className="banner-info">
                            <p><strong>KEY:</strong> {text.text_key}</p>
                            {text.description && (
                              <p style={{ color: '#888', fontSize: '12px' }}>
                                <strong>Description:</strong> {text.description}
                              </p>
                            )}
                            <p><strong>Current Value:</strong></p>
                            <div style={{
                              padding: '10px',
                              background: '#1a1a1a',
                              border: '1px solid #333',
                              color: '#ff00ff',
                              fontFamily: 'JetBrains Mono',
                              fontSize: '14px',
                              marginTop: '5px',
                              wordBreak: 'break-word'
                            }}>
                              {text.text_value || '(empty)'}
                            </div>
                            <p style={{ color: '#888', fontSize: '11px', marginTop: '5px' }}>
                              Last updated: {new Date(text.updated_at).toLocaleString()}
                            </p>
                          </div>
                        </div>
                        <div className="banner-actions">
                          <button 
                            onClick={() => setEditingText(text.text_key)} 
                            className="admin-button small"
                          >
                            EDIT
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        )}

      </div>
    </div>
  );
};

const BannerEditor = ({ banner, onSave, onCancel }) => {
  const [updates, setUpdates] = useState({
    position_x: banner.position_x,
    position_y: banner.position_y,
    rotation: banner.rotation,
    width: banner.width,
    height: banner.height,
    z_index: banner.z_index,
    is_active: banner.is_active,
    url: banner.url,
    ...(banner.type === 'text' ? {
      text_content: banner.text_content,
      font_family: banner.font_family,
      font_size: banner.font_size,
      font_weight: banner.font_weight,
      font_style: banner.font_style,
      color: banner.color
    } : {})
  });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSave(updates);
      }}
      className="banner-editor"
    >
      {banner.type === 'text' && (
        <div className="form-group">
          <label>TEXT CONTENT:</label>
          <textarea
            value={updates.text_content || ''}
            onChange={(e) => setUpdates({ ...updates, text_content: e.target.value })}
            className="admin-textarea"
            rows="4"
          />
        </div>
      )}
      
      {banner.type !== 'text' && (
        <div className="form-group">
          <label>URL:</label>
          <input
            type="text"
            value={updates.url || ''}
            onChange={(e) => setUpdates({ ...updates, url: e.target.value })}
            className="admin-input"
          />
        </div>
      )}
      
      <div className="form-row">
        <div className="form-group">
          <label>X:</label>
          <input
            type="number"
            value={updates.position_x}
            onChange={(e) => setUpdates({ ...updates, position_x: parseInt(e.target.value) })}
            className="admin-input"
          />
        </div>
        <div className="form-group">
          <label>Y:</label>
          <input
            type="number"
            value={updates.position_y}
            onChange={(e) => setUpdates({ ...updates, position_y: parseInt(e.target.value) })}
            className="admin-input"
          />
        </div>
        <div className="form-group">
          <label>ROTATION:</label>
          <input
            type="number"
            value={updates.rotation}
            onChange={(e) => setUpdates({ ...updates, rotation: parseInt(e.target.value) })}
            className="admin-input"
          />
        </div>
      </div>
      <div className="form-row">
        <div className="form-group">
          <label>WIDTH:</label>
          <input
            type="number"
            value={updates.width}
            onChange={(e) => setUpdates({ ...updates, width: parseInt(e.target.value) })}
            className="admin-input"
          />
        </div>
        <div className="form-group">
          <label>HEIGHT:</label>
          <input
            type="number"
            value={updates.height}
            onChange={(e) => setUpdates({ ...updates, height: parseInt(e.target.value) })}
            className="admin-input"
          />
        </div>
        <div className="form-group">
          <label>Z-INDEX:</label>
          <input
            type="number"
            value={updates.z_index}
            onChange={(e) => setUpdates({ ...updates, z_index: parseInt(e.target.value) })}
            className="admin-input"
          />
        </div>
        <div className="form-group">
          <label>ACTIVE:</label>
          <input
            type="checkbox"
            checked={updates.is_active}
            onChange={(e) => setUpdates({ ...updates, is_active: e.target.checked })}
            className="admin-checkbox"
          />
        </div>
      </div>
      <div className="form-actions">
        <button type="submit" className="admin-button">SAVE</button>
        <button type="button" onClick={onCancel} className="admin-button secondary">CANCEL</button>
      </div>
    </form>
  );
};


export default AdminPanel;

