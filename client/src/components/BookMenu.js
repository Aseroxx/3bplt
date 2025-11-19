import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Link, useLocation } from 'react-router-dom';
import axios from 'axios';
import ApplicationForm from './ApplicationForm';
import DesignMode from './DesignMode';
import './BookMenu.css';

// Helper function to generate visual effects styles
const getVisualEffectsStyles = (banner) => {
  const styles = {};
  
  // Opacity
  if (banner.opacity !== undefined && banner.opacity !== null) {
    styles.opacity = banner.opacity;
  }
  
  // Blur filter
  if (banner.blur !== undefined && banner.blur > 0) {
    styles.filter = `blur(${banner.blur}px)`;
  }
  
  // Glow effects removed for raw style
  
  // Box shadow (for images and other elements)
  if (banner.shadow_color && (banner.shadow_blur > 0 || banner.shadow_x !== 0 || banner.shadow_y !== 0)) {
    const shadowColor = banner.shadow_color;
    const shadowBlur = banner.shadow_blur || 0;
    const shadowX = banner.shadow_x || 0;
    const shadowY = banner.shadow_y || 0;
    const shadow = `${shadowX}px ${shadowY}px ${shadowBlur}px ${shadowColor}`;
    styles.boxShadow = styles.boxShadow 
      ? `${styles.boxShadow}, ${shadow}` 
      : shadow;
  }
  
  return styles;
};

// Helper function to build full URL for assets (fonts, images)
const buildAssetUrl = (path) => {
  if (!path) return path;
  // If path is already a full URL (starts with http:// or https://), return as is
  if (path.startsWith('http://') || path.startsWith('https://')) {
    return path;
  }
  // If path starts with /, it's a relative path - prepend API base URL
  if (path.startsWith('/')) {
    const apiBaseUrl = process.env.REACT_APP_API_URL || window.location.origin;
    return apiBaseUrl + path;
  }
  // Otherwise return as is
  return path;
};

// Component to handle locked page-specific elements with dynamic position calculation
const LockedPageElement = ({ banner, positionType, leftPos, topPos, fontStyle }) => {
  const [position, setPosition] = useState({ left: leftPos, top: topPos });
  
  useEffect(() => {
    // For locked page-specific elements, recalculate position on scroll/resize
    if (banner.is_locked && banner.page_number !== null && banner.page_number !== undefined) {
      const updatePosition = () => {
        const pageContainer = document.querySelector(`.book-page-container[data-page-index="${banner.page_number - 1}"]`);
        const pageElement = pageContainer ? pageContainer.querySelector('.page') : null;
        if (pageElement) {
          const pageRect = pageElement.getBoundingClientRect();
          setPosition({
            left: pageRect.left + (banner.position_x || 0),
            top: pageRect.top + (banner.position_y || 0)
          });
        }
      };
      
      updatePosition();
      window.addEventListener('scroll', updatePosition);
      window.addEventListener('resize', updatePosition);
      
      return () => {
        window.removeEventListener('scroll', updatePosition);
        window.removeEventListener('resize', updatePosition);
      };
    }
  }, [banner.is_locked, banner.page_number, banner.position_x, banner.position_y]);

  return (
    <div
      className="banner-overlay"
      style={{
        position: positionType,
        left: `${position.left}px`,
        top: `${position.top}px`,
        transform: `rotate(${banner.rotation || 0}deg)`,
        transformOrigin: 'center center',
        width: banner.type === 'text' ? 'auto' : `${banner.width || 200}px`,
        height: banner.type === 'text' ? 'auto' : `${banner.height || 200}px`,
        minWidth: banner.type === 'text' ? `${banner.width || 200}px` : 'auto',
        minHeight: banner.type === 'text' ? `${banner.height || 50}px` : 'auto',
        zIndex: banner.z_index || 1,
        pointerEvents: 'none'
      }}
    >
      {banner.type === 'text' ? (
        <div
          className="banner-text"
          style={{
            ...fontStyle,
            fontSize: `${banner.font_size || 16}px`,
            fontWeight: banner.font_weight || 'normal',
            fontStyle: banner.font_style || 'normal',
            color: banner.color || '#ff00ff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            textAlign: 'center',
            width: 'auto',
            height: 'auto',
            minWidth: `${banner.width || 200}px`,
            minHeight: `${banner.height || 50}px`,
            wordWrap: 'break-word',
            whiteSpace: 'pre-wrap',
            overflow: 'visible',
            padding: '5px',
            ...getVisualEffectsStyles(banner)
          }}
        >
          {banner.text_content}
        </div>
      ) : banner.type === 'gif' || banner.type === 'image' ? (
        <img
          src={buildAssetUrl(banner.url)}
          alt="Banner"
          style={{ 
            width: '100%', 
            height: '100%', 
            objectFit: 'contain',
            ...getVisualEffectsStyles(banner)
          }}
        />
      ) : (
        <div className="banner-text" style={{ width: '100%', height: '100%' }}>
          {banner.url}
        </div>
      )}
    </div>
  );
};

const BookMenu = ({ designMode, selectedTextElement, onTextElementClick, onTextElementMouseDown, onTextElementContextMenu, pages: pagesProp, banners: bannersProp, textStyles: textStylesProp, siteTexts: siteTextsProp }) => {
  const { user, logout } = useAuth();
  const location = useLocation();
  const [currentPage, setCurrentPage] = useState(0);
  const [showApplication, setShowApplication] = useState(false);
  const [pages, setPages] = useState(pagesProp || []);
  const [banners, setBanners] = useState(bannersProp || []);
  const [textStyles, setTextStyles] = useState(textStylesProp || []);
  const [siteTexts, setSiteTexts] = useState(siteTextsProp || {});
  const [showDesignMode, setShowDesignMode] = useState(false);
  const totalPages = pages && pages.length > 0 ? pages.length : 5;
  
  // Check if we're in design mode from URL
  const isDesignMode = designMode || (location.search.includes('design=true') && user?.role === 'admin');
  const params = new URLSearchParams(location.search);
  const urlPagesMode = params.get('pages') === 'true';
  
  // Get design mode state from window if available and track tool changes
  const [currentSelectedTool, setCurrentSelectedTool] = useState(() => {
    const designModeState = window.__designModeState;
    return designModeState?.selectedTool || 'select';
  });
  
  // Update tool when design mode state changes
  useEffect(() => {
    const checkTool = () => {
      const designModeState = window.__designModeState;
      const tool = designModeState?.selectedTool || 'select';
      if (tool !== currentSelectedTool) {
        setCurrentSelectedTool(tool);
      }
    };
    const interval = setInterval(checkTool, 100);
    return () => clearInterval(interval);
  }, [currentSelectedTool]);
  
  const designModeState = window.__designModeState;
  // Pages mode is active when tool is 'pages' OR URL has pages=true
  const pagesMode = urlPagesMode || currentSelectedTool === 'pages';
  
  // Original texts (title, content, system-info, page-number) can only be edited in "edit pages" mode
  const editOriginalTextsMode = isDesignMode && pagesMode && currentSelectedTool === 'pages';
  // Textareas can only be edited in "edit pages" mode (not in "select" mode)
  const editTextareasMode = isDesignMode && pagesMode && currentSelectedTool === 'pages';
  // Other items added by admin (text, image) can be edited with both 'select' and 'pages' tools
  const editItemsMode = isDesignMode && (currentSelectedTool === 'select' || currentSelectedTool === 'pages' || pagesMode);
  const activeSelectedTextElement = selectedTextElement || (designModeState?.selectedTextElement);
  const activeOnTextElementClick = onTextElementClick || (designModeState?.onTextElementClick);
  const activeOnTextElementMouseDown = onTextElementMouseDown || (designModeState?.onTextElementMouseDown);
  const activeOnTextElementContextMenu = onTextElementContextMenu || (designModeState?.onTextElementContextMenu);
  const isDraggingTextElement = designModeState?.isDraggingTextElement;
  const textElementDragPosition = designModeState?.textElementDragPosition;

  useEffect(() => {
    // Check if we should show design mode (from admin panel)
    const params = new URLSearchParams(location.search);
    if (params.get('design') === 'true' && user?.role === 'admin') {
      setShowDesignMode(true);
    }
  }, [location, user, designMode]);

  const loadCustomFonts = async () => {
    try {
      const response = await axios.get('/api/fonts');
      const fonts = response.data.fonts || [];
      fonts.forEach(font => {
        // Build full URL for font file using helper function
        const fontUrl = buildAssetUrl(font.file_path);
        // Encode the file path to handle spaces and special characters
        const encodedPath = encodeURI(fontUrl);
        
        const fontFace = new FontFace(
          font.font_family,
          `url(${encodedPath})`
        );
        fontFace.load().then(loadedFont => {
          document.fonts.add(loadedFont);
          console.log('Font loaded successfully:', font.font_family);
        }).catch(err => {
          console.error('Error loading font:', font.font_family, err);
        });
      });
    } catch (error) {
      console.error('Error loading fonts:', error);
    }
  };

  const loadPages = async () => {
    try {
      const response = await axios.get('/api/book-pages');
      console.log('Loaded pages from database:', response.data.pages);
      // Store pages with all their data from database (including page_number)
      const loadedPages = response.data.pages.map(page => ({
        page_number: page.page_number,
        title: page.title,
        content: page.content.replace('USER', user?.username || 'USER')
      }));
      // Sort by page_number to ensure correct order
      loadedPages.sort((a, b) => a.page_number - b.page_number);
      setPages(loadedPages);
      console.log('Pages set in state:', loadedPages);
    } catch (error) {
      console.error('Error loading pages:', error);
      // Fallback to default pages
      setPages(getDefaultPages());
    }
  };

  const loadBanners = async () => {
    try {
      const response = await axios.get('/api/banners');
      console.log('Loaded banners:', response.data.banners);
      setBanners(response.data.banners || []);
    } catch (error) {
      console.error('Error loading banners:', error);
      setBanners([]);
    }
  };

  const loadTextStyles = async () => {
    try {
      const response = await axios.get('/api/page-text-styles');
      setTextStyles(response.data.styles || []);
    } catch (error) {
      console.error('Error loading text styles:', error);
    }
  };

  const loadSiteTexts = async () => {
    try {
      const response = await axios.get('/api/site-texts');
      setSiteTexts(response.data.texts || {});
    } catch (error) {
      console.error('Error loading site texts:', error);
      // Set defaults if API fails
      setSiteTexts({
        terminal_title: 'PROJECT_DOCUMENTATION.exe',
        user_label: 'USER:',
        admin_panel_link: 'ADMIN PANEL',
        logout_button: 'LOGOUT',
        prev_button: 'PREV',
        next_button: 'NEXT',
        system_info_prefix: 'SYSTEM: ONLINE | STATUS: ACTIVE | TIME:'
      });
    }
  };

  // Update state when props change (for design mode)
  useEffect(() => {
    if (pagesProp) setPages(pagesProp);
    if (bannersProp) setBanners(bannersProp);
    if (textStylesProp) setTextStyles(textStylesProp);
    if (siteTextsProp) setSiteTexts(siteTextsProp);
  }, [pagesProp, bannersProp, textStylesProp, siteTextsProp]);

  useEffect(() => {
    // Only load from API if props are not provided
    if (!pagesProp) loadPages();
    if (!bannersProp) loadBanners();
    loadCustomFonts();
    if (!textStylesProp) loadTextStyles();
    if (!siteTextsProp) loadSiteTexts();
    
    // Expose reload function for DesignMode
    window.__bookMenuReload = () => {
      if (!pagesProp) loadPages();
      if (!bannersProp) loadBanners();
      if (!textStylesProp) loadTextStyles();
      if (!siteTextsProp) loadSiteTexts();
    };
    
    return () => {
      delete window.__bookMenuReload;
    };
  }, []);

  // Force pages 1 and 2 system-info to use relative positioning (same as other pages)
  useEffect(() => {
    const fixPages12 = async () => {
      try {
        const token = localStorage.getItem('token');
        if (!token) return;
        
        // Force reset to null to use relative positioning in footer
        await Promise.all([
          axios.put(`/api/admin/page-text-styles/1/system-info`, { position_x: null, position_y: null }, {
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
          }),
          axios.put(`/api/admin/page-text-styles/2/system-info`, { position_x: null, position_y: null }, {
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
          })
        ]);
        
        // Reload to show changes
        if (!textStylesProp) {
          const response = await axios.get('/api/page-text-styles');
          setTextStyles(response.data.styles || []);
        }
        if (window.__bookMenuReload) window.__bookMenuReload();
      } catch (error) {
        // Ignore errors
      }
    };
    fixPages12();
  }, [textStylesProp]);

  // Get style for a text element
  const getTextStyle = (pageNumber, elementType) => {
    const style = textStyles.find(s => s.page_number === pageNumber && s.element_type === elementType);
    return style || {
      font_family: 'JetBrains Mono',
      font_size: 16,
      font_weight: 'normal',
      font_style: 'normal',
      color: '#ff00ff',
      position_x: null,
      position_y: null
    };
  };

  const getDefaultPages = () => [
    {
      title: "[!] CAN'T LOAD FROM dataBase [!]",
      content: `[!] CAN'T LOAD FROM dataBase [!]\n[!] CAN'T LOAD FROM dataBase [!]`
    },
    {
      title: "[!] CAN'T LOAD FROM dataBase [!]",
      content: `[!] CAN'T LOAD FROM dataBase [!]\n[!] CAN'T LOAD FROM dataBase [!]`
    },
    {
      title: "[!] CAN'T LOAD FROM dataBase [!]",
      content: `[!] CAN'T LOAD FROM dataBase [!]\n[!] CAN'T LOAD FROM dataBase [!]`
    },
    {
      title: "[!] CAN'T LOAD FROM dataBase [!]",
      content: `[!] CAN'T LOAD FROM dataBase [!]\n[!] CAN'T LOAD FROM dataBase [!]`
    },
    {
      title: "[!] CAN'T LOAD FROM dataBase [!]",
      content: `[!] CAN'T LOAD FROM dataBase [!]\n[!] CAN'T LOAD FROM dataBase [!]`
    }
  ];

  // Calculate number of slides (pairs of pages)
  // With 5 pages: slides are (0-1), (2-3), (4) = 3 slides
  const totalSlides = Math.ceil(totalPages / 2);
  
  const nextPage = () => {
    // currentPage represents the slide index (0, 1, 2 for 5 pages)
    const currentSlide = Math.floor(currentPage / 2);
    if (currentSlide < totalSlides - 1) {
      // Move to next slide (next pair of pages)
      const nextSlide = currentSlide + 1;
      setCurrentPage(nextSlide * 2);
    } else {
      // Last slide, show application
      setShowApplication(true);
    }
  };

  const prevPage = () => {
    const currentSlide = Math.floor(currentPage / 2);
    if (currentSlide > 0) {
      // Move to previous slide
      const prevSlide = currentSlide - 1;
      setCurrentPage(prevSlide * 2);
      setShowApplication(false);
    }
  };


  if (showApplication) {
    return <ApplicationForm onBack={() => setShowApplication(false)} />;
  }

  // If in design mode and NOT called from DesignMode (no props provided), render DesignMode
  // If called from DesignMode (props provided), skip this check to avoid recursion
  if (showDesignMode && user?.role === 'admin' && !pagesProp && !bannersProp) {
    return (
      <DesignMode 
        onExit={() => setShowDesignMode(false)}
        pages={pages}
        banners={banners}
        textStyles={textStyles}
        siteTexts={siteTexts}
      />
    );
  }

  return (
    <div className="book-container" style={isDesignMode ? { overflow: 'visible' } : {}}>
      <div className="book-header">
        <div className="terminal-header">
          <div className="terminal-buttons">
          </div>
          <span className="terminal-title">{siteTexts.terminal_title || 'PROJECT_DOCUMENTATION.exe'}</span>
        </div>
        <div className="user-info">
          <span>{siteTexts.user_label || 'USER:'} {user?.username}</span>
          {user?.role === 'admin' && (
            <Link to="/admin" className="admin-link">{siteTexts.admin_panel_link || 'ADMIN PANEL'}</Link>
          )}
          <button onClick={logout} className="logout-btn">{siteTexts.logout_button || 'LOGOUT'}</button>
        </div>
      </div>

      <div className="book-wrapper">
        <div className="book">
          {pages.map((page, index) => {
            const isLeftPage = index % 2 === 0;
            // Calculate which slide this page belongs to
            const pageSlide = Math.floor(index / 2);
            const currentSlide = Math.floor(currentPage / 2);
            const isTurned = pageSlide < currentSlide;
            // Show pages from current slide and all previous slides
            const isVisible = pageSlide <= currentSlide;
            
            return (
              <div
                key={index}
                data-page-index={index}
                data-page-number={index + 1}
                className={`book-page-container ${isLeftPage ? 'left' : 'right'} ${
                  isTurned ? 'turned' : ''
                } ${index === currentPage ? 'current' : ''}`}
                style={{
                  display: isVisible ? 'block' : 'none'
                }}
              >
                <div className="page">
                  <div className="page-content">
                    <div className="page-header">
                      {(() => {
                        const pageNumber = index + 1;
                        const pageNumberStyle = getTextStyle(pageNumber, 'page-number');
                        const titleStyle = getTextStyle(pageNumber, 'title');
                        const isSelected = activeSelectedTextElement && activeSelectedTextElement.pageNumber === pageNumber;
                        return (
                          <>
                            <div 
                              className="page-number"
                              data-text-element="page-number"
                              data-page-number={pageNumber}
                              onClick={(e) => {
                                if (editOriginalTextsMode && activeOnTextElementClick) {
                                  e.stopPropagation();
                                  activeOnTextElementClick(pageNumber, 'page-number', e);
                                }
                              }}
                              onMouseDown={(e) => {
                                if (editOriginalTextsMode && activeOnTextElementMouseDown) {
                                  // Don't stop propagation for right click - let context menu work
                                  if (e.button !== 2) {
                                    e.stopPropagation();
                                  }
                                  activeOnTextElementMouseDown(pageNumber, 'page-number', e);
                                }
                              }}
                              onContextMenu={(e) => {
                                if (editOriginalTextsMode && activeOnTextElementContextMenu) {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  activeOnTextElementContextMenu(pageNumber, 'page-number', e);
                                }
                              }}
                              style={{
                                fontFamily: pageNumberStyle.font_family,
                                fontSize: `${pageNumberStyle.font_size}px`,
                                fontWeight: pageNumberStyle.font_weight,
                                fontStyle: pageNumberStyle.font_style,
                                color: pageNumberStyle.color,
                                position: (editOriginalTextsMode && isDraggingTextElement && activeSelectedTextElement?.pageNumber === pageNumber && activeSelectedTextElement?.elementType === 'page-number') ? 'fixed' : 'relative', // Always use relative for page-number to prevent disappearing
                                left: (editOriginalTextsMode && isDraggingTextElement && activeSelectedTextElement?.pageNumber === pageNumber && activeSelectedTextElement?.elementType === 'page-number') ? `${textElementDragPosition?.x || 0}px` : 'auto',
                                top: (editOriginalTextsMode && isDraggingTextElement && activeSelectedTextElement?.pageNumber === pageNumber && activeSelectedTextElement?.elementType === 'page-number') ? `${textElementDragPosition?.y || 0}px` : 'auto',
                                zIndex: (editOriginalTextsMode && isDraggingTextElement && activeSelectedTextElement?.pageNumber === pageNumber && activeSelectedTextElement?.elementType === 'page-number') ? 10006 : 'auto',
                                cursor: editOriginalTextsMode ? 'move' : 'default',
                                userSelect: editOriginalTextsMode ? 'none' : 'auto'
                              }}
                            >
                              {editOriginalTextsMode && (
                                <div className={`text-selection-box ${isSelected && activeSelectedTextElement?.elementType === 'page-number' ? 'selected' : ''}`}></div>
                              )}
                              {String(index + 1).padStart(2, '0')}/{String(totalPages).padStart(2, '0')}
                            </div>
                            <div 
                              className="page-title"
                              data-text-element="title"
                              data-page-number={pageNumber}
                              onClick={(e) => {
                                if (editOriginalTextsMode && activeOnTextElementClick) {
                                  e.stopPropagation();
                                  activeOnTextElementClick(pageNumber, 'title', e);
                                }
                              }}
                              onMouseDown={(e) => {
                                if (editOriginalTextsMode && activeOnTextElementMouseDown) {
                                  // Don't stop propagation for right click - let context menu work
                                  if (e.button !== 2) {
                                    e.stopPropagation();
                                  }
                                  activeOnTextElementMouseDown(pageNumber, 'title', e);
                                }
                              }}
                              onContextMenu={(e) => {
                                if (editOriginalTextsMode && activeOnTextElementContextMenu) {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  activeOnTextElementContextMenu(pageNumber, 'title', e);
                                }
                              }}
                              style={{
                                fontFamily: titleStyle.font_family,
                                fontSize: `${titleStyle.font_size}px`,
                                fontWeight: titleStyle.font_weight,
                                fontStyle: titleStyle.font_style,
                                color: titleStyle.color,
                                position: (editOriginalTextsMode && isDraggingTextElement && activeSelectedTextElement?.pageNumber === pageNumber && activeSelectedTextElement?.elementType === 'title') ? 'fixed' : 'relative', // Always use relative for title to prevent disappearing
                                left: (editOriginalTextsMode && isDraggingTextElement && activeSelectedTextElement?.pageNumber === pageNumber && activeSelectedTextElement?.elementType === 'title') ? `${textElementDragPosition?.x || 0}px` : 'auto',
                                top: (editOriginalTextsMode && isDraggingTextElement && activeSelectedTextElement?.pageNumber === pageNumber && activeSelectedTextElement?.elementType === 'title') ? `${textElementDragPosition?.y || 0}px` : 'auto',
                                zIndex: (editOriginalTextsMode && isDraggingTextElement && activeSelectedTextElement?.pageNumber === pageNumber && activeSelectedTextElement?.elementType === 'title') ? 10006 : 'auto',
                                cursor: editOriginalTextsMode ? 'move' : 'default',
                                userSelect: editOriginalTextsMode ? 'none' : 'auto'
                              }}
                            >
                              {editOriginalTextsMode && (
                                <div className={`text-selection-box ${isSelected && activeSelectedTextElement?.elementType === 'title' ? 'selected' : ''}`}></div>
                              )}
                              {page.title}
                            </div>
                          </>
                        );
                      })()}
                    </div>
                    <div className="page-body" style={{ position: 'relative', overflow: 'visible' }}>
                      {(() => {
                        const pageNumber = index + 1;
                        const contentStyle = getTextStyle(pageNumber, 'content');
                        const isSelected = activeSelectedTextElement && activeSelectedTextElement.pageNumber === pageNumber;
                        
                        // Get page-specific elements
                        const pageElements = banners.filter(banner => banner.page_number === pageNumber && banner.is_active);
                        
                        // Determine if this is a left page (for z-index calculation)
                        const isPageLeft = index % 2 === 0;
                        
                        return (
                          <>
                            <pre 
                              className="terminal-text"
                              data-text-element="content"
                              data-page-number={pageNumber}
                              onClick={(e) => {
                                if (editOriginalTextsMode && activeOnTextElementClick) {
                                  e.stopPropagation();
                                  activeOnTextElementClick(pageNumber, 'content', e);
                                }
                              }}
                        onMouseDown={(e) => {
                          if (editOriginalTextsMode && activeOnTextElementMouseDown) {
                            // Don't stop propagation for right click - let context menu work
                            if (e.button !== 2) {
                              e.stopPropagation();
                            }
                            activeOnTextElementMouseDown(pageNumber, 'content', e);
                          }
                        }}
                              onContextMenu={(e) => {
                                if (editOriginalTextsMode && activeOnTextElementContextMenu) {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  activeOnTextElementContextMenu(pageNumber, 'content', e);
                                }
                              }}
                              style={{
                                fontFamily: contentStyle.font_family,
                                fontSize: `${contentStyle.font_size}px`,
                                fontWeight: contentStyle.font_weight,
                                fontStyle: contentStyle.font_style,
                                color: contentStyle.color,
                                position: (editOriginalTextsMode && isDraggingTextElement && activeSelectedTextElement?.pageNumber === pageNumber && activeSelectedTextElement?.elementType === 'content') ? 'fixed' : (contentStyle.position_x !== null && contentStyle.position_y !== null ? 'absolute' : 'relative'),
                                left: (editOriginalTextsMode && isDraggingTextElement && activeSelectedTextElement?.pageNumber === pageNumber && activeSelectedTextElement?.elementType === 'content') ? `${textElementDragPosition?.x || 0}px` : (contentStyle.position_x !== null && contentStyle.position_y !== null ? `${contentStyle.position_x}px` : 'auto'),
                                top: (editOriginalTextsMode && isDraggingTextElement && activeSelectedTextElement?.pageNumber === pageNumber && activeSelectedTextElement?.elementType === 'content') ? `${textElementDragPosition?.y || 0}px` : (contentStyle.position_x !== null && contentStyle.position_y !== null ? `${contentStyle.position_y}px` : 'auto'),
                                zIndex: (editOriginalTextsMode && isDraggingTextElement && activeSelectedTextElement?.pageNumber === pageNumber && activeSelectedTextElement?.elementType === 'content') ? 10006 : (contentStyle.position_x !== null && contentStyle.position_y !== null ? 10 : 'auto'),
                                cursor: editOriginalTextsMode ? 'move' : 'default',
                                userSelect: editOriginalTextsMode ? 'none' : 'auto'
                              }}
                            >
                              {editOriginalTextsMode && (
                                <div className={`text-selection-box ${isSelected && activeSelectedTextElement?.elementType === 'content' ? 'selected' : ''}`}></div>
                              )}
                              {/* Page content is now displayed in the textarea element below - no duplicate rendering */}
                            </pre>
                            
                            {/* Render page-specific elements (all textareas including locked ones, but locked non-textarea elements are in DesignMode overlay) */}
                            {pageElements.filter(banner => {
                              // Always show textareas (including locked ones) in BookMenu as they are part of page content
                              if (banner.type === 'textarea') return true;
                              // For other elements, only show unlocked ones (locked ones are in DesignMode overlay)
                              return !banner.is_locked;
                            }).map(banner => {
                              if (banner.type === 'textarea') {
                                // Use absolute positioning for all textareas (they scroll with content)
                                const positionType = 'absolute';
                                
                                // Calculate page dimensions for textareas
                                // Book: 90% width, max 900px, so each page is 50% = 450px max
                                // Book height: 650px
                                // Page padding: 40px all around = 80px total
                                // Header height: ~60px (with border and padding)
                                // Footer height: ~60px (with border and padding)
                                // Available content space: width = 450 - 80 = 370px, height = 650 - 80 - 60 - 60 = 450px
                                // Use box-sizing: border-box so padding and border are included in width
                                // Reduce width slightly to 360px to prevent overflow on the right side
                                const pageWidth = 325; // Slightly less than 370px to prevent overflow
                                const pageHeight = 395; // 650px page height - 80px padding - 120px header/footer
                                
                                // Check if this textarea should be editable in "edit pages" mode
                                const isEditableInPagesMode = editItemsMode && selectedTextElement && 
                                  selectedTextElement.pageNumber === pageNumber && 
                                  selectedTextElement.elementType === 'textarea' &&
                                  selectedTextElement.bannerId === banner.id;
                                
                                return (
                                  <textarea
                                    key={banner.id}
                                    className="page-textarea"
                                    data-text-element="textarea"
                                    data-page-number={pageNumber}
                                    data-banner-id={banner.id}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      // Textareas can only be edited in "edit pages" mode, not in "select" mode
                                      if (editTextareasMode && user?.role === 'admin') {
                                        activeOnTextElementClick && activeOnTextElementClick(pageNumber, 'textarea', banner.id);
                                      }
                                    }}
                                    onContextMenu={(e) => {
                                      // Textareas can only be edited in "edit pages" mode, not in "select" mode
                                      if (editTextareasMode && user?.role === 'admin') {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        activeOnTextElementContextMenu && activeOnTextElementContextMenu(e, {
                                          pageNumber,
                                          elementType: 'textarea',
                                          bannerId: banner.id
                                        });
                                      }
                                    }}
                                    style={{
                                      position: positionType,
                                      // Center textarea in the center of the page if position is not set (null or 0)
                                      // Page: 450px wide, 650px tall
                                      // page-content: 40px padding all around
                                      // textarea: 370px wide, 450px tall
                                      // For absolute positioning (relative to page-body): use 50% and transform to center
                                      // But account for textarea's own width to prevent overflow
                                      left: (banner.position_x === null || banner.position_x === undefined || banner.position_x === 0 || (banner.is_locked && banner.position_x === 20)) 
                                        ? (positionType === 'absolute' ? '50%' : 'calc(50vw - 185px)') 
                                        : `${(banner.position_x || 0) - 40}px`, // Convert from page coordinates to page-body coordinates
                                      top: (banner.position_y === null || banner.position_y === undefined || banner.position_y === 0 || (banner.is_locked && banner.position_y === 20))
                                        ? (positionType === 'absolute' ? '50%' : 'calc(50vh - 225px)')
                                        : `${(banner.position_y || 0) - 40}px`, // Convert from page coordinates to page-body coordinates
                                      width: `${pageWidth}px`,
                                      height: `${pageHeight}px`,
                                      transform: ((banner.position_x === null || banner.position_x === undefined || banner.position_x === 0 || (banner.is_locked && banner.position_x === 20)) && (banner.position_y === null || banner.position_y === undefined || banner.position_y === 0 || (banner.is_locked && banner.position_y === 20)) && positionType === 'absolute')
                                        ? `translate(-50%, -50%) rotate(${banner.rotation || 0}deg)`
                                        : `rotate(${banner.rotation || 0}deg)`,
                                      transformOrigin: 'center center',
                                      boxSizing: 'border-box', // Include padding and border in width/height to prevent overflow
                                      fontFamily: banner.font_family || 'JetBrains Mono',
                                      fontSize: `${banner.font_size || 16}px`,
                                      fontWeight: banner.font_weight || 'normal',
                                      fontStyle: banner.font_style || 'normal',
                                      color: banner.color || '#ff00ff',
                                      backgroundColor: 'rgba(0, 0, 0, 0.5)',
                                      border: isEditableInPagesMode ? '2px dashed #ff00ff' : '1px solid #ff00ff',
                                      padding: '10px',
                                      resize: (banner.is_locked || user?.role !== 'admin') ? 'none' : 'both', // Disable resize if locked or not admin
                                      zIndex: banner.is_locked 
                                        ? ((banner.z_index || 1) + 10000) 
                                        : ((banner.z_index || 1) + (isPageLeft ? 0 : 100)), // Right page elements have higher z-index
                                      pointerEvents: (isDesignMode && currentSelectedTool === 'select' && !editTextareasMode) ? 'none' : 'auto', // Disable clicks in select mode
                                      cursor: (banner.is_locked || user?.role !== 'admin' || (isDesignMode && currentSelectedTool === 'select' && !editTextareasMode)) ? 'default' : 'text',
                                      whiteSpace: 'pre-wrap',
                                      wordWrap: 'break-word',
                                      display: 'block', // Ensure textarea is visible
                                      visibility: 'visible', // Ensure textarea is visible
                                      ...getVisualEffectsStyles(banner)
                                    }}
                                    value={banner.text_content || ''}
                                    readOnly={!isDesignMode || banner.is_locked || user?.role !== 'admin' || !editTextareasMode || (isDesignMode && currentSelectedTool !== 'pages')}
                                    onChange={async (e) => {
                                      // Double check: only admins can modify and only in edit pages mode
                                      if (user?.role !== 'admin' || !editTextareasMode || (isDesignMode && currentSelectedTool !== 'pages')) {
                                        e.preventDefault();
                                        return;
                                      }
                                      if (!banner.is_locked && user?.role === 'admin' && editTextareasMode && (!isDesignMode || currentSelectedTool === 'pages')) {
                                        // Update text content in database with debounce
                                        const newValue = e.target.value;
                                        // Update local state immediately for better UX
                                        setBanners(prevBanners => 
                                          prevBanners.map(b => 
                                            b.id === banner.id ? { ...b, text_content: newValue } : b
                                          )
                                        );
                                        
                                        // Clear existing timer
                                        if (window.__textareaDebounceTimers) {
                                          if (window.__textareaDebounceTimers[banner.id]) {
                                            clearTimeout(window.__textareaDebounceTimers[banner.id]);
                                          }
                                        } else {
                                          window.__textareaDebounceTimers = {};
                                        }
                                        
                                        // Set new timer to save after user stops typing
                                        window.__textareaDebounceTimers[banner.id] = setTimeout(async () => {
                                          // Triple check: verify user is still admin before saving
                                          if (user?.role !== 'admin') {
                                            console.warn('Unauthorized: User is not admin, reverting changes');
                                            // Revert immediately
                                            setBanners(prevBanners => 
                                              prevBanners.map(b => 
                                                b.id === banner.id ? { ...b, text_content: banner.text_content } : b
                                              )
                                            );
                                            return;
                                          }
                                          
                                          try {
                                            const token = localStorage.getItem('token');
                                            if (!token) {
                                              throw new Error('No authentication token');
                                            }
                                            
                                            const response = await axios.put(`/api/admin/banners/${banner.id}`, {
                                              text_content: newValue
                                            }, {
                                              headers: {
                                                'Authorization': `Bearer ${token}`,
                                                'Content-Type': 'application/json'
                                              }
                                            });
                                            
                                            console.log('Textarea content saved successfully');
                                            
                                            // Reload banners to ensure consistency
                                            if (window.__bookMenuReload) {
                                              window.__bookMenuReload();
                                            }
                                          } catch (error) {
                                            console.error('Error updating textarea content:', error);
                                            // If 403 Forbidden, user is not admin - revert changes
                                            if (error.response?.status === 403) {
                                              alert('Access denied: Admin privileges required');
                                            }
                                            // Revert on error
                                            setBanners(prevBanners => 
                                              prevBanners.map(b => 
                                                b.id === banner.id ? { ...b, text_content: banner.text_content } : b
                                              )
                                            );
                                          }
                                        }, 1000); // Wait 1 second after user stops typing
                                      }
                                    }}
                                  />
                                );
                              } else if (banner.type === 'text') {
                                // Get design mode handlers for dragging
                                const designModeState = window.__designModeState;
                                const activeHandleElementClick = designModeState?.handleElementClick;
                                const activeHandleMouseDown = designModeState?.handleMouseDown;
                                const activeHandleElementContextMenu = designModeState?.handleElementContextMenu;
                                const isElementSelected = designModeState?.selectedElement === banner.id;
                                const isElementDragging = designModeState?.isDragging && designModeState?.selectedElement === banner.id;
                                const currentSelectedTool = designModeState?.selectedTool || 'select';
                                // Allow editing with both 'pages' tool and 'select' tool
                                const canEdit = isDesignMode && user?.role === 'admin' && (currentSelectedTool === 'select' || currentSelectedTool === 'pages');
                                
                                // Get current element from elements array to get updated position during drag
                                const currentElement = designModeState?.elements?.find(el => el.id === banner.id) || banner;
                                
                                // Calculate clip path to hide text if it goes outside page boundaries (450x650)
                                // Items non-système must disappear behind all 4 borders (top, bottom, left, right) of their page
                                const pageWidth = 450; // Full page width (50% of max 900px book)
                                const pageHeight = 650; // Full page height
                                
                                // Get element position relative to full page (.page)
                                const elementLeftInPage = isElementDragging ? (currentElement.position_x || 0) : (banner.position_x || 0);
                                const elementTopInPage = isElementDragging ? (currentElement.position_y || 0) : (banner.position_y || 0);
                                
                                // Use a clipping container that covers the entire page
                                // This allows text to display fully if it's inside the page, and clip only what goes outside
                                // page-body is inside page-content (40px padding) and after page-header
                                // Header has: padding-bottom 20px + margin-bottom 30px + border 2px ≈ 52px + content height
                                // Estimate header height ≈ 60px total
                                // So we need to go up: 40px (page-content padding) + ~60px (header) = ~100px
                                // But let's use a more precise calculation: page-content padding (40px) + header space
                                return (
                                  <div
                                    key={banner.id}
                                    style={{
                                      position: banner.is_locked ? 'fixed' : 'absolute',
                                      // Position container at page origin (0,0 relative to page)
                                      // page-body is after page-header, so we need to go up by padding (40px) + header height
                                      left: '-41px', // Convert page origin to page-body coordinates (compensate page-content padding + 1px à gauche)
                                      top: '-110px', // Go up by padding (40px) + header height (~70px) to reach page top (remonté encore un peu)
                                      width: `${pageWidth}px`, // Full page width
                                      height: `${pageHeight}px`, // Full page height
                                      overflow: 'hidden', // Clip content at page boundaries
                                      zIndex: banner.is_locked 
                                        ? ((banner.z_index || 1) + 10000) 
                                        : ((banner.z_index || 1) + (isPageLeft ? 0 : 100)),
                                      pointerEvents: 'none' // Container doesn't receive events
                                    }}
                                  >
                                    <div
                                      className="page-text-element"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        // Get design mode state to check if drag just finished
                                        const designModeState = window.__designModeState;
                                        const blockClick = designModeState?.getBlockClick?.();
                                        const justFinishedDragging = designModeState?.getJustFinishedDragging?.();
                                        const draggedElementId = designModeState?.getDraggedElementId?.();
                                        const hasMoved = designModeState?.getHasMoved?.();
                                        
                                        // BLOCK ALL CLICKS if we're blocking clicks (after a drag)
                                        if (blockClick) {
                                          e.preventDefault();
                                          e.stopPropagation();
                                          return;
                                        }
                                        
                                        // Prevent click if we just finished dragging
                                        if (justFinishedDragging || draggedElementId === banner.id || hasMoved) {
                                          e.preventDefault();
                                          e.stopPropagation();
                                          return;
                                        }
                                        
                                        if (canEdit && activeHandleElementClick) {
                                          activeHandleElementClick(e, banner);
                                        }
                                      }}
                                      onMouseDown={(e) => {
                                        if (canEdit && activeHandleMouseDown && !banner.is_locked) {
                                          activeHandleMouseDown(e, banner);
                                        }
                                      }}
                                      onContextMenu={(e) => {
                                        if (canEdit && activeHandleElementContextMenu) {
                                          e.preventDefault();
                                          e.stopPropagation();
                                          activeHandleElementContextMenu(e, banner);
                                        }
                                      }}
                                      style={{
                                        position: 'absolute',
                                        // Position text at its actual position relative to page (0,0)
                                        // The container is at -100px top, so text position is correct as-is
                                        left: `${elementLeftInPage}px`,
                                        top: `${elementTopInPage}px`,
                                        transformOrigin: 'center center',
                                        fontFamily: banner.font_family || 'JetBrains Mono',
                                        fontSize: `${banner.font_size || 16}px`,
                                        fontWeight: banner.font_weight || 'normal',
                                        fontStyle: banner.font_style || 'normal',
                                        color: banner.color || '#ff00ff',
                                        width: banner.width ? `${banner.width}px` : 'auto',
                                        height: banner.height ? `${banner.height}px` : 'auto',
                                        cursor: (isDesignMode && user?.role === 'admin' && !banner.is_locked) ? 'move' : 'default',
                                        pointerEvents: 'auto', // Text element receives events
                                        ...getVisualEffectsStyles(banner)
                                      }}
                                    >
                                      <div style={{
                                        transform: `rotate(${banner.rotation || 0}deg)`,
                                        transformOrigin: 'center center',
                                        width: '100%',
                                        height: '100%'
                                      }}>
                                        {isElementSelected && isDesignMode && (
                                          <div style={{
                                            position: 'absolute',
                                            top: '-2px',
                                            left: '-2px',
                                            right: '-2px',
                                            bottom: '-2px',
                                            border: '2px dashed #ff00ff',
                                            pointerEvents: 'none',
                                            zIndex: 10000
                                          }}></div>
                                        )}
                                        {banner.text_content || ''}
                                      </div>
                                    </div>
                                  </div>
                                );
                              } else if (banner.type === 'image' || banner.type === 'gif') {
                                // Get design mode handlers for dragging
                                const designModeState = window.__designModeState;
                                const activeHandleElementClick = designModeState?.handleElementClick;
                                const activeHandleMouseDown = designModeState?.handleMouseDown;
                                const activeHandleElementContextMenu = designModeState?.handleElementContextMenu;
                                const isElementSelected = designModeState?.selectedElement === banner.id;
                                const isElementDragging = designModeState?.isDragging && designModeState?.selectedElement === banner.id;
                                const currentSelectedTool = designModeState?.selectedTool || 'select';
                                // Allow editing with both 'pages' tool and 'select' tool
                                const canEdit = isDesignMode && user?.role === 'admin' && (currentSelectedTool === 'select' || currentSelectedTool === 'pages');
                                
                                // Get current element from elements array to get updated position during drag
                                const currentElement = designModeState?.elements?.find(el => el.id === banner.id) || banner;
                                
                                // Calculate clip path to hide image if it goes outside page boundaries (450x650)
                                // Items non-système must disappear behind all 4 borders (top, bottom, left, right) of their page
                                const pageWidth = 450; // Full page width (50% of max 900px book)
                                const pageHeight = 650; // Full page height
                                
                                // Get element position relative to full page (.page)
                                const elementLeftInPage = isElementDragging ? (currentElement.position_x || 0) : (banner.position_x || 0);
                                const elementTopInPage = isElementDragging ? (currentElement.position_y || 0) : (banner.position_y || 0);
                                
                                // Use the same clipping container approach as text elements for consistency
                                return (
                                  <div
                                    key={banner.id}
                                    style={{
                                      position: banner.is_locked ? 'fixed' : 'absolute',
                                      // Position container at page origin (0,0 relative to page)
                                      // Same positioning as text elements for consistency
                                      left: '-41px', // Convert page origin to page-body coordinates (compensate page-content padding + 1px à gauche)
                                      top: '-110px', // Go up by padding (40px) + header height (~70px) to reach page top (remonté encore un peu)
                                      width: `${pageWidth}px`, // Full page width
                                      height: `${pageHeight}px`, // Full page height
                                      overflow: 'hidden', // Clip content at page boundaries
                                      zIndex: banner.is_locked 
                                        ? ((banner.z_index || 1) + 10000) 
                                        : ((banner.z_index || 1) + (isPageLeft ? 0 : 100)),
                                      pointerEvents: 'none' // Container doesn't receive events
                                    }}
                                  >
                                    <div
                                      style={{
                                        position: 'absolute',
                                        // Position image at its actual position relative to page (0,0)
                                        left: `${elementLeftInPage}px`,
                                        top: `${elementTopInPage}px`,
                                        width: `${banner.width || 200}px`,
                                        height: `${banner.height || 200}px`,
                                        transformOrigin: 'center center',
                                        zIndex: banner.is_locked 
                                          ? ((banner.z_index || 1) + 10000) 
                                          : ((banner.z_index || 1) + (isPageLeft ? 0 : 100)),
                                        cursor: (canEdit && !banner.is_locked) ? 'move' : 'default',
                                        pointerEvents: 'auto', // Image element receives events
                                        ...getVisualEffectsStyles(banner)
                                      }}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      // Get design mode state to check if drag just finished
                                      const designModeState = window.__designModeState;
                                      const blockClick = designModeState?.getBlockClick?.();
                                      const justFinishedDragging = designModeState?.getJustFinishedDragging?.();
                                      const draggedElementId = designModeState?.getDraggedElementId?.();
                                      const hasMoved = designModeState?.getHasMoved?.();
                                      
                                      // BLOCK ALL CLICKS if we're blocking clicks (after a drag)
                                      if (blockClick) {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        return;
                                      }
                                      
                                      // Prevent click if we just finished dragging
                                      if (justFinishedDragging || draggedElementId === banner.id || hasMoved) {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        return;
                                      }
                                      
                                      if (canEdit && activeHandleElementClick) {
                                        activeHandleElementClick(e, banner);
                                      }
                                    }}
                                    onMouseDown={(e) => {
                                      if (canEdit && activeHandleMouseDown && !banner.is_locked) {
                                        activeHandleMouseDown(e, banner);
                                      }
                                    }}
                                    onContextMenu={(e) => {
                                      if (canEdit && activeHandleElementContextMenu) {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        activeHandleElementContextMenu(e, banner);
                                      }
                                    }}
                                  >
                                    <div style={{
                                      transform: `rotate(${banner.rotation || 0}deg)`,
                                      transformOrigin: 'center center',
                                      width: '100%',
                                      height: '100%'
                                    }}>
                                      {isElementSelected && isDesignMode && (
                                        <div style={{
                                          position: 'absolute',
                                          top: '-2px',
                                          left: '-2px',
                                          right: '-2px',
                                          bottom: '-2px',
                                          border: '2px dashed #ff00ff',
                                          pointerEvents: 'none',
                                          zIndex: 10000
                                        }}></div>
                                      )}
                                      <img
                                        src={buildAssetUrl(banner.url)}
                                        alt="Page element"
                                        style={{
                                          width: '100%',
                                          height: '100%',
                                          objectFit: 'contain',
                                          pointerEvents: 'none'
                                        }}
                                      />
                                    </div>
                                  </div>
                                  </div>
                                );
                              }
                              return null;
                            })}
                          </>
                        );
                      })()}
                    </div>
                    <div className="page-footer">
                      {(() => {
                        const pageNumber = index + 1;
                        const systemInfoStyle = getTextStyle(pageNumber, 'system-info');
                        const isSelected = activeSelectedTextElement && activeSelectedTextElement.pageNumber === pageNumber;
                        return (
                          <div 
                            className="system-info"
                            data-text-element="system-info"
                            data-page-number={pageNumber}
                            onClick={(e) => {
                              if (editOriginalTextsMode && activeOnTextElementClick) {
                                e.stopPropagation();
                                activeOnTextElementClick(pageNumber, 'system-info', e);
                              }
                            }}
                            onMouseDown={(e) => {
                              if (editOriginalTextsMode && activeOnTextElementMouseDown) {
                                // Don't allow dragging of original texts - they are fixed
                                // Just allow selection for editing via context menu
                                if (e.button === 0) {
                                  e.preventDefault();
                                  e.stopPropagation();
                                }
                                // Still call the handler for selection, but it won't allow drag
                                activeOnTextElementMouseDown(pageNumber, 'system-info', e);
                              }
                            }}
                            onContextMenu={(e) => {
                              if (editOriginalTextsMode && activeOnTextElementContextMenu) {
                                e.preventDefault();
                                e.stopPropagation();
                                activeOnTextElementContextMenu(pageNumber, 'system-info', e);
                              }
                            }}
                            style={{
                              fontFamily: systemInfoStyle.font_family,
                              fontSize: `${systemInfoStyle.font_size}px`,
                              fontWeight: systemInfoStyle.font_weight,
                              fontStyle: systemInfoStyle.font_style,
                              color: systemInfoStyle.color,
                              // Force pages 1 and 2 to use relative positioning in footer (same as other pages)
                              position: (editOriginalTextsMode && isDraggingTextElement && activeSelectedTextElement?.pageNumber === pageNumber && activeSelectedTextElement?.elementType === 'system-info') ? 'fixed' : ((pageNumber === 1 || pageNumber === 2) ? 'relative' : (systemInfoStyle.position_x !== null && systemInfoStyle.position_y !== null ? 'absolute' : 'relative')),
                              left: (editOriginalTextsMode && isDraggingTextElement && activeSelectedTextElement?.pageNumber === pageNumber && activeSelectedTextElement?.elementType === 'system-info') ? `${textElementDragPosition?.x || 0}px` : ((pageNumber === 1 || pageNumber === 2) ? 'auto' : (systemInfoStyle.position_x !== null && systemInfoStyle.position_y !== null ? `${systemInfoStyle.position_x}px` : 'auto')),
                              top: (editOriginalTextsMode && isDraggingTextElement && activeSelectedTextElement?.pageNumber === pageNumber && activeSelectedTextElement?.elementType === 'system-info') ? `${textElementDragPosition?.y || 0}px` : ((pageNumber === 1 || pageNumber === 2) ? 'auto' : (systemInfoStyle.position_x !== null && systemInfoStyle.position_y !== null ? `${systemInfoStyle.position_y}px` : 'auto')),
                              zIndex: (editOriginalTextsMode && isDraggingTextElement && activeSelectedTextElement?.pageNumber === pageNumber && activeSelectedTextElement?.elementType === 'system-info') ? 10006 : ((pageNumber === 1 || pageNumber === 2) ? 'auto' : (systemInfoStyle.position_x !== null && systemInfoStyle.position_y !== null ? 10 : 'auto')),
                              cursor: 'default', // Don't show move cursor for fixed original texts
                              userSelect: editOriginalTextsMode ? 'none' : 'auto'
                            }}
                          >
                            {editOriginalTextsMode && (
                              <div className={`text-selection-box ${isSelected && activeSelectedTextElement?.elementType === 'system-info' ? 'selected' : ''}`}></div>
                            )}
                            {'>'} {siteTexts.system_info_prefix || 'SYSTEM: ONLINE | STATUS: ACTIVE | TIME:'} {new Date().toLocaleTimeString()}
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="book-controls">
          <button
            className="nav-button prev"
            onClick={prevPage}
            disabled={currentPage === 0}
          >
            <span className="arrow">←</span>
            <span className="button-text">{siteTexts.prev_button || 'PREV'}</span>
          </button>
          <div className="page-indicator">
            {Array.from({ length: totalSlides }, (_, slideIndex) => (
              <span
                key={slideIndex}
                className={`dot ${Math.floor(currentPage / 2) === slideIndex ? 'active' : ''}`}
                onClick={() => setCurrentPage(slideIndex * 2)}
              ></span>
            ))}
          </div>
          <button
            className="nav-button next"
            onClick={nextPage}
            disabled={Math.floor(currentPage / 2) === totalSlides - 1}
          >
            <span className="button-text">{siteTexts.next_button || 'NEXT'}</span>
            <span className="arrow">→</span>
          </button>
        </div>
      </div>

      <div className="circuit-overlay"></div>
      
      {/* Banners overlay - show GLOBAL elements (page_number IS NULL) and LOCKED page-specific elements if not in design mode */}
      {/* Also check if design mode is active via URL */}
      {/* Unlocked page-specific elements (page_number IS NOT NULL) are rendered inside the book pages */}
      {!isDesignMode && banners && banners.length > 0 && banners
        .filter(banner => {
          // Show global elements (page_number is null)
          if (banner.page_number === null || banner.page_number === undefined) return true;
          // Show locked page-specific elements (except textareas which are always in BookMenu)
          if (banner.is_locked && banner.type !== 'textarea') return true;
          // Don't show unlocked page-specific elements here (they're in BookMenu)
          return false;
        })
        .map((banner) => {
        // Load custom font if available
        const fontStyle = banner.font_family && banner.font_family !== 'JetBrains Mono' 
          ? { fontFamily: `'${banner.font_family}', 'JetBrains Mono', monospace` }
          : { fontFamily: 'JetBrains Mono, monospace' };

        // Use fixed positioning for locked elements (doesn't move with scroll), absolute for others
        const positionType = banner.is_locked ? 'fixed' : 'absolute';
        
        // For locked page-specific elements, calculate position relative to viewport
        let leftPos = banner.position_x || 0;
        let topPos = banner.position_y || 0;
        
        if (banner.is_locked && banner.page_number !== null && banner.page_number !== undefined) {
          // Try to find the page element and calculate its viewport position
          const pageContainer = document.querySelector(`.book-page-container[data-page-index="${banner.page_number - 1}"]`);
          const pageElement = pageContainer ? pageContainer.querySelector('.page') : null;
          if (pageElement) {
            const pageRect = pageElement.getBoundingClientRect();
            // Convert page-relative position to viewport position
            leftPos = pageRect.left + (banner.position_x || 0);
            topPos = pageRect.top + (banner.position_y || 0);
          }
        }

        return (
          <LockedPageElement
            key={banner.id}
            banner={banner}
            positionType={positionType}
            leftPos={leftPos}
            topPos={topPos}
            fontStyle={fontStyle}
          />
        );
      })}
    </div>
  );
};

export default BookMenu;

