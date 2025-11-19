import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';
import BookMenu from './BookMenu';
import './DesignMode.css';
import './BookMenu.css';

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

const DesignMode = ({ onExit, pages: bookPagesProp, banners: bannersProp, textStyles: textStylesProp, siteTexts: siteTextsProp }) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [selectedTool, setSelectedTool] = useState('select');
  const [selectedElement, setSelectedElement] = useState(null);
  const [elements, setElements] = useState([]);
  const [fonts, setFonts] = useState([]);
  const [showFontUpload, setShowFontUpload] = useState(false);
  const [editingText, setEditingText] = useState(null);
  const [bookPages, setBookPages] = useState(bookPagesProp || []);
  const [textStyles, setTextStyles] = useState(textStylesProp || []);
  const [siteTexts, setSiteTexts] = useState(siteTextsProp || {});
  const [selectedTextElement, setSelectedTextElement] = useState(null);
  
  // Create local handler functions for text elements
  const onTextElementClick = useCallback((pageNumber, elementType, bannerId) => {
    // Just select the element on click (no edit button)
    setSelectedTextElement({ pageNumber, elementType, bannerId });
    // Only change tool to 'pages' if not already 'select'
    if (selectedTool !== 'select') {
    setSelectedTool('pages');
    }
  }, [selectedTool]);

  const onTextElementMouseDown = useCallback((pageNumber, elementType, event) => {
    // Don't start drag on right click (button 2) - let context menu handle it
    if (event.button === 2) {
      return;
    }
    
    // Don't start drag if clicking on the context menu
    if (event.target.closest('.text-context-menu')) {
      return;
    }
    
    // Don't allow dragging of original book/site texts (system-info, page-number)
    // These are fixed elements that should not be moved
    const originalTextTypes = ['system-info', 'page-number'];
    if (originalTextTypes.includes(elementType)) {
      // Just select for editing, but don't allow drag
      setSelectedTextElement({ pageNumber, elementType });
      if (selectedTool !== 'select') {
        setSelectedTool('pages');
      }
      return;
    }
    
    // Update ref IMMEDIATELY before anything else to prevent context menu
    isDraggingTextElementRef.current = true;
    
    // Don't prevent default - let context menu work on right click
    // Only prevent if it's a left click to avoid browser context menu on long press
    if (event.button === 0) {
      event.preventDefault();
      event.stopPropagation();
      if (event.stopImmediatePropagation && typeof event.stopImmediatePropagation === 'function') {
        event.stopImmediatePropagation();
      }
    }
    
    // Select and start dragging immediately
    setSelectedTextElement({ pageNumber, elementType });
    // Only change tool to 'pages' if not already 'select' - allow dragging with 'select' tool
    if (selectedTool !== 'select') {
    setSelectedTool('pages');
    }
    setIsDraggingTextElement(true);
    
    // Get current position from the element's bounding rect (viewport coordinates)
    const rect = event.target.getBoundingClientRect();
    const currentX = rect.left;
    const currentY = rect.top;
    
    // Calculate offset for dragging (mouse position relative to element top-left)
    const offset = {
      x: event.clientX - currentX,
      y: event.clientY - currentY
    };
    setTextElementDragOffset(offset);
    textElementDragOffsetRef.current = offset;
    
    // Set initial drag position to current viewport position
    setTextElementDragPosition({
      x: currentX,
      y: currentY
    });
  }, []);

  const onTextElementContextMenu = useCallback((pageNumber, elementType, event) => {
    // Show context menu on right click
    event.preventDefault();
    event.stopPropagation();
    console.log('Context menu triggered for:', pageNumber, elementType);
    setContextMenuElement({ pageNumber, elementType });
    setContextMenuPosition({ x: event.clientX, y: event.clientY });
    setShowContextMenu(true);
    console.log('showContextMenu set to true');
  }, []);
  const containerRef = useRef(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  const [isDraggingTextElement, setIsDraggingTextElement] = useState(false);
  const [textElementDragOffset, setTextElementDragOffset] = useState({ x: 0, y: 0 });
  const [textElementDragPosition, setTextElementDragPosition] = useState({ x: 0, y: 0 });
  const textElementDragOffsetRef = useRef({ x: 0, y: 0 });
  const justFinishedDraggingRef = useRef(false);
  const draggedElementIdRef = useRef(null);
  const mouseDownPositionRef = useRef({ x: 0, y: 0 });
  const hasMovedRef = useRef(false);
  const pageDragOffsetRef = useRef({ x: 0, y: 0 }); // Store page-relative drag offset for page elements
  const blockClickRef = useRef(false); // Block all clicks temporarily after drag
  const rightClickRef = useRef(false); // Track if right click just occurred
  const [showLockedOverlay, setShowLockedOverlay] = useState(false);
  const [lockedOverlayPosition, setLockedOverlayPosition] = useState({ x: 0, y: 0 });
  const [showEditButton, setShowEditButton] = useState(false);
  const [editButtonPosition, setEditButtonPosition] = useState({ x: 0, y: 0 });
  const [showContextMenu, setShowContextMenu] = useState(false);
  const [contextMenuPosition, setContextMenuPosition] = useState({ x: 0, y: 0 });
  const [contextMenuElement, setContextMenuElement] = useState(null);
  
  // Context menu for design elements (banners/images/texts)
  const [showElementContextMenu, setShowElementContextMenu] = useState(false);
  const [elementContextMenuPosition, setElementContextMenuPosition] = useState({ x: 0, y: 0 });
  const [elementContextMenuElement, setElementContextMenuElement] = useState(null);

  const loadElements = async () => {
    try {
      const response = await axios.get('/api/admin/banners');
      setElements(response.data.banners);
    } catch (error) {
      console.error('Error loading elements:', error);
    }
  };

  const loadFonts = async () => {
    try {
      const response = await axios.get('/api/admin/fonts');
      setFonts(response.data.fonts || []);
      // Load fonts into document
      response.data.fonts?.forEach(font => {
        try {
          // Check if font is already loaded
          const existingFont = Array.from(document.fonts).find(f => f.family === font.font_family);
          if (existingFont) {
            console.log('Font already loaded:', font.font_family);
            return;
          }
          
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
        } catch (err) {
          console.error('Error creating FontFace for:', font.font_family, err);
        }
      });
    } catch (error) {
      console.error('Error loading fonts:', error);
    }
  };

  const loadBookPages = async () => {
    try {
      const response = await axios.get('/api/book-pages');
      setBookPages(response.data.pages || []);
    } catch (error) {
      console.error('Error loading book pages:', error);
    }
  };

  const loadTextStyles = useCallback(async () => {
    try {
      const response = await axios.get('/api/page-text-styles');
      setTextStyles(response.data.styles || []);
    } catch (error) {
      console.error('Error loading text styles:', error);
    }
  }, []);

  const loadSiteTexts = async () => {
    // Only load if not provided as prop
    if (siteTextsProp && Object.keys(siteTextsProp).length > 0) {
      return;
    }
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

  // Update state when props change
  useEffect(() => {
    if (bookPagesProp && bookPagesProp.length > 0) {
      setBookPages(bookPagesProp);
    }
  }, [bookPagesProp]);

  useEffect(() => {
    if (textStylesProp && textStylesProp.length > 0) {
      setTextStyles(textStylesProp);
    }
  }, [textStylesProp]);

  useEffect(() => {
    if (siteTextsProp && Object.keys(siteTextsProp).length > 0) {
      setSiteTexts(siteTextsProp);
    }
  }, [siteTextsProp]);

  useEffect(() => {
    loadElements();
    loadFonts();
    // Always load bookPages and textStyles to ensure they're up to date
    loadBookPages();
    loadTextStyles();
    loadSiteTexts();
  }, []);


  // Check URL for element selection
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const elementId = params.get('element');
    const addType = params.get('add');
    
    // Auto-open textarea modal if add=textarea is in URL
    if (addType === 'textarea') {
      setSelectedTool('textarea');
      setShowTextareaModal(true);
      // Remove the parameter from URL
      const newUrl = new URL(window.location.href);
      newUrl.searchParams.delete('add');
      navigate(newUrl.pathname + newUrl.search, { replace: true });
    }
    
    if (elementId) {
      const elementIdNum = parseInt(elementId);
      setSelectedElement(elementIdNum);
      setSelectedTool('select');
      // Scroll to element after a short delay to ensure it's loaded
      setTimeout(() => {
        const element = elements.find(el => el.id === elementIdNum);
        if (element && containerRef.current) {
          // Scroll to element position
          containerRef.current.scrollTo({
            left: element.position_x - 200,
            top: element.position_y - 200,
            behavior: 'smooth'
          });
        }
      }, 500);
    }
  }, [location.search, elements]);

  const handleDuplicateTextStyle = async (sourcePageNumber, sourceElementType) => {
    try {
      // Get the source style
      const sourceStyle = textStyles.find(
        s => s.page_number === sourcePageNumber && s.element_type === sourceElementType
      );

      if (!sourceStyle) {
        alert('Style source introuvable');
        return;
      }

      // Show a modal to select target pages
      const targetPages = [1, 2, 3, 4, 5];
      const selectedPages = window.prompt(
        `Dupliquer le style vers quelles pages ? (séparées par des virgules, ex: 1,2,3)\n` +
        `Type d'élément: ${sourceElementType}\n` +
        `Pages disponibles: ${targetPages.join(', ')}`
      );

      if (!selectedPages) return;

      const pagesToUpdate = selectedPages
        .split(',')
        .map(p => parseInt(p.trim()))
        .filter(p => !isNaN(p) && targetPages.includes(p));

      if (pagesToUpdate.length === 0) {
        alert('Aucune page valide sélectionnée');
        return;
      }

      // Apply the style to all selected pages
      const token = localStorage.getItem('token');
      for (const pageNumber of pagesToUpdate) {
        await axios.put(
          `/api/admin/page-text-styles/${pageNumber}/${sourceElementType}`,
          {
            font_family: sourceStyle.font_family,
            font_size: sourceStyle.font_size,
            font_weight: sourceStyle.font_weight,
            font_style: sourceStyle.font_style,
            color: sourceStyle.color
          },
          {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            }
          }
        );
      }

      await loadTextStyles();
      alert(`Style dupliqué vers ${pagesToUpdate.length} page(s)`);
    } catch (error) {
      console.error('Error duplicating text style:', error);
      alert('Erreur lors de la duplication du style');
    }
  };

  const handleFontUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) {
      return;
    }

    if (!file.name.match(/\.(ttf|otf)$/i)) {
      alert('Please upload a .ttf or .otf font file');
      e.target.value = ''; // Reset input
      return;
    }

    const formData = new FormData();
    formData.append('font', file);
    formData.append('name', file.name.replace(/\.(ttf|otf)$/i, ''));

    try {
      const token = localStorage.getItem('token');
      const response = await axios.post('/api/admin/fonts', formData, {
        headers: { 
          'Content-Type': 'multipart/form-data',
          'Authorization': `Bearer ${token}`
        }
      });
      console.log('Font upload response:', response.data);
      // Reload fonts to include the new one
      await loadFonts();
      setShowFontUpload(false);
      alert(`Font "${response.data.font.name}" uploaded successfully`);
      e.target.value = ''; // Reset input
    } catch (error) {
      console.error('Error uploading font:', error);
      const errorMessage = error.response?.data?.error || error.message || 'Error uploading font';
      alert('Error uploading font: ' + errorMessage);
      e.target.value = ''; // Reset input
    }
  };

  const fileInputRef = useRef(null);
  const fontInputRef = useRef(null);

  const handleAddImage = () => {
    fileInputRef.current?.click();
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('Please select an image file');
      return;
    }

    const formData = new FormData();
    formData.append('image', file);

    try {
      const token = localStorage.getItem('token');
      const response = await axios.post('/api/admin/images', formData, {
        headers: { 
          'Content-Type': 'multipart/form-data',
          'Authorization': `Bearer ${token}`
        }
      });

      // Get dimensions from temporary storage or use defaults
      const dimensions = window.__tempImageDimensions || { width: 200, height: 200 };
      const pageNumberInput = window.__tempImagePageNumber;
      delete window.__tempImageDimensions;
      delete window.__tempImagePageNumber;

      let centerX, centerY;
      
      // If page_number is set, use page-relative coordinates (center of page content area)
      if (pageNumberInput) {
        // Page dimensions: 450px width, 650px height
        // Page content padding: 40px all around
        // Center of page content area
        centerX = 40 + (450 - 80) / 2 - dimensions.width / 2; // 40px padding + center of content area
        centerY = 40 + (650 - 80) / 2 - dimensions.height / 2; // 40px padding + center of content area (accounting for header/footer)
      } else {
        // Get center of visible viewport (accounting for scroll) for global elements
      const scrollX = window.pageXOffset || document.documentElement.scrollLeft || 0;
      const scrollY = window.pageYOffset || document.documentElement.scrollTop || 0;
        centerX = scrollX + window.innerWidth / 2 - dimensions.width / 2;
        centerY = scrollY + window.innerHeight / 2 - dimensions.height / 2;
      }

      // Calculate z_index: if page_number is set, use a lower z-index (5-10) for page elements
      // Otherwise use elements.length + 1 for global elements
      const calculatedZIndex = pageNumberInput ? Math.min(10, Math.max(5, elements.filter(e => e.page_number === parseInt(pageNumberInput)).length + 5)) : elements.length + 1;

      const newElement = {
        type: 'image',
        url: response.data.image.url,
        position_x: centerX,
        position_y: centerY,
        rotation: 0,
        width: dimensions.width,
        height: dimensions.height,
        z_index: calculatedZIndex,
        is_active: true,
        page_number: pageNumberInput ? parseInt(pageNumberInput) : null
      };

      createElement(newElement);
      e.target.value = ''; // Reset input
    } catch (error) {
      console.error('Error uploading image:', error);
      alert('Error uploading image: ' + (error.response?.data?.error || error.message));
    }
  };

  const handleAddText = () => {
    // Get center of canvas for initial position
    const centerX = window.innerWidth / 2 - 100;
    const centerY = window.innerHeight / 2 - 25;
    
    setEditingText({
      text_content: 'NEW TEXT',
      position_x: centerX,
      position_y: centerY,
      rotation: 0,
      width: 200,
      height: 50,
      z_index: elements.length + 1,
      is_active: true,
      font_family: 'JetBrains Mono',
      font_size: 16,
      font_weight: 'normal',
      font_style: 'normal',
      color: '#ff00ff'
    });
  };

  const handleAddTextWithData = (textData) => {
    // Create text element directly with provided data
    createElement({
      type: 'text',
      ...textData
    });
  };

  const createElement = async (element) => {
    // Security check: Only admins can create elements
    if (user?.role !== 'admin') {
      alert('Access denied: Admin privileges required');
      return;
    }
    
    try {
      console.log('Creating element:', element);
      
      // Ensure all numeric values are properly parsed
      // Normalize type to lowercase to match ENUM
      const elementData = {
        type: element.type ? element.type.toLowerCase().trim() : 'image',
        url: element.url || '',
        position_x: parseInt(element.position_x) || 0,
        position_y: parseInt(element.position_y) || 0,
        rotation: parseInt(element.rotation) || 0,
        width: parseInt(element.width) || 200,
        height: parseInt(element.height) || 200,
        z_index: parseInt(element.z_index) || 1,
        is_active: element.is_active !== undefined ? element.is_active : true,
        is_locked: element.is_locked !== undefined ? Boolean(element.is_locked) : false,
        scale: element.scale !== undefined ? parseInt(element.scale) : 100
      };

      // Add page_number if provided
      if (element.page_number !== undefined) {
        elementData.page_number = element.page_number !== null ? parseInt(element.page_number) : null;
      }
      
      // Only add text-related fields if it's a text or textarea element
      if (elementData.type === 'text' || elementData.type === 'textarea') {
        elementData.text_content = element.text_content || '';
        elementData.font_family = element.font_family || 'JetBrains Mono';
        elementData.font_size = element.font_size ? parseInt(element.font_size) : 16;
        elementData.font_weight = element.font_weight || 'normal';
        elementData.font_style = element.font_style || 'normal';
        elementData.color = element.color || '#ff00ff';
      }

      // Add visual effects fields with default values - always set defaults even if not provided
      elementData.glow_color = (element.glow_color !== undefined && element.glow_color !== null) ? String(element.glow_color) : null;
      elementData.glow_intensity = (element.glow_intensity !== undefined && element.glow_intensity !== null) ? parseInt(element.glow_intensity) || 0 : 0;
      elementData.shadow_color = (element.shadow_color !== undefined && element.shadow_color !== null) ? String(element.shadow_color) : null;
      elementData.shadow_blur = (element.shadow_blur !== undefined && element.shadow_blur !== null) ? parseInt(element.shadow_blur) || 0 : 0;
      elementData.shadow_x = (element.shadow_x !== undefined && element.shadow_x !== null) ? parseInt(element.shadow_x) || 0 : 0;
      elementData.shadow_y = (element.shadow_y !== undefined && element.shadow_y !== null) ? parseInt(element.shadow_y) || 0 : 0;
      elementData.opacity = (element.opacity !== undefined && element.opacity !== null) ? parseFloat(element.opacity) || 1.0 : 1.0;
      elementData.blur = (element.blur !== undefined && element.blur !== null) ? parseInt(element.blur) || 0 : 0;

      console.log('Sending element data:', elementData);

      const token = localStorage.getItem('token');
      const response = await axios.post('/api/admin/banners', elementData, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      console.log('Element created successfully:', response.data);
      // Reload elements to get the latest data
      await loadElements();
      // Also reload banners in BookMenu if it's mounted
      if (window.__bookMenuReload) {
        window.__bookMenuReload();
      }
      // Select the new element and enable dragging immediately
      setSelectedElement(response.data.banner.id);
      setSelectedTool('select'); // Ensure select tool is active
      setEditingText(null);
      // Small delay to ensure element is rendered before selection
      setTimeout(() => {
        setSelectedElement(response.data.banner.id);
      }, 100);
    } catch (error) {
      console.error('Error creating element:', error);
      console.error('Error response:', error.response);
      const errorMsg = error.response?.data?.error || error.message || 'Unknown error';
      alert(`Error creating ${element.type} element: ${errorMsg}`);
      console.error('Element data that failed:', element);
    }
  };

  const handleSaveText = async (textData) => {
    try {
      console.log('Saving text data:', textData);
      const elementToCreate = {
        ...textData,
        type: 'text',
        url: '', // Text elements don't need a URL
        is_active: textData.is_active !== undefined ? textData.is_active : true
      };
      console.log('Element to create:', elementToCreate);
      // createElement already calls loadElements and setEditingText(null)
      await createElement(elementToCreate);
      // Don't call setEditingText(null) here as createElement already does it
    } catch (error) {
      console.error('Error saving text:', error);
      alert('Error saving text: ' + (error.response?.data?.error || error.message));
    }
  };

  const handleElementClick = (e, element) => {
    e.stopPropagation();
    
    // Don't open modal on click - only allow selection for visual feedback
    // The modal will only open via context menu (right click)
    
    // Don't open modal if right click just occurred (prevent left click after right click)
    if (rightClickRef.current) {
      e.preventDefault();
      e.stopPropagation();
      setSelectedElement(null);
      return;
    }
    
    // BLOCK ALL CLICKS if we're blocking clicks (after a drag)
    if (blockClickRef.current) {
      e.preventDefault();
      e.stopPropagation();
      setSelectedElement(null);
      return;
    }
    
    // Don't open modal for locked elements - just select for visual feedback
    if (element.is_locked) {
      setSelectedElement(element.id);
      setSelectedTool('select');
      return;
    }
    // Don't open modal if we're currently dragging
    if (isDragging || isDraggingTextElement || isDraggingRef.current || isDraggingTextElementRef.current) {
      // Deselect element to prevent modal from opening
      setSelectedElement(null);
      return;
    }
    // Don't open modal if this element was just dragged (check draggedElementIdRef)
    if (draggedElementIdRef.current === element.id) {
      // This element was just dragged, don't open modal
      setSelectedElement(null);
      return;
    }
    // Don't open modal if mouse moved significantly (it was a drag, not a click)
    if (hasMovedRef.current) {
      hasMovedRef.current = false;
      setSelectedElement(null);
      return;
    }
    // Don't open modal if we just finished dragging (prevent modal from opening after drag)
    if (justFinishedDraggingRef.current) {
      setSelectedElement(null);
      return;
    }
    // Don't open modal if context menu is open
    if (showElementContextMenu) {
      return;
    }
    // Reset justFinishedDraggingRef when clicking directly on element (not after drag)
    justFinishedDraggingRef.current = false;
    // Select element for visual feedback (border) but don't open modal
    // Modal will only open via context menu (right click)
    setSelectedElement(element.id);
    setSelectedTool('select');
    // Don't open modal - just select for visual feedback
  };

  const handleMouseDown = (e, element) => {
    // Don't start drag on right click
    if (e.button === 2) {
      // Reset drag flags on right click to allow normal interaction
      rightClickRef.current = true;
      setTimeout(() => {
        rightClickRef.current = false;
      }, 300);
      hasMovedRef.current = false;
      draggedElementIdRef.current = null;
      blockClickRef.current = false;
      justFinishedDraggingRef.current = false;
      return;
    }
    
    // If right click just occurred, don't start drag (but allow after timeout)
    if (e.button === 0 && rightClickRef.current) {
      return;
    }
    
    // Store initial mouse position to detect movement (for left click)
    if (e.button === 0) {
      mouseDownPositionRef.current = { x: e.clientX, y: e.clientY };
      hasMovedRef.current = false;
    }
    
    // Don't start drag if element is locked - show LOCKED overlay
    if (element.is_locked) {
      e.preventDefault();
      e.stopPropagation();
      // Show LOCKED overlay
      setShowLockedOverlay(true);
      setLockedOverlayPosition({ x: e.clientX, y: e.clientY });
      // Just select the element, but don't allow dragging
      setSelectedElement(element.id);
      setSelectedTool('select');
      // Hide overlay after mouse up
      const handleMouseUpForLocked = () => {
        setShowLockedOverlay(false);
        window.removeEventListener('mouseup', handleMouseUpForLocked);
      };
      window.addEventListener('mouseup', handleMouseUpForLocked);
      return;
    }
    
    // Close any open context menu and properties modal when starting to drag
    setShowElementContextMenu(false);
    // Note: We keep selectedElement so the modal will close automatically due to !isDragging condition
    
    // Don't set dragging ref immediately - wait for movement threshold
    // Store the element ID being dragged
    draggedElementIdRef.current = element.id;
    
    // Prevent context menu on long press
    e.preventDefault();
    e.stopPropagation();
    // Only call stopImmediatePropagation if it exists
    if (e.stopImmediatePropagation && typeof e.stopImmediatePropagation === 'function') {
      e.stopImmediatePropagation();
    }
    
    // Attach mouse move and mouse up listeners immediately to detect drag start
    // This is necessary because handleMouseMove needs to be called to detect initial movement
    // Use a flag to track if we've attached temporary listeners
    if (!window.__designModeTempListeners) {
      window.__designModeTempListeners = true;
      const tempMouseMove = (moveEvent) => {
        handleMouseMove(moveEvent);
      };
      const tempMouseUp = (upEvent) => {
        handleMouseUp(upEvent);
        // Clean up temporary listeners
        if (window.__designModeTempMouseMove) {
          window.removeEventListener('mousemove', window.__designModeTempMouseMove);
          window.removeEventListener('mouseup', window.__designModeTempMouseUp);
          window.__designModeTempMouseMove = null;
          window.__designModeTempMouseUp = null;
        }
        window.__designModeTempListeners = false;
      };
      
      // Store references so we can remove them later
      window.__designModeTempMouseMove = tempMouseMove;
      window.__designModeTempMouseUp = tempMouseUp;
      
      window.addEventListener('mousemove', tempMouseMove);
      window.addEventListener('mouseup', tempMouseUp);
    }
    
    // DON'T select element yet - wait to see if it's a drag or a click
    // We'll select it only if it's actually a click (no movement)
    // This prevents the modal from opening if it's a drag
    // setSelectedElement(element.id);
    // setSelectedTool('select');
  };

  const handleElementContextMenu = (e, element) => {
    // Don't show context menu if we're dragging (but allow if just finished dragging)
    // Note: contextmenu event is always from right click, so we don't need to check button
    // Check both refs and state to be sure
    if ((isDraggingRef.current || isDraggingTextElementRef.current || isDragging || isDraggingTextElement) && !justFinishedDraggingRef.current) {
      e.preventDefault();
      e.stopPropagation();
      setShowElementContextMenu(false); // Make sure menu is closed
      return;
    }
    
    e.preventDefault();
    e.stopPropagation();
    
    // Mark that a right click just occurred to prevent left click from opening modal
    rightClickRef.current = true;
    setTimeout(() => {
      rightClickRef.current = false;
    }, 300); // Reset after 300ms
    
    // Reset all drag-related flags when opening context menu to allow normal interaction
    justFinishedDraggingRef.current = false;
    hasMovedRef.current = false;
    blockClickRef.current = false;
    draggedElementIdRef.current = null;
    
    // Select the element to show the border (pointillés) but don't open modal
    // The modal won't open because showElementContextMenu is true
    setSelectedElement(element.id);
    setSelectedTool('select');
    
    setElementContextMenuElement(element);
    setElementContextMenuPosition({ x: e.clientX, y: e.clientY });
    setShowElementContextMenu(true);
  };

  // Store design mode state in window for BookMenu to access
  // This must be after handleElementClick, handleMouseDown, handleElementContextMenu are defined
  useEffect(() => {
    window.__designModeState = {
      selectedTool,
      selectedTextElement,
      selectedElement,
      isDraggingTextElement,
      setIsDraggingTextElement,
      textElementDragOffset,
      setTextElementDragOffset,
      textElementDragPosition,
      setTextElementDragPosition,
      showEditButton,
      setShowEditButton,
      editButtonPosition,
      setEditButtonPosition,
      handleElementClick,
      handleMouseDown,
      handleElementContextMenu,
      elements,
      getJustFinishedDragging: () => justFinishedDraggingRef.current,
      getDraggedElementId: () => draggedElementIdRef.current,
      getHasMoved: () => hasMovedRef.current,
      getBlockClick: () => blockClickRef.current,
      onTextElementClick: onTextElementClick,
      onTextElementMouseDown: onTextElementMouseDown,
      onTextElementContextMenu: onTextElementContextMenu
    };
    return () => {
      delete window.__designModeState;
    };
  }, [selectedTool, selectedTextElement, isDraggingTextElement, textElementDragOffset, textElementDragPosition, showEditButton, editButtonPosition, showContextMenu, contextMenuPosition, contextMenuElement, textStyles, selectedElement, isDragging, onTextElementClick, onTextElementMouseDown, onTextElementContextMenu]);

  const handleDuplicateElement = async (element) => {
    // Prevent opening edit menu after duplication
    justFinishedDraggingRef.current = true;
    setTimeout(() => {
      justFinishedDraggingRef.current = false;
    }, 500);
    try {
      const token = localStorage.getItem('token');
      const duplicatedElement = {
        ...element,
        position_x: (element.position_x || 0) + 50,
        position_y: (element.position_y || 0) + 50,
        id: undefined // Let the server generate a new ID
      };
      await createElement(duplicatedElement);
      // Don't close the context menu, keep it open
      alert('Element duplicated successfully');
    } catch (error) {
      console.error('Error duplicating element:', error);
      alert('Error duplicating element');
    }
  };

  const handleMouseMove = useCallback((e) => {
    // Check if mouse has moved enough to consider it a drag (threshold: 5px)
    if (mouseDownPositionRef.current && draggedElementIdRef.current && !hasMovedRef.current) {
      const deltaX = Math.abs(e.clientX - mouseDownPositionRef.current.x);
      const deltaY = Math.abs(e.clientY - mouseDownPositionRef.current.y);
      const threshold = 5;
      
      if (deltaX > threshold || deltaY > threshold) {
        hasMovedRef.current = true;
        // Now start dragging
        const element = elements.find(el => el.id === draggedElementIdRef.current);
        if (element && !element.is_locked) {
          // Clean up temporary listeners - useEffect will attach new ones when isDragging becomes true
          if (window.__designModeTempListeners && window.__designModeTempMouseMove) {
            window.removeEventListener('mousemove', window.__designModeTempMouseMove);
            window.removeEventListener('mouseup', window.__designModeTempMouseUp);
            window.__designModeTempMouseMove = null;
            window.__designModeTempMouseUp = null;
            window.__designModeTempListeners = false;
          }
          
          // Deselect element when drag starts to prevent modal from opening
          setSelectedElement(null);
          isDraggingRef.current = true;
          setIsDragging(true);
          
          // Calculate dragOffset correctly based on element type
          let offsetX, offsetY;
          
          if (element.page_number !== null && element.page_number !== undefined) {
            // For page-specific elements, calculate offset in page-relative coordinates (use full page, not just content)
            const pageContainer = document.querySelector(`.book-page-container[data-page-index="${element.page_number - 1}"]`);
            const pageElement = pageContainer ? pageContainer.querySelector('.page') : null;
            if (pageElement) {
              const pageRect = pageElement.getBoundingClientRect();
              const pageRelativeX = e.clientX - pageRect.left;
              const pageRelativeY = e.clientY - pageRect.top;
              // Store page-relative offset (relative to full page)
              pageDragOffsetRef.current = {
                x: pageRelativeX - (element.position_x || 0),
                y: pageRelativeY - (element.position_y || 0)
              };
              // Also set viewport offset for consistency
              offsetX = e.clientX - (pageRect.left + (element.position_x || 0));
              offsetY = e.clientY - (pageRect.top + (element.position_y || 0));
            } else {
              // Fallback
              offsetX = e.clientX - (element.position_x || 0);
              offsetY = e.clientY - (element.position_y || 0);
              pageDragOffsetRef.current = { x: 0, y: 0 };
            }
          } else {
            // For global elements, position is already in viewport coordinates
            offsetX = e.clientX - (element.position_x || 0);
            offsetY = e.clientY - (element.position_y || 0);
            pageDragOffsetRef.current = { x: 0, y: 0 };
          }
          
          setDragOffset({ x: offsetX, y: offsetY });
        }
      }
    }
    
    // Continue dragging if drag has started (check both state and ref)
    if ((isDragging || isDraggingRef.current) && (selectedElement || draggedElementIdRef.current)) {
      const elementId = selectedElement || draggedElementIdRef.current;
      const element = elements.find(el => el.id === elementId);
      // Don't allow dragging if element is locked
      // Don't move if element is locked
      if (element && element.is_locked) {
        return;
      }
      
      if (element) {
        let newX = e.clientX - dragOffset.x;
        let newY = e.clientY - dragOffset.y;
        
        // If element has page_number, constrain movement to page boundaries (full page, like a real book)
        if (element.page_number !== null && element.page_number !== undefined) {
          // Find the page element in the DOM to get its position (use .page instead of .page-content for full page dimensions)
          const pageContainer = document.querySelector(`.book-page-container[data-page-index="${element.page_number - 1}"]`);
          const pageElement = pageContainer ? pageContainer.querySelector('.page') : null;
          if (pageElement) {
            const pageRect = pageElement.getBoundingClientRect();
            // Convert viewport coordinates to page-relative coordinates (relative to the full page, not just content)
            const pageRelativeX = e.clientX - pageRect.left;
            const pageRelativeY = e.clientY - pageRect.top;
            
            // Calculate new position relative to full page
            const elementWidth = element.width || 200;
            const elementHeight = element.height || 200;
            const pageWidth = pageRect.width; // Full page width (450px)
            const pageHeight = pageRect.height; // Full page height (650px)
            
            // Allow elements to move anywhere on the full page, including behind borders and in header/footer areas
            // This allows them to go in front/behind titles and page numbers like a real book
            const minX = -elementWidth; // Allow to go behind left border
            const maxX = pageWidth; // Can extend to right edge of page
            const minY = -elementHeight; // Allow to go behind top border
            const maxY = pageHeight; // Can extend to bottom edge of page
            
            // Calculate new position based on mouse position relative to full page
            // Use the page-relative drag offset stored when drag started
            newX = pageRelativeX - pageDragOffsetRef.current.x;
            newY = pageRelativeY - pageDragOffsetRef.current.y;
            
            // Apply constraints (allow full page movement)
            newX = Math.max(minX, Math.min(maxX, newX));
            newY = Math.max(minY, Math.min(maxY, newY));
          } else {
            // Fallback: use simple constraints if page element not found
            const pageWidth = 450;
            const pageHeight = 650;
            const elementWidth = element.width || 200;
            const elementHeight = element.height || 200;
            const minX = -elementWidth;
            const maxX = pageWidth;
            const minY = -elementHeight;
            const maxY = pageHeight;
            newX = Math.max(minX, Math.min(maxX, newX));
            newY = Math.max(minY, Math.min(maxY, newY));
          }
        }
        // For global elements (no page_number), allow movement anywhere (no constraints)
        
        // Update position immediately in state for smooth dragging
        setElements(prevElements => 
          prevElements.map(el => 
            el.id === elementId 
              ? { ...el, position_x: Math.round(newX), position_y: Math.round(newY) }
              : el
          )
        );
      }
    }
    
    // Handle text element dragging - update visual position
    if (isDraggingTextElement && selectedTextElement) {
      // Update the visual position of the text element during drag
      // Use ref to get the latest offset value
      const newX = e.clientX - textElementDragOffsetRef.current.x;
      const newY = e.clientY - textElementDragOffsetRef.current.y;
      setTextElementDragPosition({
        x: newX,
        y: newY
      });
    }
  }, [isDragging, selectedElement, elements, dragOffset, isDraggingTextElement, selectedTextElement, draggedElementIdRef]);

  // Save position to DB when drag ends (debounced)
  useEffect(() => {
      // Only save if drag just finished (not during drag)
      if (!isDragging && justFinishedDraggingRef.current && draggedElementIdRef.current) {
        const element = elements.find(el => el.id === draggedElementIdRef.current);
        // Don't save position if element is locked
        if (element && element.is_locked) {
          return;
        }
        if (element && element.position_x !== undefined && element.position_y !== undefined) {
        // Debounce: save to DB after drag ends
        // Use a shorter delay to save quickly, but keep justFinishedDraggingRef longer to prevent modal
        const timer = setTimeout(async () => {
          // Get the latest element state from the current elements array
          const latestElement = elements.find(el => el.id === draggedElementIdRef.current);
          if (latestElement && !latestElement.is_locked) {
            // Update state is already done in handleMouseMove, just save to DB
            try {
              // Save position directly without reloading to avoid resetting it
              const token = localStorage.getItem('token');
              const response = await axios.put(`/api/admin/banners/${draggedElementIdRef.current}`, {
                position_x: latestElement.position_x || 0,
                position_y: latestElement.position_y || 0
              }, {
                headers: {
                  'Authorization': `Bearer ${token}`,
                  'Content-Type': 'application/json'
                }
              });
              console.log('Position saved successfully:', latestElement.position_x, latestElement.position_y);
              // Update local state to ensure it matches the saved position
              setElements(prevElements => 
                prevElements.map(el => 
                  el.id === draggedElementIdRef.current 
                    ? { ...el, position_x: latestElement.position_x, position_y: latestElement.position_y }
                    : el
                )
              );
              // Also reload banners in BookMenu if it's mounted
              if (window.__bookMenuReload) {
                window.__bookMenuReload();
              }
            } catch (error) {
              // Silently handle errors during drag save - don't show alert
              console.error('Error saving position after drag:', error);
            }
          }
          draggedElementIdRef.current = null; // Clear after saving
        }, 100); // Save quickly (100ms) to ensure position is saved
        return () => clearTimeout(timer);
      }
    }
  }, [isDragging, elements]);

  const handleMouseUp = useCallback(async () => {
    // Save the element ID before deselecting
    const elementIdToSave = selectedElement || draggedElementIdRef.current;
    
    // Set flag to prevent modal from opening immediately after drag (do this BEFORE resetting drag state)
    if (hasMovedRef.current) {
    justFinishedDraggingRef.current = true;
      // BLOCK ALL CLICKS for a short period after drag
      blockClickRef.current = true;
    }
    
    // Reset dragging state (update ref immediately)
    isDraggingRef.current = false;
    setIsDragging(false);
    
    // Reset mouse position tracking
    mouseDownPositionRef.current = { x: 0, y: 0 };
    
    // Deselect element to prevent modal from opening after drag (but keep draggedElementIdRef for saving)
    if (hasMovedRef.current) {
    setSelectedElement(null);
    }
    
    // Keep flag for longer to prevent click event from opening modal and allow useEffect to save
    if (hasMovedRef.current) {
      // Keep the draggedElementIdRef for a bit longer to check in handleElementClick
      const draggedId = draggedElementIdRef.current;
    setTimeout(() => {
      justFinishedDraggingRef.current = false;
        hasMovedRef.current = false;
        // Clear draggedElementIdRef after a longer delay to ensure click event is blocked
        if (draggedElementIdRef.current === draggedId) {
          draggedElementIdRef.current = null;
        }
        // Unblock clicks after delay (but allow drag to start even if blockClickRef is true)
        blockClickRef.current = false;
      }, 300); // Longer delay to prevent menu from opening after drag
    } else {
      // No drag occurred - reset everything immediately to allow new drag
      hasMovedRef.current = false;
      draggedElementIdRef.current = null;
      blockClickRef.current = false;
      justFinishedDraggingRef.current = false;
    }
    
    // Save text element position if it was being dragged
    if (isDraggingTextElement && selectedTextElement && textElementDragPosition.x !== 0 && textElementDragPosition.y !== 0) {
      try {
        const token = localStorage.getItem('token');
        await axios.put(
          `/api/admin/page-text-styles/${selectedTextElement.pageNumber}/${selectedTextElement.elementType}`,
          {
            position_x: Math.round(textElementDragPosition.x),
            position_y: Math.round(textElementDragPosition.y)
          },
          {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            }
          }
        );
        await loadTextStyles(); // Reload to get updated positions
      } catch (error) {
        console.error('Error saving text element position:', error);
      }
    }
    
    // Reset text element drag state (update ref immediately)
    isDraggingTextElementRef.current = false;
    setIsDraggingTextElement(false);
  }, [isDraggingTextElement, selectedTextElement, textElementDragPosition, loadTextStyles]);

  // Attach mouse move listener when dragging
  useEffect(() => {
    if (isDragging || isDraggingTextElement) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, isDraggingTextElement, handleMouseMove, handleMouseUp]);

  // Check if we're in pages edit mode
  const locationParams = new URLSearchParams(location.search);
  const pagesMode = locationParams.get('pages') === 'true';
  const editMode = selectedTool === 'pages' && pagesMode;

  // Use refs to track drag state for event listeners (avoid closure issues)
  const isDraggingRef = useRef(false);
  const isDraggingTextElementRef = useRef(false);
  
  useEffect(() => {
    isDraggingRef.current = isDragging;
  }, [isDragging]);
  
  useEffect(() => {
    isDraggingTextElementRef.current = isDraggingTextElement;
  }, [isDraggingTextElement]);

  // Close context menu when dragging starts
  useEffect(() => {
    if (isDragging || isDraggingTextElement) {
      setShowElementContextMenu(false);
    }
  }, [isDragging, isDraggingTextElement]);

  // Prevent browser context menu globally when in edit mode or when dragging
  useEffect(() => {
    const handleGlobalContextMenu = (e) => {
      // Always prevent context menu when dragging (use refs to get latest state)
      // BUT allow it if justFinishedDraggingRef is true (after drag ends, allow context menu)
      if ((isDraggingRef.current || isDraggingTextElementRef.current || isDragging || isDraggingTextElement) && !justFinishedDraggingRef.current) {
        // Close any open context menu
        setShowElementContextMenu(false);
        e.preventDefault();
        e.stopPropagation();
        if (e.stopImmediatePropagation && typeof e.stopImmediatePropagation === 'function') {
          e.stopImmediatePropagation();
        }
        return false;
      }
      
      if (editMode) {
        // Only prevent if clicking on a text element or its container
        const isTextElement = e.target.closest('[data-text-element]') || 
                              e.target.closest('.page-number') ||
                              e.target.closest('.page-title') ||
                              e.target.closest('.terminal-text') ||
                              e.target.closest('.system-info');
        
        if (isTextElement) {
          e.preventDefault();
          e.stopPropagation();
          // Don't show our menu here - let the element's handler do it
        }
      }
    };
    
    // Also prevent on mousedown to catch it early
    const handleGlobalMouseDown = (e) => {
      // If we're dragging, only prevent right clicks (button 2) to avoid context menu
      // Don't prevent left clicks (button 0) as they are needed for dragging
      if ((isDraggingRef.current || isDraggingTextElementRef.current) && e.button === 2) {
        e.preventDefault();
        e.stopPropagation();
        if (e.stopImmediatePropagation && typeof e.stopImmediatePropagation === 'function') {
          e.stopImmediatePropagation();
        }
      }
    };
    
    // Also prevent on mouseup to catch any delayed context menu
    const handleGlobalMouseUp = (e) => {
      // Only prevent right clicks (button 2) during drag
      // Don't prevent left clicks as they are needed to end the drag
      if ((isDraggingRef.current || isDraggingTextElementRef.current) && e.button === 2) {
        e.preventDefault();
        e.stopPropagation();
        if (e.stopImmediatePropagation && typeof e.stopImmediatePropagation === 'function') {
          e.stopImmediatePropagation();
        }
      }
    };
    
    // Also prevent on mousemove during drag
    const handleGlobalMouseMove = (e) => {
      if (isDraggingRef.current || isDraggingTextElementRef.current) {
        // Prevent any context menu that might trigger during movement
        if (e.button === 2) {
          e.preventDefault();
          e.stopPropagation();
          if (e.stopImmediatePropagation && typeof e.stopImmediatePropagation === 'function') {
            e.stopImmediatePropagation();
          }
        }
      }
    };
    
    // Always listen for contextmenu to prevent it during drag
    // Use capture phase to catch it before it bubbles
    document.addEventListener('contextmenu', handleGlobalContextMenu, { capture: true, passive: false });
    document.addEventListener('mousedown', handleGlobalMouseDown, { capture: true, passive: false });
    document.addEventListener('mouseup', handleGlobalMouseUp, { capture: true, passive: false });
    document.addEventListener('mousemove', handleGlobalMouseMove, { capture: true, passive: false });
    
    return () => {
      document.removeEventListener('contextmenu', handleGlobalContextMenu, { capture: true });
      document.removeEventListener('mousedown', handleGlobalMouseDown, { capture: true });
      document.removeEventListener('mouseup', handleGlobalMouseUp, { capture: true });
      document.removeEventListener('mousemove', handleGlobalMouseMove, { capture: true });
    };
  }, [editMode]);

  const updateElement = async (id, updates, skipStateUpdate = false, skipReload = false) => {
    // Security check: Only admins can update elements
    if (user?.role !== 'admin') {
      alert('Access denied: Admin privileges required');
      return;
    }
    
    try {
      console.log('Updating element:', id, updates);
      // Ensure all numeric values are properly converted
      const cleanUpdates = {};
      Object.keys(updates).forEach(key => {
        const value = updates[key];
        if (['position_x', 'position_y', 'rotation', 'width', 'height', 'z_index', 'font_size', 'scale'].includes(key)) {
          cleanUpdates[key] = parseInt(value) || 0;
        } else if (key === 'is_locked' || key === 'is_active') {
          // Handle boolean values
          cleanUpdates[key] = Boolean(value);
        } else if (key === 'text_content') {
          // Allow text_content to be null or empty string
          cleanUpdates[key] = value === null || value === '' ? null : String(value);
        } else if (key === 'page_number') {
          // Handle page_number - allow null
          cleanUpdates[key] = value === null || value === '' || value === undefined ? null : parseInt(value);
        } else if (key === 'opacity') {
          // Handle opacity - decimal between 0 and 1
          cleanUpdates[key] = parseFloat(value) || 1.0;
        } else if (['glow_intensity', 'shadow_blur', 'shadow_x', 'shadow_y', 'blur'].includes(key)) {
          // Handle integer visual effect values
          cleanUpdates[key] = parseInt(value) || 0;
        } else if (['glow_color', 'shadow_color'].includes(key)) {
          // Handle color values - allow null
          cleanUpdates[key] = value === null || value === '' ? null : String(value);
        } else if (value !== undefined && value !== null) {
          // Convert other string values to string to ensure proper type
          cleanUpdates[key] = typeof value === 'string' ? value : String(value);
        }
      });
      
      console.log('Cleaned updates:', cleanUpdates);
      
      // Add Authorization header
      const token = localStorage.getItem('token');
      const response = await axios.put(`/api/admin/banners/${id}`, cleanUpdates, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      console.log('Update response:', response.data);
      
      // Always update local state immediately for better UX (even during drag)
      // This ensures the element stays in its new position
      setElements(prevElements => 
        prevElements.map(el => 
          el.id === id ? { ...el, ...cleanUpdates } : el
        )
      );
      
      // Only reload from DB if not skipping (to avoid resetting position after drag)
      // But don't reload immediately, as it might overwrite our changes
      // The local state is already updated above
      if (!skipReload) {
        // Don't reload elements immediately - the local state is already updated
        // Only reload BookMenu to show changes on the front-end
        // Reload elements after a longer delay to ensure DB is fully updated
        if (window.__bookMenuReload) {
          setTimeout(() => {
            window.__bookMenuReload();
          }, 200);
        }
        // Reload elements after a longer delay to sync, but preserve local changes
        setTimeout(async () => {
          await loadElements();
          // After reloading, merge our saved changes back to ensure they're not lost
          setElements(prevElements => 
            prevElements.map(el => 
              el.id === id ? { ...el, ...cleanUpdates } : el
            )
          );
        }, 1000); // Longer delay to ensure DB is fully updated
      }
      
      console.log('Element updated successfully');
    } catch (error) {
      console.error('Error updating element:', error);
      console.error('Error response:', error.response?.data);
      // Reload on error to get correct state
      await loadElements();
      // Only show alert if not skipping reload (i.e., not during drag save)
      if (!skipReload) {
        const errorMessage = error.response?.data?.details || error.response?.data?.error || error.message || 'Unknown error';
        alert('Error updating element: ' + errorMessage);
      }
      throw error; // Re-throw to allow caller to handle
    }
  };

  // Reset positions of all original text elements (system-info, page-number) to their default positions
  const resetOriginalTextPositions = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        alert('No authentication token');
        return;
      }

      // Get all text styles
      const response = await axios.get('/api/page-text-styles');
      const allStyles = response.data.styles || [];
      
      // Find all system-info and page-number styles
      const originalTextTypes = ['system-info', 'page-number'];
      const stylesToReset = allStyles.filter(style => 
        originalTextTypes.includes(style.element_type) && 
        (style.position_x !== null || style.position_y !== null)
      );

      if (stylesToReset.length === 0) {
        alert('All original text positions are already at their default positions.');
        return;
      }

      // Reset each style's position to null
      const resetPromises = stylesToReset.map(style => 
        axios.put(
          `/api/admin/page-text-styles/${style.page_number}/${style.element_type}`,
          { position_x: null, position_y: null },
          {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            }
          }
        )
      );

      await Promise.all(resetPromises);
      await loadTextStyles();
      
      // Reload BookMenu to show changes
      if (window.__bookMenuReload) {
        window.__bookMenuReload();
      }
      
      alert(`Successfully reset ${stylesToReset.length} original text element(s) to their default positions.`);
    } catch (error) {
      console.error('Error resetting original text positions:', error);
      const errorMessage = error.response?.data?.details || error.response?.data?.error || error.message || 'Unknown error';
      alert('Error resetting positions: ' + errorMessage);
    }
  };

  // Reset pages 1 and 2 system-info positions to default on mount
  useEffect(() => {
    const resetPages12 = async () => {
      try {
        const token = localStorage.getItem('token');
        if (!token) return;
        await Promise.all([
          axios.put(`/api/admin/page-text-styles/1/system-info`, { position_x: null, position_y: null }, {
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
          }),
          axios.put(`/api/admin/page-text-styles/2/system-info`, { position_x: null, position_y: null }, {
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
          })
        ]);
        await loadTextStyles();
        if (window.__bookMenuReload) window.__bookMenuReload();
      } catch (error) {
        console.error('Error resetting pages 1-2:', error);
      }
    };
    resetPages12();
  }, [loadTextStyles]);

  const deleteElement = async (id, skipConfirm = false) => {
    // Security check: Only admins can delete elements
    if (user?.role !== 'admin') {
      alert('Access denied: Admin privileges required');
      return;
    }
    
    // Only show confirmation if not already confirmed (skipConfirm is false)
    if (!skipConfirm && !window.confirm('Delete this element?')) {
      return;
    }
    
    try {
      await axios.delete(`/api/admin/banners/${id}`);
      await loadElements();
      // Also reload banners in BookMenu if it's mounted
      if (window.__bookMenuReload) {
        window.__bookMenuReload();
      }
      if (selectedElement === id) {
        setSelectedElement(null);
      }
    } catch (error) {
      console.error('Error deleting element:', error);
      alert('Error deleting element: ' + (error.response?.data?.error || error.message));
    }
  };

  const selectedElementData = elements.find(el => el.id === selectedElement);

  const [showSelectModal, setShowSelectModal] = useState(false);
  const [showImageModal, setShowImageModal] = useState(false);
  const [showTextModal, setShowTextModal] = useState(false);
  const [showTextareaModal, setShowTextareaModal] = useState(false);
  const [showPagesModal, setShowPagesModal] = useState(false);

  // Determine if we're in pages edit mode (use existing params if already defined)
  const designParams = new URLSearchParams(location.search);
  const designPagesMode = designParams.get('pages') === 'true';
  const designEditMode = designPagesMode;

  return (
    <>
      {/* Book background - functional book for design mode */}
      <div 
        className="design-background"
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          overflow: 'auto', // Enable scroll to access next/prev buttons
          zIndex: 0,
          pointerEvents: 'auto'
        }}
      >
        <BookMenu
          designMode={true}
          selectedTextElement={selectedTextElement}
          onTextElementClick={onTextElementClick}
          onTextElementMouseDown={onTextElementMouseDown}
          onTextElementContextMenu={onTextElementContextMenu}
          pages={bookPages}
          banners={elements.filter(el => el.is_active && (el.page_number !== null && el.page_number !== undefined))}
          textStyles={textStyles}
          siteTexts={siteTexts}
        />
      </div>
      
      <div 
        className="design-mode-overlay" 
        onClick={(e) => {
          // Deselect when clicking on empty space, but not if a modal is open
          if (!selectedElement && (e.target === e.currentTarget || e.target.classList.contains('design-mode-overlay'))) {
            setSelectedElement(null);
          }
        }}
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          zIndex: 10000,
          pointerEvents: 'none' // Allow clicks to pass through to the book below
        }}
      >
      {/* Floating Tool Buttons */}
      <div 
        className="floating-tools" 
        onClick={(e) => e.stopPropagation()}
        style={{ pointerEvents: 'auto', zIndex: 10002 }}
      >
        <button
          className={`floating-tool-btn ${selectedTool === 'select' ? 'active' : ''}`}
          onClick={(e) => {
            e.stopPropagation();
            setSelectedTool('select');
            setShowSelectModal(true);
          }}
          title="SELECT"
        >
          SELECT
        </button>
        <button
          className={`floating-tool-btn ${selectedTool === 'image' ? 'active' : ''}`}
          onClick={(e) => {
            e.stopPropagation();
            setSelectedTool('image');
            setShowImageModal(true);
          }}
          title="ADD IMAGE"
        >
          ADD IMAGE
        </button>
        <button
          className={`floating-tool-btn ${selectedTool === 'text' ? 'active' : ''}`}
          onClick={(e) => {
            e.stopPropagation();
            setSelectedTool('text');
            setShowTextModal(true);
          }}
          title="ADD TEXT"
        >
          ADD TEXT
        </button>
        <button
          className={`floating-tool-btn ${selectedTool === 'textarea' ? 'active' : ''}`}
          onClick={(e) => {
            e.stopPropagation();
            setSelectedTool('textarea');
            setShowTextareaModal(true);
          }}
          title="ADD TEXTAREA"
        >
          ADD TEXTAREA
        </button>
        <button
          className={`floating-tool-btn ${selectedTool === 'pages' ? 'active' : ''}`}
          onClick={(e) => {
            e.stopPropagation();
            setSelectedTool('pages');
            // Directly activate pages edit mode by updating URL
            const currentUrl = new URL(window.location.href);
            currentUrl.searchParams.set('pages', 'true');
            navigate(currentUrl.pathname + currentUrl.search, { replace: true });
          }}
          title="EDIT PAGES"
        >
          EDIT PAGES
        </button>
        <button
          className="floating-tool-btn"
          onClick={(e) => {
            e.stopPropagation();
            if (window.confirm('Reset all original text positions (system-info, page-number) to their default positions?')) {
              resetOriginalTextPositions();
            }
          }}
          title="RESET ORIGINAL TEXT POSITIONS"
          style={{ fontSize: '10px', padding: '5px 8px' }}
        >
          RESET TEXTS
        </button>
        <button
          className="floating-tool-btn exit"
          onClick={(e) => {
            e.stopPropagation();
            onExit();
            navigate('/admin');
          }}
          title="EXIT DESIGN"
        >
          EXIT
        </button>
      </div>

      {/* Select Modal */}
      {showSelectModal && (
        <div className="design-modal-overlay" onClick={() => setShowSelectModal(false)}>
          <div className="design-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>SELECT ELEMENT</h3>
              <button className="modal-close" onClick={() => setShowSelectModal(false)}>×</button>
            </div>
            <div className="modal-content">
              <p>Click on any element on the page to select and edit it.</p>
              <p>Use the properties panel to modify position, size, rotation, and other properties.</p>
              <button className="admin-button" onClick={() => setShowSelectModal(false)}>GOT IT</button>
            </div>
          </div>
        </div>
      )}

      {/* Image Modal */}
      {showImageModal && (
        <div className="design-modal-overlay" onClick={() => setShowImageModal(false)}>
          <div className="design-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>ADD IMAGE</h3>
              <button className="modal-close" onClick={() => setShowImageModal(false)}>×</button>
            </div>
            <div className="modal-content">
              <p>Select an image file from your computer to add to the page.</p>
              <div className="property-group" style={{ marginTop: '20px' }}>
                <label>PAGE NUMBER (optional, leave empty for global):</label>
                <input
                  type="number"
                  id="img-page-input"
                  min="1"
                  max="5"
                  className="property-input"
                  placeholder="1-5 or empty"
                />
              </div>
              <div className="property-group">
                <label>INITIAL WIDTH: <span id="img-width-preview">200</span>px</label>
                <input
                  type="range"
                  min="50"
                  max="1000"
                  defaultValue="200"
                  id="img-width-input"
                  className="property-slider"
                  onChange={(e) => {
                    document.getElementById('img-width-preview').textContent = e.target.value;
                  }}
                />
              </div>
              <div className="property-group">
                <label>INITIAL HEIGHT: <span id="img-height-preview">200</span>px</label>
                <input
                  type="range"
                  min="50"
                  max="1000"
                  defaultValue="200"
                  id="img-height-input"
                  className="property-slider"
                  onChange={(e) => {
                    document.getElementById('img-height-preview').textContent = e.target.value;
                  }}
                />
              </div>
              <button 
                className="admin-button" 
                onClick={() => {
                  const width = parseInt(document.getElementById('img-width-input')?.value || 200);
                  const height = parseInt(document.getElementById('img-height-input')?.value || 200);
                  const pageNumberInput = document.getElementById('img-page-input')?.value;
                  // Store dimensions and page number temporarily
                  window.__tempImageDimensions = { width, height };
                  window.__tempImagePageNumber = pageNumberInput || null;
                  fileInputRef.current?.click();
                  setShowImageModal(false);
                }}
              >
                SELECT IMAGE FILE
              </button>
              <button className="admin-button secondary" onClick={() => setShowImageModal(false)}>CANCEL</button>
            </div>
          </div>
        </div>
      )}

      {/* Text Modal */}
      {showTextModal && (
        <div className="design-modal-overlay" onClick={() => setShowTextModal(false)}>
          <div className="design-modal large" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>ADD TEXT</h3>
              <button className="modal-close" onClick={() => setShowTextModal(false)}>×</button>
            </div>
            <div className="modal-content">
              <div className="property-group">
                <label>TEXT CONTENT:</label>
                <input
                  type="text"
                  id="text-content-input"
                  defaultValue="NEW TEXT"
                  className="property-input"
                  placeholder="Enter text..."
                />
              </div>
              <div className="property-group">
                <label>FONT:</label>
                <select
                  id="text-font-input"
                  defaultValue="JetBrains Mono"
                  className="property-input"
                >
                  <option value="JetBrains Mono">JetBrains Mono</option>
                  <option value="Admin Panel Font">Admin Panel Font</option>
                  <option value="Logout Font">Logout Font</option>
                  {fonts.map(font => (
                    <option key={font.id} value={font.font_family}>{font.name}</option>
                  ))}
                </select>
                <button 
                  onClick={() => setShowFontUpload(true)} 
                  className="small-button"
                  style={{ marginLeft: '10px' }}
                >
                  UPLOAD FONT
                </button>
              </div>
              <div className="property-group">
                <label>FONT SIZE: <span id="text-size-preview">16</span>px</label>
                <input
                  type="range"
                  min="8"
                  max="200"
                  defaultValue="16"
                  id="text-size-input"
                  className="property-slider"
                  onChange={(e) => {
                    document.getElementById('text-size-preview').textContent = e.target.value;
                  }}
                />
              </div>
              <div className="property-group">
                <label>FONT WEIGHT:</label>
                <select
                  id="text-weight-input"
                  defaultValue="normal"
                  className="property-input"
                >
                  <option value="normal">Normal</option>
                  <option value="bold">Bold</option>
                  <option value="100">100</option>
                  <option value="200">200</option>
                  <option value="300">300</option>
                  <option value="400">400</option>
                  <option value="500">500</option>
                  <option value="600">600</option>
                  <option value="700">700</option>
                  <option value="800">800</option>
                  <option value="900">900</option>
                </select>
              </div>
              <div className="property-group">
                <label>FONT STYLE:</label>
                <select
                  id="text-style-input"
                  defaultValue="normal"
                  className="property-input"
                >
                  <option value="normal">Normal</option>
                  <option value="italic">Italic</option>
                </select>
              </div>
              <div className="property-group">
                <label>COLOR:</label>
                <input
                  type="color"
                  id="text-color-input"
                  defaultValue="#ff00ff"
                  className="property-input"
                  style={{ width: '100px', height: '40px' }}
                />
              </div>
              <div className="property-group">
                <label>INITIAL WIDTH: <span id="text-width-preview">200</span>px</label>
                <input
                  type="range"
                  min="50"
                  max="1000"
                  defaultValue="200"
                  id="text-width-input"
                  className="property-slider"
                  onChange={(e) => {
                    document.getElementById('text-width-preview').textContent = e.target.value;
                  }}
                />
              </div>
              <div className="property-group">
                <label>INITIAL HEIGHT: <span id="text-height-preview">50</span>px</label>
                <input
                  type="range"
                  min="20"
                  max="500"
                  defaultValue="50"
                  id="text-height-input"
                  className="property-slider"
                  onChange={(e) => {
                    document.getElementById('text-height-preview').textContent = e.target.value;
                  }}
                />
              </div>
              <div className="property-group">
                <label>PAGE NUMBER (optional, leave empty for global):</label>
                <input
                  type="number"
                  id="text-page-input"
                  min="1"
                  max="5"
                  className="property-input"
                  placeholder="1-5 or empty"
                />
              </div>
              <button 
                className="admin-button" 
                onClick={() => {
                  const pageNumberInput = document.getElementById('text-page-input')?.value;
                  const textData = {
                    text_content: document.getElementById('text-content-input')?.value || 'NEW TEXT',
                    font_family: document.getElementById('text-font-input')?.value || 'JetBrains Mono',
                    font_size: parseInt(document.getElementById('text-size-input')?.value || 16),
                    font_weight: document.getElementById('text-weight-input')?.value || 'normal',
                    font_style: document.getElementById('text-style-input')?.value || 'normal',
                    color: document.getElementById('text-color-input')?.value || '#ff00ff',
                    width: parseInt(document.getElementById('text-width-input')?.value || 200),
                    height: parseInt(document.getElementById('text-height-input')?.value || 50),
                    page_number: pageNumberInput ? parseInt(pageNumberInput) : null
                  };
                  // Get center of visible viewport (accounting for scroll)
                  const scrollX = window.pageXOffset || document.documentElement.scrollLeft || 0;
                  const scrollY = window.pageYOffset || document.documentElement.scrollTop || 0;
                  const centerX = scrollX + window.innerWidth / 2 - textData.width / 2;
                  const centerY = scrollY + window.innerHeight / 2 - textData.height / 2;
                  
                  // Calculate z_index: if page_number is set, use a lower z-index (5-10) for page elements
                  // Otherwise use elements.length + 1 for global elements
                  const textPageNumber = document.getElementById('text-page-input')?.value;
                  const calculatedZIndex = textPageNumber ? Math.min(10, Math.max(5, elements.filter(e => e.page_number === parseInt(textPageNumber)).length + 5)) : elements.length + 1;
                  
                  handleAddTextWithData({
                    ...textData,
                    position_x: centerX,
                    position_y: centerY,
                    rotation: 0,
                    z_index: calculatedZIndex,
                    is_active: true
                  });
                  setShowTextModal(false);
                }}
              >
                ADD TEXT ELEMENT
              </button>
              <button className="admin-button secondary" onClick={() => setShowTextModal(false)}>CANCEL</button>
            </div>
          </div>
        </div>
      )}

      {/* Textarea Modal */}
      {showTextareaModal && (
        <div className="design-modal-overlay" onClick={() => setShowTextareaModal(false)}>
          <div className="design-modal large" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>ADD TEXTAREA</h3>
              <button className="modal-close" onClick={() => setShowTextareaModal(false)}>×</button>
            </div>
            <div className="modal-content">
              <div className="property-group">
                <label>PAGE NUMBER (optional, leave empty for global):</label>
                <input
                  type="number"
                  id="textarea-page-input"
                  min="1"
                  max="5"
                  className="property-input"
                  placeholder="1-5 or empty"
                />
              </div>
              <div className="property-group">
                <label>TEXT CONTENT:</label>
                <textarea
                  id="textarea-content-input"
                  defaultValue=""
                  className="property-input"
                  placeholder="Enter text..."
                  rows="4"
                />
              </div>
              <div className="property-group">
                <label>FONT:</label>
                <select
                  id="textarea-font-input"
                  defaultValue="JetBrains Mono"
                  className="property-input"
                >
                  <option value="JetBrains Mono">JetBrains Mono</option>
                  <option value="Admin Panel Font">Admin Panel Font</option>
                  <option value="Logout Font">Logout Font</option>
                  {fonts.map(font => (
                    <option key={font.id} value={font.font_family}>{font.name}</option>
                  ))}
                </select>
                <button 
                  onClick={() => setShowFontUpload(true)} 
                  className="small-button"
                  style={{ marginLeft: '10px' }}
                >
                  UPLOAD FONT
                </button>
              </div>
              <div className="property-group">
                <label>FONT SIZE: <span id="textarea-size-preview">16</span>px</label>
                <input
                  type="range"
                  min="8"
                  max="200"
                  defaultValue="16"
                  id="textarea-size-input"
                  className="property-slider"
                  onChange={(e) => {
                    document.getElementById('textarea-size-preview').textContent = e.target.value;
                  }}
                />
              </div>
              <div className="property-group">
                <label>FONT WEIGHT:</label>
                <select
                  id="textarea-weight-input"
                  defaultValue="normal"
                  className="property-input"
                >
                  <option value="normal">Normal</option>
                  <option value="bold">Bold</option>
                  <option value="100">100</option>
                  <option value="200">200</option>
                  <option value="300">300</option>
                  <option value="400">400</option>
                  <option value="500">500</option>
                  <option value="600">600</option>
                  <option value="700">700</option>
                  <option value="800">800</option>
                  <option value="900">900</option>
                </select>
              </div>
              <div className="property-group">
                <label>FONT STYLE:</label>
                <select
                  id="textarea-style-input"
                  defaultValue="normal"
                  className="property-input"
                >
                  <option value="normal">Normal</option>
                  <option value="italic">Italic</option>
                </select>
              </div>
              <div className="property-group">
                <label>COLOR:</label>
                <input
                  type="color"
                  id="textarea-color-input"
                  defaultValue="#ff00ff"
                  className="property-input"
                  style={{ width: '100px', height: '40px' }}
                />
              </div>
              <div className="property-group">
                <label>INITIAL WIDTH: <span id="textarea-width-preview">300</span>px</label>
                <input
                  type="range"
                  min="100"
                  max="1000"
                  defaultValue="300"
                  id="textarea-width-input"
                  className="property-slider"
                  onChange={(e) => {
                    document.getElementById('textarea-width-preview').textContent = e.target.value;
                  }}
                />
              </div>
              <div className="property-group">
                <label>INITIAL HEIGHT: <span id="textarea-height-preview">150</span>px</label>
                <input
                  type="range"
                  min="50"
                  max="500"
                  defaultValue="150"
                  id="textarea-height-input"
                  className="property-slider"
                  onChange={(e) => {
                    document.getElementById('textarea-height-preview').textContent = e.target.value;
                  }}
                />
              </div>
              <button 
                className="admin-button" 
                onClick={() => {
                  const pageNumberInput = document.getElementById('textarea-page-input')?.value;
                  const textareaData = {
                    text_content: document.getElementById('textarea-content-input')?.value || '',
                    font_family: document.getElementById('textarea-font-input')?.value || 'JetBrains Mono',
                    font_size: parseInt(document.getElementById('textarea-size-input')?.value || 16),
                    font_weight: document.getElementById('textarea-weight-input')?.value || 'normal',
                    font_style: document.getElementById('textarea-style-input')?.value || 'normal',
                    color: document.getElementById('textarea-color-input')?.value || '#ff00ff',
                    width: parseInt(document.getElementById('textarea-width-input')?.value || 300),
                    height: parseInt(document.getElementById('textarea-height-input')?.value || 150),
                    page_number: pageNumberInput ? parseInt(pageNumberInput) : null
                  };
                  // Calculate position: if page_number is set, use null to trigger auto-centering on page
                  // Otherwise, center on viewport
                  let positionX, positionY;
                  if (pageNumberInput) {
                    // For page-specific textareas, use null to trigger auto-centering in BookMenu
                    positionX = null;
                    positionY = null;
                  } else {
                    // For global textareas, center on viewport
                  const scrollX = window.pageXOffset || document.documentElement.scrollLeft || 0;
                  const scrollY = window.pageYOffset || document.documentElement.scrollTop || 0;
                    positionX = scrollX + window.innerWidth / 2 - textareaData.width / 2;
                    positionY = scrollY + window.innerHeight / 2 - textareaData.height / 2;
                  }
                  
                  // Calculate z_index: if page_number is set, use a lower z-index (5-10) for page elements
                  // Otherwise use elements.length + 1 for global elements
                  const calculatedZIndex = pageNumberInput ? Math.min(10, Math.max(5, elements.filter(e => e.page_number === parseInt(pageNumberInput)).length + 5)) : elements.length + 1;
                  
                  createElement({
                    type: 'textarea',
                    ...textareaData,
                    url: '',
                    position_x: positionX,
                    position_y: positionY,
                    rotation: 0,
                    z_index: calculatedZIndex,
                    is_active: true
                  });
                  setShowTextareaModal(false);
                }}
              >
                ADD TEXTAREA ELEMENT
              </button>
              <button className="admin-button secondary" onClick={() => setShowTextareaModal(false)}>CANCEL</button>
            </div>
          </div>
        </div>
      )}



      {/* Context Menu for Design Elements (banners/images/texts) */}
      {showElementContextMenu && elementContextMenuElement && (
        <>
          <div 
            className="context-menu-overlay"
            onClick={() => {
              setShowElementContextMenu(false);
            }}
            onContextMenu={(e) => {
              e.preventDefault();
              setShowElementContextMenu(false);
            }}
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              zIndex: 10009,
              background: 'transparent'
            }}
          />
          <div 
            className="text-context-menu"
            style={{
              position: 'fixed',
              left: `${elementContextMenuPosition.x}px`,
              top: `${elementContextMenuPosition.y}px`,
              zIndex: 10010,
              pointerEvents: 'auto',
              display: 'block',
              width: '140px',
              paddingTop: '30px' // Space for close button
            }}
            onClick={(e) => e.stopPropagation()}
            onContextMenu={(e) => e.preventDefault()}
          >
            <button 
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                // Deselect element to prevent edit menu from opening
                setSelectedElement(null);
                // Close context menu
                setShowElementContextMenu(false);
              }}
              onMouseDown={(e) => {
                e.stopPropagation();
                e.preventDefault();
              }}
              style={{
                position: 'absolute',
                top: '3px',
                right: '3px',
                background: 'rgba(255, 0, 255, 0.8)',
                border: '2px solid #ff00ff',
                color: '#fff',
                width: '18px',
                height: '18px',
                borderRadius: '50%',
                cursor: 'pointer',
                fontSize: '12px',
                lineHeight: '1',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 100011,
                fontWeight: 'bold',
                boxShadow: '0 0 8px rgba(255, 0, 255, 0.5)',
                padding: 0,
                minWidth: '18px',
                minHeight: '18px',
                pointerEvents: 'auto'
              }}
              onMouseEnter={(e) => {
                e.target.style.background = 'rgba(255, 0, 255, 1)';
                e.target.style.transform = 'scale(1.15)';
              }}
              onMouseLeave={(e) => {
                e.target.style.background = 'rgba(255, 0, 255, 0.8)';
                e.target.style.transform = 'scale(1)';
              }}
            >
              ×
            </button>
            <button 
              className="context-menu-item"
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                // Reset all drag-related flags to allow modal to open
                justFinishedDraggingRef.current = false;
                hasMovedRef.current = false;
                blockClickRef.current = false;
                draggedElementIdRef.current = null;
                rightClickRef.current = false;
                // Close context menu first
                setShowElementContextMenu(false);
                // Select the element to show border and open properties modal
                const elementId = elementContextMenuElement.id;
                setSelectedTool('select');
                // Small delay to ensure context menu state is updated before modal opens
                setTimeout(() => {
                  setSelectedElement(elementId);
                }, 50);
              }}
            >
              EDIT
            </button>
            <button 
              className="context-menu-item"
              onClick={async (e) => {
                e.stopPropagation();
                // Don't close the context menu, keep it open
                await handleDuplicateElement(elementContextMenuElement);
              }}
            >
              DUPLIQUER
            </button>
            <button 
              className="context-menu-item"
              onClick={async (e) => {
                e.stopPropagation();
                setShowElementContextMenu(false);
                // Confirmation is already handled in deleteElement, pass skipConfirm=true to avoid double confirmation
                if (window.confirm('Supprimer cet élément ?')) {
                  await deleteElement(elementContextMenuElement.id, true);
                }
              }}
            >
              SUPPRIMER
            </button>
            <button 
              className="context-menu-item"
              onClick={async (e) => {
                e.stopPropagation();
                // Prevent opening edit menu after lock/unlock
                justFinishedDraggingRef.current = true;
                setTimeout(() => {
                  justFinishedDraggingRef.current = false;
                }, 500);
                // Don't close the context menu, keep it open
                const newLockState = !elementContextMenuElement.is_locked;
                console.log('Toggling lock state:', elementContextMenuElement.id, 'from', elementContextMenuElement.is_locked, 'to', newLockState);
                try {
                  await updateElement(elementContextMenuElement.id, { is_locked: newLockState }, false, false);
                  // Update local state immediately
                  setElements(prevElements => 
                    prevElements.map(el => 
                      el.id === elementContextMenuElement.id ? { ...el, is_locked: newLockState } : el
                    )
                  );
                  // Update the context menu element state so it reflects the new lock state
                  setElementContextMenuElement(prev => ({ ...prev, is_locked: newLockState }));
                  alert(newLockState ? 'Élément verrouillé' : 'Élément déverrouillé');
                } catch (error) {
                  console.error('Error toggling lock:', error);
                  alert('Erreur lors du verrouillage/déverrouillage');
                }
              }}
            >
              {elementContextMenuElement.is_locked ? 'DÉVERROUILLER' : 'VERROUILLER'}
            </button>
            <div style={{ display: 'flex', width: '100%', gap: '2px' }}>
            <button 
              className="context-menu-item"
              onClick={async (e) => {
                e.stopPropagation();
                // Prevent opening edit menu after rotation
                justFinishedDraggingRef.current = true;
                setTimeout(() => {
                  justFinishedDraggingRef.current = false;
                }, 500);
                // Don't close the context menu, keep it open
                // Rotate element by 15 degrees
                const currentRotation = elementContextMenuElement.rotation || 0;
                const newRotation = (currentRotation + 15) % 360;
                console.log('Rotating element:', elementContextMenuElement.id, 'from', currentRotation, 'to', newRotation);
                try {
                  await updateElement(elementContextMenuElement.id, { rotation: newRotation }, false, false);
                  // Update local state immediately
                  setElements(prevElements => 
                    prevElements.map(el => 
                      el.id === elementContextMenuElement.id ? { ...el, rotation: newRotation } : el
                    )
                  );
                  // Update the context menu element state so it reflects the new rotation
                  setElementContextMenuElement(prev => ({ ...prev, rotation: newRotation }));
                  if (window.__bookMenuReload) {
                    window.__bookMenuReload();
                  }
                } catch (error) {
                  console.error('Error rotating element:', error);
                  alert('Error rotating element');
                }
              }}
                style={{ flex: 1 }}
            >
                ROTATION
              </button>
              <button 
                className="context-menu-item"
                onClick={async (e) => {
                  e.stopPropagation();
                  // Prevent opening edit menu after rotation
                  justFinishedDraggingRef.current = true;
                  setTimeout(() => {
                    justFinishedDraggingRef.current = false;
                  }, 500);
                  // Rotate element by +15 degrees
                  const currentRotation = elementContextMenuElement.rotation || 0;
                  const newRotation = (currentRotation + 15) % 360;
                  try {
                    await updateElement(elementContextMenuElement.id, { rotation: newRotation }, false, false);
                    setElements(prevElements => 
                      prevElements.map(el => 
                        el.id === elementContextMenuElement.id ? { ...el, rotation: newRotation } : el
                      )
                    );
                    setElementContextMenuElement(prev => ({ ...prev, rotation: newRotation }));
                    if (window.__bookMenuReload) {
                      window.__bookMenuReload();
                    }
                  } catch (error) {
                    console.error('Error rotating element:', error);
                    alert('Error rotating element');
                  }
                }}
                style={{ width: '30px', padding: '8px 4px', fontSize: '14px' }}
              >
                +
              </button>
              <button 
                className="context-menu-item"
                onClick={async (e) => {
                  e.stopPropagation();
                  // Prevent opening edit menu after rotation
                  justFinishedDraggingRef.current = true;
                  setTimeout(() => {
                    justFinishedDraggingRef.current = false;
                  }, 500);
                  // Rotate element by -15 degrees
                  const currentRotation = elementContextMenuElement.rotation || 0;
                  const newRotation = (currentRotation - 15 + 360) % 360; // Add 360 to handle negative values
                  try {
                    await updateElement(elementContextMenuElement.id, { rotation: newRotation }, false, false);
                    setElements(prevElements => 
                      prevElements.map(el => 
                        el.id === elementContextMenuElement.id ? { ...el, rotation: newRotation } : el
                      )
                    );
                    setElementContextMenuElement(prev => ({ ...prev, rotation: newRotation }));
                    if (window.__bookMenuReload) {
                      window.__bookMenuReload();
                    }
                  } catch (error) {
                    console.error('Error rotating element:', error);
                    alert('Error rotating element');
                  }
                }}
                style={{ width: '30px', padding: '8px 4px', fontSize: '14px' }}
              >
                -
            </button>
            </div>
          </div>
        </>
      )}

      {/* Context Menu for Text Elements */}
      {showContextMenu && contextMenuElement && (
        <>
          <div 
            className="context-menu-overlay"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setShowContextMenu(false);
            }}
            onContextMenu={(e) => {
              e.preventDefault();
              setShowContextMenu(false);
            }}
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              zIndex: 10009,
              background: 'transparent'
            }}
          />
          <div 
            className="text-context-menu"
            style={{
              position: 'fixed',
              left: `${contextMenuPosition.x}px`,
              top: `${contextMenuPosition.y}px`,
              zIndex: 10010,
              pointerEvents: 'auto',
              display: 'block',
              width: '140px',
              paddingTop: '30px' // Space for close button
            }}
            onClick={(e) => e.stopPropagation()}
            onContextMenu={(e) => e.preventDefault()}
          >
            <button 
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                // Deselect text element to prevent edit menu from opening
                setSelectedTextElement(null);
                // Close context menu
                setShowContextMenu(false);
              }}
              onMouseDown={(e) => {
                e.stopPropagation();
                e.preventDefault();
              }}
              style={{
                position: 'absolute',
                top: '3px',
                right: '3px',
                background: 'rgba(255, 0, 255, 0.8)',
                border: '2px solid #ff00ff',
                color: '#fff',
                width: '18px',
                height: '18px',
                borderRadius: '50%',
                cursor: 'pointer',
                fontSize: '12px',
                lineHeight: '1',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 100011,
                fontWeight: 'bold',
                boxShadow: '0 0 8px rgba(255, 0, 255, 0.5)',
                padding: 0,
                minWidth: '18px',
                minHeight: '18px',
                pointerEvents: 'auto'
              }}
              onMouseEnter={(e) => {
                e.target.style.background = 'rgba(255, 0, 255, 1)';
                e.target.style.transform = 'scale(1.15)';
              }}
              onMouseLeave={(e) => {
                e.target.style.background = 'rgba(255, 0, 255, 0.8)';
                e.target.style.transform = 'scale(1)';
              }}
            >
              ×
            </button>
            <button 
              className="context-menu-item"
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                setShowContextMenu(false);
                // Keep the selected element and open the editor modal
                setSelectedTextElement(contextMenuElement);
                setSelectedTool('pages');
              }}
            >
              EDIT
            </button>
            <button 
              className="context-menu-item"
              onClick={async (e) => {
                e.stopPropagation();
                setShowContextMenu(false);
                await handleDuplicateTextStyle(contextMenuElement.pageNumber, contextMenuElement.elementType);
              }}
            >
              DUPLIQUER
            </button>
          </div>
        </>
      )}

      {/* Text Element Editor Modal - show when 'pages' tool is selected or when 'select' tool is used */}
      {(selectedTool === 'pages' || selectedTool === 'select') && selectedTextElement && !showContextMenu && (
        <div className="design-modal-overlay" onClick={() => {
          setSelectedTextElement(null);
        }}>
          <div className="design-modal properties-modal" onClick={(e) => e.stopPropagation()} style={{ position: 'relative' }}>
            <button 
              onClick={() => setSelectedTextElement(null)}
              style={{
                position: 'absolute',
                top: '10px',
                left: '10px',
                background: 'rgba(255, 0, 255, 0.8)',
                border: '2px solid #ff00ff',
                color: '#fff',
                width: '30px',
                height: '30px',
                borderRadius: '50%',
                cursor: 'pointer',
                fontSize: '20px',
                lineHeight: '1',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 100001,
                fontWeight: 'bold',
                boxShadow: '0 0 10px rgba(255, 0, 255, 0.5)'
              }}
              onMouseEnter={(e) => {
                e.target.style.background = 'rgba(255, 0, 255, 1)';
                e.target.style.transform = 'scale(1.1)';
              }}
              onMouseLeave={(e) => {
                e.target.style.background = 'rgba(255, 0, 255, 0.8)';
                e.target.style.transform = 'scale(1)';
              }}
            >
              ×
            </button>
            <div className="modal-header">
              <h3>EDIT TEXT STYLE</h3>
              <button className="modal-close" onClick={() => {
                setSelectedTextElement(null);
              }}>×</button>
            </div>
            <div className="modal-content">
              <TextElementEditor
                pageNumber={selectedTextElement.pageNumber}
                elementType={selectedTextElement.elementType}
                fonts={fonts}
                textStyles={textStyles}
                bookPages={bookPages}
                selectedTextElement={selectedTextElement}
                banners={elements}
                onUpdate={async (updates) => {
                  // For textareas, update the banner directly, not page_text_styles
                  if (selectedTextElement.elementType === 'textarea' && selectedTextElement.bannerId) {
                    try {
                      const token = localStorage.getItem('token');
                      console.log('Updating textarea banner:', selectedTextElement.bannerId, updates);
                      const response = await axios.put(
                        `/api/admin/banners/${selectedTextElement.bannerId}`,
                        updates,
                        {
                          headers: {
                            'Authorization': `Bearer ${token}`,
                            'Content-Type': 'application/json'
                          }
                        }
                      );
                      console.log('Textarea banner update response:', response.data);
                      await loadElements();
                      if (window.__bookMenuReload) {
                        window.__bookMenuReload();
                      }
                    } catch (error) {
                      console.error('Error updating textarea banner:', error);
                      console.error('Error response:', error.response?.data);
                      const errorMessage = error.response?.data?.details || error.response?.data?.error || error.message || 'Unknown error';
                      alert('Error updating textarea: ' + errorMessage);
                      throw error;
                    }
                  } else {
                    // For other element types, update page_text_styles
                    try {
                      const token = localStorage.getItem('token');
                      console.log('Sending text style update:', updates);
                      const response = await axios.put(
                        `/api/admin/page-text-styles/${selectedTextElement.pageNumber}/${selectedTextElement.elementType}`,
                        updates,
                        {
                          headers: {
                            'Authorization': `Bearer ${token}`,
                            'Content-Type': 'application/json'
                          }
                        }
                      );
                      console.log('Text style update response:', response.data);
                      await loadTextStyles();
                    } catch (error) {
                      console.error('Error updating text style:', error);
                      console.error('Error response:', error.response?.data);
                      const errorMessage = error.response?.data?.details || error.response?.data?.error || error.message || 'Unknown error';
                      alert('Error updating text style: ' + errorMessage);
                      throw error;
                    }
                  }
                }}
                onPageContentUpdate={async (pageNumber, contentUpdates) => {
                  try {
                    const token = localStorage.getItem('token');
                    await axios.put(
                      `/api/admin/book-pages/${pageNumber}`,
                      contentUpdates,
                      {
                        headers: {
                          'Authorization': `Bearer ${token}`,
                          'Content-Type': 'application/json'
                        }
                      }
                    );
                    // Reload pages in DesignMode
                    await loadBookPages();
                    // Also reload in BookMenu if it's mounted (this will reload pages, banners, textStyles, siteTexts)
                    // Use a small delay to ensure all data is loaded before triggering reload
                    setTimeout(() => {
                      if (window.__bookMenuReload) {
                        window.__bookMenuReload();
                      }
                    }, 100);
                    console.log('Page content updated successfully in database');
                    alert('Page content updated successfully!');
                  } catch (error) {
                    console.error('Error updating page content:', error);
                    alert('Error updating page content');
                    throw error;
                  }
                }}
                onShowFontUpload={() => setShowFontUpload(true)}
              />
            </div>
          </div>
        </div>
      )}

      {/* LOCKED Overlay */}
      {showLockedOverlay && (
        <div
          style={{
            position: 'fixed',
            left: `${lockedOverlayPosition.x}px`,
            top: `${lockedOverlayPosition.y}px`,
            transform: 'translate(-50%, -50%)',
            zIndex: 20000,
            pointerEvents: 'none',
            background: 'rgba(0, 0, 0, 0.8)',
            backdropFilter: 'blur(10px)',
            WebkitBackdropFilter: 'blur(10px)',
            padding: '20px 40px',
            borderRadius: '8px',
            border: '2px solid #ff00ff',
            boxShadow: '0 0 20px rgba(255, 0, 255, 0.5)',
            color: '#ff00ff',
            fontSize: '24px',
            fontWeight: 'bold',
            fontFamily: 'JetBrains Mono, monospace',
            letterSpacing: '4px',
            textTransform: 'uppercase',
            whiteSpace: 'nowrap'
          }}
        >
          LOCKED
        </div>
      )}

      {/* Design elements overlay - positioned absolutely over the real page */}
      {/* Always show elements overlay, but only allow interaction when not in pages mode */}
      <div 
        className="design-elements-overlay" 
        onContextMenu={(e) => {
          // Prevent context menu on the overlay itself (use refs for immediate check)
          if (isDraggingRef.current || isDraggingTextElementRef.current) {
            e.preventDefault();
            e.stopPropagation();
            return false;
          }
        }}
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          pointerEvents: 'none', // Always allow scroll and clicks to pass through - only elements themselves are interactive
          zIndex: 10001,
          overflow: 'visible'
        }}
      >
        {/* Show GLOBAL elements (page_number IS NULL) and LOCKED page-specific elements (except textareas) in the overlay */}
        {/* Unlocked page-specific elements and locked textareas are rendered inside the book pages */}
        {elements.filter(el => {
          // Always show global elements
          if (el.page_number === null || el.page_number === undefined) return true;
          // For page-specific elements: show locked ones in overlay EXCEPT textareas (textareas stay in BookMenu)
          if (el.is_locked && el.type !== 'textarea') return true;
          // Don't show unlocked or textarea elements here
          return false;
        }).map((element) => {
          // For locked page-specific elements, convert page-relative coordinates to viewport coordinates
          let elementForRender = element;
          if (element.is_locked && element.page_number !== null && element.page_number !== undefined) {
            // Find the page element in the DOM to get its viewport position
            const pageContainer = document.querySelector(`.book-page-container[data-page-index="${element.page_number - 1}"]`);
            const pageElement = pageContainer ? pageContainer.querySelector('.page') : null;
            if (pageElement) {
              const pageRect = pageElement.getBoundingClientRect();
              // Convert page-relative position to viewport position
              elementForRender = {
                ...element,
                position_x: pageRect.left + (element.position_x || 0),
                position_y: pageRect.top + (element.position_y || 0)
              };
            }
          }
          return elementForRender;
        }).map((element) => (
          <React.Fragment key={element.id}>
            <DesignElement
              element={element}
              isSelected={selectedElement === element.id}
              onClick={(e) => {
                // Don't open modal if right click just occurred
                if (rightClickRef.current) {
                  e.preventDefault();
                  e.stopPropagation();
                  setSelectedElement(null);
                  return;
                }
                // BLOCK ALL CLICKS if we're blocking clicks (after a drag)
                if (blockClickRef.current) {
                  e.preventDefault();
                  e.stopPropagation();
                  setSelectedElement(null);
                  return;
                }
                // Prevent click if we just finished dragging
                if (justFinishedDraggingRef.current) {
                  e.preventDefault();
                  e.stopPropagation();
                  return;
                }
                // Prevent click if this element was just dragged
                if (draggedElementIdRef.current === element.id) {
                  e.preventDefault();
                  e.stopPropagation();
                  return;
                }
                // Prevent click if mouse moved (it was a drag)
                if (hasMovedRef.current) {
                  e.preventDefault();
                  e.stopPropagation();
                  return;
                }
                handleElementClick(e, element);
              }}
              onMouseDown={(e) => {
                handleMouseDown(e, element);
              }}
              onContextMenu={(e) => {
                handleElementContextMenu(e, element);
              }}
              isDraggingRef={isDraggingRef}
              isDraggingTextElementRef={isDraggingTextElementRef}
              isDragging={isDragging}
              isDraggingTextElement={isDraggingTextElement}
            />
          </React.Fragment>
        ))}
      </div>

      {/* Element Properties Modal - Opens via context menu "EDIT" button - Rendered AFTER design-elements-overlay to ensure it's on top */}
      {selectedElement && selectedElementData && !selectedElementData.is_locked && selectedTool === 'select' && !isDragging && !isDraggingTextElement && !showElementContextMenu && !justFinishedDraggingRef.current && !blockClickRef.current && (
        <div className="design-modal-overlay" onClick={() => {
          setSelectedElement(null);
        }} style={{ zIndex: 99999 }}>
          <div className="design-modal properties-modal" onClick={(e) => e.stopPropagation()} style={{ position: 'relative' }}>
            <div className="modal-header">
              <h3>ELEMENT PROPERTIES</h3>
            </div>
            <div className="modal-content">
              <ElementProperties
                element={selectedElementData}
                fonts={fonts}
                onUpdate={(updates) => updateElement(selectedElement, updates)}
                onDelete={() => {
                  deleteElement(selectedElement, false);
                  setSelectedElement(null);
                }}
                onShowFontUpload={() => setShowFontUpload(true)}
              />
            </div>
          </div>
        </div>
      )}

      {/* Hidden file inputs */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={handleImageUpload}
      />
      <input
        ref={fontInputRef}
        type="file"
        accept=".ttf,.otf"
        style={{ display: 'none' }}
        onChange={handleFontUpload}
      />

      {/* Text Editor Modal */}
      {editingText && (
        <TextEditor
          initialData={editingText}
          fonts={fonts}
          onSave={handleSaveText}
          onCancel={() => setEditingText(null)}
          onShowFontUpload={() => setShowFontUpload(true)}
        />
      )}

      {showFontUpload && (
        <div className="font-upload-modal" onClick={(e) => {
          if (e.target === e.currentTarget) {
            setShowFontUpload(false);
          }
        }}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>UPLOAD FONT</h3>
              <button className="modal-close" onClick={() => setShowFontUpload(false)}>×</button>
            </div>
            <div style={{ padding: '20px' }}>
              <p style={{ color: '#ccc', marginBottom: '20px', fontSize: '12px' }}>
                Select a .ttf or .otf font file from your computer
              </p>
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  fontInputRef.current?.click();
                }}
                className="admin-button"
                style={{ marginBottom: '20px', width: '100%' }}
              >
                SELECT FONT FILE
              </button>
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  setShowFontUpload(false);
                }} 
                className="admin-button secondary"
                style={{ width: '100%' }}
              >
                CANCEL
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
    </>
  );
};

// Helper function to generate visual effects styles
const getVisualEffectsStyles = (element) => {
  const styles = {};
  
  // Opacity
  if (element.opacity !== undefined && element.opacity !== null) {
    styles.opacity = element.opacity;
  }
  
  // Blur filter
  if (element.blur !== undefined && element.blur > 0) {
    styles.filter = `blur(${element.blur}px)`;
  }
  
  // Glow effects removed for raw style
  
  // Box shadow (for images and other elements)
  if (element.shadow_color && (element.shadow_blur > 0 || element.shadow_x !== 0 || element.shadow_y !== 0)) {
    const shadowColor = element.shadow_color;
    const shadowBlur = element.shadow_blur || 0;
    const shadowX = element.shadow_x || 0;
    const shadowY = element.shadow_y || 0;
    const shadow = `${shadowX}px ${shadowY}px ${shadowBlur}px ${shadowColor}`;
    styles.boxShadow = styles.boxShadow 
      ? `${styles.boxShadow}, ${shadow}` 
      : shadow;
  }
  
  return styles;
};

const DesignElement = ({ element, isSelected, onClick, onMouseDown, onContextMenu, isDraggingRef, isDraggingTextElementRef, isDragging, isDraggingTextElement }) => {
  // Use fixed positioning for locked elements (doesn't move with scroll), absolute for unlocked elements
  // Locked elements should stay fixed relative to viewport, not move with scroll (like on front-end)
  const positionType = 'absolute'; // Les locked scrollent aussi en design mode
  
  const visualEffects = getVisualEffectsStyles(element);
  
  const baseStyle = {
    position: positionType,
    left: `${element.position_x || 0}px`,
    top: `${element.position_y || 0}px`,
    transform: `rotate(${element.rotation || 0}deg)`,
    transformOrigin: 'center center',
    zIndex: (element.z_index || 1) + 10000,
    cursor: element.is_locked ? 'not-allowed' : (isSelected ? 'move' : 'pointer'),
    pointerEvents: 'auto',
    ...visualEffects
  };

  const contentStyle = {
    width: (element.type === 'text' || element.type === 'textarea') ? 'max-content' : `${element.width || 200}px`,
    height: (element.type === 'text' || element.type === 'textarea') ? 'max-content' : `${element.height || 200}px`,
    minWidth: (element.type === 'text' || element.type === 'textarea') ? `${element.width || 200}px` : 'auto',
    minHeight: (element.type === 'text' || element.type === 'textarea') ? `${element.height || 50}px` : 'auto',
    maxWidth: (element.type === 'text' || element.type === 'textarea') ? 'none' : '100%',
    boxSizing: 'border-box',
    border: isSelected ? '2px dashed #ff00ff' : 'none',
    display: (element.type === 'text' || element.type === 'textarea') ? 'inline-block' : 'block'
  };

  if (element.type === 'text') {
    const fontFamily = element.font_family && element.font_family !== 'JetBrains Mono'
      ? `'${element.font_family}', 'JetBrains Mono', monospace`
      : 'JetBrains Mono, monospace';

    return (
      <div style={baseStyle}>
        <div
          onContextMenu={(e) => {
            // Only show context menu if not dragging
            // Note: contextmenu event is always from right click
            // Check both refs and state to be sure
            if (!isDraggingRef?.current && !isDraggingTextElementRef?.current && !isDragging && !isDraggingTextElement) {
              onContextMenu(e);
            } else {
              e.preventDefault();
              e.stopPropagation();
              return false;
            }
          }}
          style={{
            ...contentStyle,
            fontFamily: fontFamily,
            fontSize: `${element.font_size || 16}px`,
            fontWeight: element.font_weight || 'normal',
            fontStyle: element.font_style || 'normal',
            color: element.color || '#ff00ff',
            display: 'inline-block',
            background: isSelected ? 'rgba(255, 0, 255, 0.1)' : 'transparent',
            wordWrap: 'break-word',
            overflow: 'visible', // Allow text to overflow the container
            textAlign: 'center',
            padding: '5px', // Add some padding for better visibility
            whiteSpace: 'pre-wrap', // Preserve line breaks
            // Override minWidth and minHeight to allow border to adapt to content size
            minWidth: 'max-content',
            minHeight: 'max-content',
            ...getVisualEffectsStyles(element)
          }}
          onClick={onClick}
          onMouseDown={onMouseDown}
        >
          {element.text_content || 'TEXT'}
        </div>
      </div>
    );
  }

  if (element.type === 'textarea') {
    const fontFamily = element.font_family && element.font_family !== 'JetBrains Mono'
      ? `'${element.font_family}', 'JetBrains Mono', monospace`
      : 'JetBrains Mono, monospace';

    // Calculate page dimensions for page-specific textareas
    // Book: 90% width, max 900px, so each page is 50% = 450px max
    // Book height: 650px
    // Page padding: 40px all around = 80px total
    // Header height: ~60px (with border and padding)
    // Footer height: ~60px (with border and padding)
    // Available content space: width = 450 - 80 = 370px, height = 650 - 80 - 60 - 60 = 450px
    // Use box-sizing: border-box so padding and border are included in width
    // Reduce width slightly to 360px to prevent overflow on the right side
    const isPageSpecific = element.page_number !== null && element.page_number !== undefined;
    const pageWidth = 360; // Slightly less than 370px to prevent overflow
    const pageHeight = 450; // 650px page height - 80px padding - 120px header/footer
    
    const textareaWidth = isPageSpecific ? pageWidth : (element.width || 300);
    const textareaHeight = isPageSpecific ? pageHeight : (element.height || 150);

    return (
      <div style={baseStyle}>
        <textarea
          onContextMenu={(e) => {
            // Only show context menu if not dragging
            if (!isDraggingRef?.current && !isDraggingTextElementRef?.current && !isDragging && !isDraggingTextElement) {
              onContextMenu(e);
            } else {
              e.preventDefault();
              e.stopPropagation();
              return false;
            }
          }}
          style={{
            ...contentStyle,
            fontFamily: fontFamily,
            fontSize: `${element.font_size || 16}px`,
            fontWeight: element.font_weight || 'normal',
            fontStyle: element.font_style || 'normal',
            color: element.color || '#ff00ff',
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            border: isSelected ? '2px dashed #ff00ff' : '1px solid #ff00ff',
            padding: '10px',
            boxSizing: 'border-box', // Include padding and border in width/height to prevent overflow
            resize: isPageSpecific ? 'none' : 'both', // Disable resize for page-specific textareas
            width: `${textareaWidth}px`,
            height: `${textareaHeight}px`,
            minWidth: `${textareaWidth}px`,
            minHeight: `${textareaHeight}px`,
            ...getVisualEffectsStyles(element)
          }}
          onClick={onClick}
          onMouseDown={onMouseDown}
          defaultValue={element.text_content || ''}
          readOnly
        />
      </div>
    );
  }

    const imageVisualEffects = getVisualEffectsStyles(element);
    
    return (
      <div style={baseStyle}>
        <img
          src={buildAssetUrl(element.url)}
          alt="Design element"
          style={{
            ...contentStyle,
            display: 'block',
            maxWidth: '100%',
            height: 'auto',
            objectFit: 'contain',
            ...imageVisualEffects
          }}
          onClick={onClick}
          onMouseDown={(e) => {
            // Don't prevent mousedown - let drag work normally
            // Only prevent if it's a right click during drag
            if ((isDraggingRef?.current || isDraggingTextElementRef?.current) && e.button === 2) {
              e.preventDefault();
              e.stopPropagation();
            }
            onMouseDown(e);
          }}
          onContextMenu={(e) => {
            // Only show context menu if not dragging
            // Note: contextmenu event is always from right click
            // Check both refs and state to be sure
            if (!isDraggingRef?.current && !isDraggingTextElementRef?.current && !isDragging && !isDraggingTextElement) {
              onContextMenu(e);
            } else {
              e.preventDefault();
              e.stopPropagation();
              return false;
            }
          }}
          draggable={false}
        />
      </div>
    );
};

const ElementProperties = ({ element, fonts, onUpdate, onDelete, onShowFontUpload }) => {
  const [localUpdates, setLocalUpdates] = useState({
    position_x: element.position_x,
    position_y: element.position_y,
    rotation: element.rotation,
    width: element.width,
    height: element.height,
    z_index: element.z_index,
    scale: element.scale || 100,
    is_locked: element.is_locked || false,
    glow_color: element.glow_color || null,
    glow_intensity: element.glow_intensity || 0,
    shadow_color: element.shadow_color || null,
    shadow_blur: element.shadow_blur || 0,
    shadow_x: element.shadow_x || 0,
    shadow_y: element.shadow_y || 0,
    opacity: element.opacity !== undefined ? element.opacity : 1.0,
    blur: element.blur || 0,
    ...(element.type === 'text' || element.type === 'textarea' ? {
      text_content: element.text_content,
      font_family: element.font_family,
      font_size: element.font_size,
      font_weight: element.font_weight,
      font_style: element.font_style,
      color: element.color
    } : {
      url: element.url
    })
  });

  // Update local state when element prop changes
  useEffect(() => {
    setLocalUpdates({
      position_x: element.position_x,
      position_y: element.position_y,
      rotation: element.rotation,
      width: element.width,
      height: element.height,
      z_index: element.z_index,
      scale: element.scale || 100,
      is_locked: element.is_locked || false,
      glow_color: element.glow_color || null,
      glow_intensity: element.glow_intensity || 0,
      shadow_color: element.shadow_color || null,
      shadow_blur: element.shadow_blur || 0,
      shadow_x: element.shadow_x || 0,
      shadow_y: element.shadow_y || 0,
      opacity: element.opacity !== undefined ? element.opacity : 1.0,
      blur: element.blur || 0,
      ...(element.type === 'text' || element.type === 'textarea' ? {
        text_content: element.text_content,
        font_family: element.font_family,
        font_size: element.font_size,
        font_weight: element.font_weight,
        font_style: element.font_style,
        color: element.color
      } : {
        url: element.url
      })
    });
  }, [element]);

  // Debounce timer for text fields to avoid too many API calls
  const debounceTimerRef = useRef(null);

  const handleChange = async (field, value) => {
    const updates = { ...localUpdates, [field]: value };
    setLocalUpdates(updates);
    
    // For text_content, use debounce to avoid too many API calls
    if (field === 'text_content') {
      // Clear existing timer
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      
      // Set new timer to update after user stops typing
      debounceTimerRef.current = setTimeout(async () => {
        try {
          console.log('ElementProperties: Updating field:', field, 'with value:', value);
          await onUpdate({ [field]: value });
          console.log('Field updated successfully:', field, value);
        } catch (error) {
          console.error('Error updating field:', field, error);
          console.error('Error response:', error.response?.data);
          // Revert local state on error
          setLocalUpdates(prev => ({ ...prev, [field]: element[field] }));
          // Show error to user
          const errorMessage = error.response?.data?.error || error.response?.data?.details || error.response?.data?.sqlMessage || error.message || 'Unknown error';
          alert(`Error updating ${field}: ${errorMessage}`);
        }
      }, 500); // Wait 500ms after user stops typing
    } else {
      // For other fields, update immediately
      try {
        console.log('ElementProperties: Updating field:', field, 'with value:', value);
        await onUpdate({ [field]: value });
        console.log('Field updated successfully:', field, value);
      } catch (error) {
        console.error('Error updating field:', field, error);
        console.error('Error response:', error.response?.data);
        // Revert local state on error
        setLocalUpdates(prev => ({ ...prev, [field]: element[field] }));
        // Show error to user
        const errorMessage = error.response?.data?.error || error.response?.data?.details || error.response?.data?.sqlMessage || error.message || 'Unknown error';
        alert(`Error updating ${field}: ${errorMessage}`);
      }
    }
  };
  
  // Cleanup debounce timer on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  return (
    <div className="element-properties">
      <h4>PROPERTIES</h4>
      
      <div className="property-group">
        <label>X: {localUpdates.position_x}px</label>
        <input
          type="range"
          min="0"
          max="3000"
          value={localUpdates.position_x || 0}
          onChange={(e) => handleChange('position_x', parseInt(e.target.value))}
          className="property-slider"
        />
        <label>Y: {localUpdates.position_y}px</label>
        <input
          type="range"
          min="0"
          max="3000"
          value={localUpdates.position_y || 0}
          onChange={(e) => handleChange('position_y', parseInt(e.target.value))}
          className="property-slider"
        />
      </div>

      <div className="property-group">
        <label>ROTATION: {localUpdates.rotation}°</label>
        <input
          type="range"
          min="0"
          max="360"
          value={localUpdates.rotation || 0}
          onChange={(e) => handleChange('rotation', parseInt(e.target.value))}
          className="property-slider"
        />
      </div>

      <div className="property-group">
        <label>WIDTH: {localUpdates.width}px</label>
        <input
          type="range"
          min="50"
          max="2000"
          value={localUpdates.width || 200}
          onChange={(e) => handleChange('width', parseInt(e.target.value))}
          className="property-slider"
        />
        <label>HEIGHT: {localUpdates.height}px</label>
        <input
          type="range"
          min="50"
          max="2000"
          value={localUpdates.height || 200}
          onChange={(e) => handleChange('height', parseInt(e.target.value))}
          className="property-slider"
        />
      </div>

      <div className="property-group">
        <label>SCALE: {localUpdates.scale || 100}%</label>
        <input
          type="range"
          min="10"
          max="500"
          value={localUpdates.scale || 100}
          onChange={(e) => {
            const scale = parseInt(e.target.value);
            const baseWidth = element.width || 200;
            const baseHeight = element.height || 200;
            handleChange('scale', scale);
            handleChange('width', Math.round(baseWidth * scale / 100));
            handleChange('height', Math.round(baseHeight * scale / 100));
          }}
          className="property-slider"
        />
        <button 
          className="small-button" 
          onClick={() => {
            const baseWidth = element.width || 200;
            const baseHeight = element.height || 200;
            handleChange('scale', 100);
            handleChange('width', baseWidth);
            handleChange('height', baseHeight);
          }}
          style={{ marginTop: '10px' }}
        >
          RESET SCALE
        </button>
      </div>

      <div className="property-group">
        <label>Z-INDEX: {localUpdates.z_index}</label>
        <input
          type="range"
          min="1"
          max="100"
          value={localUpdates.z_index || 1}
          onChange={(e) => handleChange('z_index', parseInt(e.target.value))}
          className="property-slider"
        />
      </div>

      {element.type === 'text' && (
        <>
          <div className="property-group">
            <label>TEXT:</label>
            <input
              type="text"
              value={localUpdates.text_content || element.text_content || ''}
              onChange={(e) => handleChange('text_content', e.target.value)}
              className="property-input"
            />
          </div>
          <div className="property-group">
            <label>FONT:</label>
            <select
              value={localUpdates.font_family || element.font_family || 'JetBrains Mono'}
              onChange={(e) => handleChange('font_family', e.target.value)}
              className="property-input"
            >
              <option value="JetBrains Mono">JetBrains Mono</option>
              <option value="Admin Panel Font">Admin Panel Font</option>
              <option value="Logout Font">Logout Font</option>
              {fonts.map(font => (
                <option key={font.id} value={font.font_family}>{font.name}</option>
              ))}
            </select>
            <button onClick={onShowFontUpload} className="small-button">UPLOAD FONT</button>
          </div>
          <div className="property-group">
            <label>FONT SIZE: {localUpdates.font_size}px</label>
            <input
              type="range"
              min="8"
              max="200"
              value={localUpdates.font_size || 16}
              onChange={(e) => handleChange('font_size', parseInt(e.target.value))}
              className="property-slider"
            />
          </div>
          <div className="property-group">
            <label>WEIGHT:</label>
            <select
              value={localUpdates.font_weight}
              onChange={(e) => handleChange('font_weight', e.target.value)}
              className="property-input"
            >
              <option value="normal">Normal</option>
              <option value="bold">Bold</option>
              <option value="100">100</option>
              <option value="200">200</option>
              <option value="300">300</option>
              <option value="400">400</option>
              <option value="500">500</option>
              <option value="600">600</option>
              <option value="700">700</option>
              <option value="800">800</option>
              <option value="900">900</option>
            </select>
          </div>
          <div className="property-group">
            <label>STYLE:</label>
            <select
              value={localUpdates.font_style}
              onChange={(e) => handleChange('font_style', e.target.value)}
              className="property-input"
            >
              <option value="normal">Normal</option>
              <option value="italic">Italic</option>
            </select>
          </div>
          <div className="property-group">
            <label>COLOR:</label>
            <input
              type="color"
              value={localUpdates.color}
              onChange={(e) => handleChange('color', e.target.value)}
              className="property-input"
            />
          </div>
        </>
      )}

      {element.type !== 'text' && (
        <div className="property-group">
          <label>URL:</label>
          <input
            type="text"
            value={localUpdates.url}
            onChange={(e) => handleChange('url', e.target.value)}
            className="property-input"
          />
        </div>
      )}

      <div className="property-group">
        <label>
          <input
            type="checkbox"
            checked={localUpdates.is_locked || false}
            onChange={(e) => handleChange('is_locked', e.target.checked)}
            style={{ marginRight: '10px' }}
          />
          VERROUILLER (empêche le déplacement)
        </label>
      </div>

      {/* Visual Effects Section */}
      <div style={{ marginTop: '30px', paddingTop: '20px', borderTop: '1px solid #333' }}>
        <h4 style={{ color: '#ff00ff', marginBottom: '15px' }}>VISUAL EFFECTS</h4>
        
        <div className="property-group">
          <label>OPACITY: {((localUpdates.opacity || 1.0) * 100).toFixed(0)}%</label>
          <input
            type="range"
            min="0"
            max="100"
            value={((localUpdates.opacity || 1.0) * 100)}
            onChange={(e) => handleChange('opacity', parseFloat(e.target.value) / 100)}
            className="property-slider"
          />
        </div>

        <div className="property-group">
          <label>BLUR: {localUpdates.blur || 0}px</label>
          <input
            type="range"
            min="0"
            max="50"
            value={localUpdates.blur || 0}
            onChange={(e) => handleChange('blur', parseInt(e.target.value))}
            className="property-slider"
          />
        </div>

        <div className="property-group">
          <label>GLOW COLOR:</label>
          <input
            type="color"
            value={localUpdates.glow_color || '#ff00ff'}
            onChange={(e) => handleChange('glow_color', e.target.value)}
            className="property-input"
            style={{ width: '60px', marginRight: '10px' }}
          />
          <button 
            className="small-button"
            onClick={() => handleChange('glow_color', null)}
          >
            NONE
          </button>
        </div>

        <div className="property-group">
          <label>GLOW INTENSITY: {localUpdates.glow_intensity || 0}px</label>
          <input
            type="range"
            min="0"
            max="50"
            value={localUpdates.glow_intensity || 0}
            onChange={(e) => handleChange('glow_intensity', parseInt(e.target.value))}
            className="property-slider"
          />
        </div>

        <div className="property-group">
          <label>SHADOW COLOR:</label>
          <input
            type="color"
            value={localUpdates.shadow_color || '#000000'}
            onChange={(e) => handleChange('shadow_color', e.target.value)}
            className="property-input"
            style={{ width: '60px', marginRight: '10px' }}
          />
          <button 
            className="small-button"
            onClick={() => handleChange('shadow_color', null)}
          >
            NONE
          </button>
        </div>

        <div className="property-group">
          <label>SHADOW BLUR: {localUpdates.shadow_blur || 0}px</label>
          <input
            type="range"
            min="0"
            max="50"
            value={localUpdates.shadow_blur || 0}
            onChange={(e) => handleChange('shadow_blur', parseInt(e.target.value))}
            className="property-slider"
          />
        </div>

        <div className="property-group">
          <label>SHADOW X: {localUpdates.shadow_x || 0}px</label>
          <input
            type="range"
            min="-50"
            max="50"
            value={localUpdates.shadow_x || 0}
            onChange={(e) => handleChange('shadow_x', parseInt(e.target.value))}
            className="property-slider"
          />
          <label>SHADOW Y: {localUpdates.shadow_y || 0}px</label>
          <input
            type="range"
            min="-50"
            max="50"
            value={localUpdates.shadow_y || 0}
            onChange={(e) => handleChange('shadow_y', parseInt(e.target.value))}
            className="property-slider"
          />
        </div>
      </div>

      <button onClick={onDelete} className="delete-button">DELETE</button>
    </div>
  );
};

const PagesEditor = ({ pages, onUpdate }) => {
  const [editingPage, setEditingPage] = useState(null);
  const [editData, setEditData] = useState({ title: '', content: '' });

  const startEdit = (page) => {
    setEditingPage(page.page_number);
    setEditData({ title: page.title, content: page.content });
  };

  const saveEdit = () => {
    onUpdate(editingPage, editData.title, editData.content);
    setEditingPage(null);
  };

  return (
    <div className="pages-editor">
      <h4>EDIT BOOK PAGES</h4>
      {pages.map((page) => (
        <div key={page.id} className="page-edit-item">
          {editingPage === page.page_number ? (
            <>
              <input
                type="text"
                value={editData.title}
                onChange={(e) => setEditData({ ...editData, title: e.target.value })}
                className="property-input"
              />
              <textarea
                value={editData.content}
                onChange={(e) => setEditData({ ...editData, content: e.target.value })}
                className="property-textarea"
                rows="10"
              />
              <div className="edit-actions">
                <button onClick={saveEdit} className="small-button">SAVE</button>
                <button onClick={() => setEditingPage(null)} className="small-button">CANCEL</button>
              </div>
            </>
          ) : (
            <>
              <h5>PAGE {page.page_number}: {page.title}</h5>
              <button onClick={() => startEdit(page)} className="small-button">EDIT</button>
            </>
          )}
        </div>
      ))}
    </div>
  );
};

const TextEditor = ({ initialData, fonts, onSave, onCancel, onShowFontUpload }) => {
  const [textData, setTextData] = useState({
    text_content: initialData.text_content || 'NEW TEXT',
    position_x: initialData.position_x || 100,
    position_y: initialData.position_y || 100,
    rotation: initialData.rotation || 0,
    width: initialData.width || 200,
    height: initialData.height || 50,
    z_index: initialData.z_index || 1,
    font_family: initialData.font_family || 'JetBrains Mono',
    font_size: initialData.font_size || 16,
    font_weight: initialData.font_weight || 'normal',
    font_style: initialData.font_style || 'normal',
    color: initialData.color || '#ff00ff'
  });

  const handleChange = (field, value) => {
    const numFields = ['position_x', 'position_y', 'rotation', 'width', 'height', 'z_index', 'font_size'];
    const processedValue = numFields.includes(field) ? (parseInt(value) || 0) : value;
    setTextData({ ...textData, [field]: processedValue });
  };

  return (
    <div className="text-editor-modal">
      <div className="modal-content large">
        <h3>TEXT EDITOR</h3>
        
        <div className="property-group">
          <label>TEXT CONTENT:</label>
          <textarea
            value={textData.text_content}
            onChange={(e) => handleChange('text_content', e.target.value)}
            className="property-textarea"
            rows="8"
            placeholder="Enter your text here..."
          />
        </div>

        <div className="property-group">
          <label>FONT:</label>
          <select
            value={textData.font_family}
            onChange={(e) => handleChange('font_family', e.target.value)}
            className="property-input"
          >
            <option value="JetBrains Mono">JetBrains Mono</option>
            {fonts.map(font => (
              <option key={font.id} value={font.font_family}>{font.name}</option>
            ))}
          </select>
          <button onClick={onShowFontUpload} className="small-button">UPLOAD NEW FONT</button>
        </div>

        <div className="property-group">
          <label>FONT SIZE: {textData.font_size}px</label>
          <input
            type="range"
            min="8"
            max="200"
            value={textData.font_size || 16}
            onChange={(e) => handleChange('font_size', e.target.value)}
            className="property-slider"
          />
        </div>

        <div className="property-group">
          <label>WEIGHT:</label>
          <select
            value={textData.font_weight}
            onChange={(e) => handleChange('font_weight', e.target.value)}
            className="property-input"
          >
            <option value="normal">Normal</option>
            <option value="bold">Bold</option>
            <option value="100">100</option>
            <option value="200">200</option>
            <option value="300">300</option>
            <option value="400">400</option>
            <option value="500">500</option>
            <option value="600">600</option>
            <option value="700">700</option>
            <option value="800">800</option>
            <option value="900">900</option>
          </select>
        </div>

        <div className="property-group">
          <label>STYLE:</label>
          <select
            value={textData.font_style}
            onChange={(e) => handleChange('font_style', e.target.value)}
            className="property-input"
          >
            <option value="normal">Normal</option>
            <option value="italic">Italic</option>
          </select>
        </div>

        <div className="property-group">
          <label>COLOR:</label>
          <input
            type="color"
            value={textData.color}
            onChange={(e) => handleChange('color', e.target.value)}
            className="property-input"
            style={{ width: '60px', height: '30px' }}
          />
        </div>

        <div className="property-group">
          <label>POSITION X:</label>
          <input
            type="number"
            value={textData.position_x}
            onChange={(e) => handleChange('position_x', e.target.value)}
            className="property-input"
          />
          <label>Y:</label>
          <input
            type="number"
            value={textData.position_y}
            onChange={(e) => handleChange('position_y', e.target.value)}
            className="property-input"
          />
        </div>

        <div className="property-group">
          <label>ROTATION:</label>
          <input
            type="number"
            value={textData.rotation}
            onChange={(e) => handleChange('rotation', e.target.value)}
            className="property-input"
          />
        </div>

        <div className="property-group">
          <label>WIDTH:</label>
          <input
            type="number"
            value={textData.width}
            onChange={(e) => handleChange('width', e.target.value)}
            className="property-input"
          />
          <label>HEIGHT:</label>
          <input
            type="number"
            value={textData.height}
            onChange={(e) => handleChange('height', e.target.value)}
            className="property-input"
          />
        </div>

        <div className="property-group">
          <label>Z-INDEX:</label>
          <input
            type="number"
            value={textData.z_index}
            onChange={(e) => handleChange('z_index', e.target.value)}
            className="property-input"
          />
        </div>

        <div className="edit-actions">
          <button onClick={() => onSave(textData)} className="admin-button">SAVE TEXT</button>
          <button onClick={onCancel} className="admin-button secondary">CANCEL</button>
        </div>
      </div>
    </div>
  );
};

// BookMenuEditable - version of BookMenu with editable text elements
const BookMenuEditable = ({ pages = [], banners = [], user, textStyles = [], editMode, onTextElementClick, onTextElementMouseDown, onTextElementContextMenu, selectedTextElement, siteTexts = {} }) => {
  const [currentPage, setCurrentPage] = useState(0);
  const totalPages = pages && pages.length > 0 ? pages.length : 5;

  // Get style for a text element
  const getTextStyle = (pageNumber, elementType) => {
    const style = textStyles.find(s => s.page_number === pageNumber && s.element_type === elementType);
    return style || {
      font_family: 'JetBrains Mono',
      font_size: 16,
      font_weight: 'normal',
      font_style: 'normal',
      color: '#ff00ff'
    };
  };

  const isSelected = (pageNumber, elementType) => {
    return selectedTextElement && 
           selectedTextElement.pageNumber === pageNumber && 
           selectedTextElement.elementType === elementType;
  };

  return (
    <div className="book-container" style={{ 
      position: 'relative', 
      width: '100%', 
      minHeight: '100vh',
      padding: '20px',
      boxSizing: 'border-box',
      background: '#0a0a0a'
    }}>
      <div className="book-header">
        <div className="terminal-header">
          <div className="terminal-buttons">
          </div>
          <span className="terminal-title">{siteTexts.terminal_title || 'PROJECT_DOCUMENTATION.exe'}</span>
        </div>
        <div className="user-info">
          <span>{siteTexts.user_label || 'USER:'} {user?.username || 'ADMIN'}</span>
        </div>
      </div>

      <div className="book-wrapper">
        <div className="book">
          {pages.map((page, index) => {
            const isLeftPage = index % 2 === 0;
            const isTurned = index < currentPage;
            const isVisible = index === currentPage || index === currentPage + 1 || isTurned;
            const pageNumber = index + 1;
            
            const titleStyle = getTextStyle(pageNumber, 'title');
            const contentStyle = getTextStyle(pageNumber, 'content');
            const systemInfoStyle = getTextStyle(pageNumber, 'system-info');
            const pageNumberStyle = getTextStyle(pageNumber, 'page-number');
            
            return (
              <div
                key={index}
                data-page-index={index}
                data-page-number={pageNumber}
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
                      <div 
                        className="page-number"
                        data-text-element="page-number"
                        data-page-number={pageNumber}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (editMode && onTextElementClick) {
                            onTextElementClick(pageNumber, 'page-number');
                          }
                        }}
                        onMouseDown={(e) => {
                          if (editMode && onTextElementMouseDown) {
                            if (e.button !== 2) {
                              e.stopPropagation();
                            }
                            onTextElementMouseDown(pageNumber, 'page-number', e);
                          }
                        }}
                        onContextMenu={(e) => {
                          if (editMode && onTextElementContextMenu) {
                            e.preventDefault();
                            e.stopPropagation();
                            onTextElementContextMenu(pageNumber, 'page-number', e);
                          }
                        }}
                        style={{
                          fontFamily: pageNumberStyle.font_family,
                          fontSize: `${pageNumberStyle.font_size}px`,
                          fontWeight: pageNumberStyle.font_weight,
                          fontStyle: pageNumberStyle.font_style,
                          color: pageNumberStyle.color,
                          position: 'relative',
                          cursor: editMode ? 'pointer' : 'default'
                        }}
                      >
                        {editMode && (
                          <div className={`text-selection-box ${isSelected(pageNumber, 'page-number') ? 'selected' : ''}`}></div>
                        )}
                        {String(index + 1).padStart(2, '0')}/{String(totalPages).padStart(2, '0')}
                      </div>
                      <div 
                        className="page-title"
                        data-text-element="title"
                        data-page-number={pageNumber}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (editMode && onTextElementClick) {
                            onTextElementClick(pageNumber, 'title');
                          }
                        }}
                        onMouseDown={(e) => {
                          if (editMode && onTextElementMouseDown) {
                            if (e.button !== 2) {
                              e.stopPropagation();
                            }
                            onTextElementMouseDown(pageNumber, 'title', e);
                          }
                        }}
                        onContextMenu={(e) => {
                          if (editMode && onTextElementContextMenu) {
                            e.preventDefault();
                            e.stopPropagation();
                            onTextElementContextMenu(pageNumber, 'title', e);
                          }
                        }}
                        style={{
                          fontFamily: titleStyle.font_family,
                          fontSize: `${titleStyle.font_size}px`,
                          fontWeight: titleStyle.font_weight,
                          fontStyle: titleStyle.font_style,
                          color: titleStyle.color,
                          position: 'relative',
                          cursor: editMode ? 'pointer' : 'default'
                        }}
                      >
                        {editMode && (
                          <div className={`text-selection-box ${isSelected(pageNumber, 'title') ? 'selected' : ''}`}></div>
                        )}
                        {page.title}
                      </div>
                    </div>
                    <div className="page-body">
                      <pre 
                        className="terminal-text"
                        data-text-element="content"
                        data-page-number={pageNumber}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (editMode && onTextElementClick) {
                            onTextElementClick(pageNumber, 'content');
                          }
                        }}
                        onMouseDown={(e) => {
                          if (editMode && onTextElementMouseDown) {
                            if (e.button !== 2) {
                              e.stopPropagation();
                            }
                            onTextElementMouseDown(pageNumber, 'content', e);
                          }
                        }}
                        onContextMenu={(e) => {
                          if (editMode && onTextElementContextMenu) {
                            e.preventDefault();
                            e.stopPropagation();
                            onTextElementContextMenu(pageNumber, 'content', e);
                          }
                        }}
                        style={{
                          fontFamily: contentStyle.font_family,
                          fontSize: `${contentStyle.font_size}px`,
                          fontWeight: contentStyle.font_weight,
                          fontStyle: contentStyle.font_style,
                          color: contentStyle.color,
                          position: 'relative',
                          cursor: editMode ? 'pointer' : 'default'
                        }}
                      >
                        {editMode && (
                          <div className={`text-selection-box ${isSelected(pageNumber, 'content') ? 'selected' : ''}`}></div>
                        )}
                        {page.content}
                      </pre>
                    </div>
                    <div className="page-footer">
                      <div 
                        className="system-info"
                        data-text-element="system-info"
                        data-page-number={pageNumber}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (editMode && onTextElementClick) {
                            onTextElementClick(pageNumber, 'system-info');
                          }
                        }}
                        onMouseDown={(e) => {
                          if (editMode && onTextElementMouseDown) {
                            if (e.button !== 2) {
                              e.stopPropagation();
                            }
                            onTextElementMouseDown(pageNumber, 'system-info', e);
                          }
                        }}
                        onContextMenu={(e) => {
                          if (editMode && onTextElementContextMenu) {
                            e.preventDefault();
                            e.stopPropagation();
                            onTextElementContextMenu(pageNumber, 'system-info', e);
                          }
                        }}
                        style={{
                          fontFamily: systemInfoStyle.font_family,
                          fontSize: `${systemInfoStyle.font_size}px`,
                          fontWeight: systemInfoStyle.font_weight,
                          fontStyle: systemInfoStyle.font_style,
                          color: systemInfoStyle.color,
                          position: 'relative',
                          cursor: 'default' // Don't show pointer/move cursor for fixed original texts
                        }}
                      >
                        {editMode && (
                          <div className={`text-selection-box ${isSelected(pageNumber, 'system-info') ? 'selected' : ''}`}></div>
                        )}
                        {'>'} {siteTexts.system_info_prefix || 'SYSTEM: ONLINE | STATUS: ACTIVE | TIME:'} {new Date().toLocaleTimeString()}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="book-controls" style={{ pointerEvents: 'auto', zIndex: 10001 }}>
          <button
            className="nav-button prev"
            disabled={currentPage === 0}
            onClick={(e) => {
              e.stopPropagation();
              setCurrentPage(Math.max(0, currentPage - 1));
            }}
            style={{ pointerEvents: 'auto', cursor: currentPage === 0 ? 'not-allowed' : 'pointer' }}
          >
            <span className="arrow">←</span>
            <span className="button-text">{siteTexts.prev_button || 'PREV'}</span>
          </button>
          <div className="page-indicator" style={{ pointerEvents: 'auto' }}>
            {pages.map((_, index) => (
              <span
                key={index}
                className={`dot ${index === currentPage ? 'active' : ''}`}
                onClick={(e) => {
                  e.stopPropagation();
                  setCurrentPage(index);
                }}
                style={{ cursor: 'pointer', pointerEvents: 'auto' }}
              ></span>
            ))}
          </div>
          <button
            className="nav-button next"
            disabled={currentPage === totalPages - 1}
            onClick={(e) => {
              e.stopPropagation();
              setCurrentPage(Math.min(totalPages - 1, currentPage + 1));
            }}
            style={{ pointerEvents: 'auto', cursor: currentPage === totalPages - 1 ? 'not-allowed' : 'pointer' }}
          >
            <span className="button-text">{siteTexts.next_button || 'NEXT'}</span>
            <span className="arrow">→</span>
          </button>
        </div>
      </div>

      <div className="circuit-overlay"></div>
      
      {/* Banners overlay */}
      {banners.filter(b => b.is_active).map((banner) => {
        const fontStyle = banner.font_family && banner.font_family !== 'JetBrains Mono' 
          ? { fontFamily: `'${banner.font_family}', 'JetBrains Mono', monospace` }
          : { fontFamily: 'JetBrains Mono, monospace' };

        return (
          <div
            key={banner.id}
            className="banner-overlay"
            style={{
              position: 'absolute',
              left: `${banner.position_x || 0}px`,
              top: `${banner.position_y || 0}px`,
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
                  padding: '5px'
                }}
              >
                {banner.text_content}
              </div>
            ) : banner.type === 'gif' || banner.type === 'image' ? (
              <img
                src={buildAssetUrl(banner.url)}
                alt="Banner"
                style={{ width: '100%', height: '100%', objectFit: 'contain' }}
              />
            ) : null}
          </div>
        );
      })}
    </div>
  );
};

// TextElementEditor - editor for page text element styles and content
const TextElementEditor = ({ pageNumber, elementType, fonts, textStyles, bookPages, onUpdate, onShowFontUpload, onPageContentUpdate, selectedTextElement, banners }) => {
  const style = textStyles.find(s => s.page_number === pageNumber && s.element_type === elementType) || {
    font_family: 'JetBrains Mono',
    font_size: 16,
    font_weight: 'normal',
    font_style: 'normal',
    color: '#ff00ff'
  };

  const [updates, setUpdates] = useState({
    font_family: style.font_family,
    font_size: style.font_size,
    font_weight: style.font_weight,
    font_style: style.font_style,
    color: style.color,
    position_x: style.position_x !== undefined ? style.position_x : null,
    position_y: style.position_y !== undefined ? style.position_y : null,
    z_index: style.z_index !== undefined ? style.z_index : 1
  });

  // Content state for title and content - initialize empty, will be loaded by useEffect
  const [contentUpdates, setContentUpdates] = useState({
    title: '',
    content: ''
  });

  // Update styles when pageNumber, elementType, or textStyles changes
  useEffect(() => {
    const currentStyle = textStyles.find(s => s.page_number === pageNumber && s.element_type === elementType) || {
      font_family: 'JetBrains Mono',
      font_size: 16,
      font_weight: 'normal',
      font_style: 'normal',
      color: '#ff00ff'
    };
    setUpdates({
      font_family: currentStyle.font_family,
      font_size: currentStyle.font_size,
      font_weight: currentStyle.font_weight,
      font_style: currentStyle.font_style,
      color: currentStyle.color,
      position_x: currentStyle.position_x !== undefined ? currentStyle.position_x : null,
      position_y: currentStyle.position_y !== undefined ? currentStyle.position_y : null,
      z_index: currentStyle.z_index !== undefined ? currentStyle.z_index : 1
    });
  }, [pageNumber, elementType, textStyles]);

  const handleChange = (field, value) => {
    const numFields = ['font_size', 'z_index'];
    const processedValue = numFields.includes(field) ? (parseInt(value) || 0) : value;
    setUpdates({ ...updates, [field]: processedValue });
  };

  // Update content when pageNumber, elementType, bookPages, or selectedTextElement changes
  useEffect(() => {
    console.log('TextElementEditor: Loading content for page', pageNumber, 'elementType:', elementType);
    
    // If textarea, get content from banners
    if (elementType === 'textarea' && selectedTextElement?.bannerId && banners) {
      const banner = banners.find(b => b.id === selectedTextElement.bannerId);
      if (banner) {
        setContentUpdates({
          title: '',
          content: banner.text_content || ''
        });
        console.log('TextElementEditor: Textarea content loaded from banner');
        return;
      }
    }
    
    // For title and content, get from bookPages
    if (!bookPages || bookPages.length === 0) {
      console.log('TextElementEditor: bookPages is empty, waiting for data...');
      return;
    }
    const currentPage = bookPages.find(p => p.page_number === pageNumber);
    console.log('TextElementEditor: Found page:', currentPage);
    if (currentPage) {
      // Always update both title and content, but only show the relevant one in the UI
      setContentUpdates({
        title: currentPage.title || '',
        content: currentPage.content || ''
      });
      console.log('TextElementEditor: Content loaded - title:', currentPage.title?.substring(0, 50), 'content:', currentPage.content?.substring(0, 50));
    } else {
      // Reset if page not found
      console.log('TextElementEditor: Page not found, resetting content');
      setContentUpdates({
        title: '',
        content: ''
      });
    }
  }, [pageNumber, elementType, bookPages, selectedTextElement, banners]);

  const handleSave = async () => {
    try {
      console.log('TextElementEditor: Saving updates:', updates);
      console.log('TextElementEditor: Content updates:', contentUpdates);
      
      // Save style updates first - ensure all required fields are present
      // For textareas, styles are stored in banners, so onUpdate will handle it correctly
      if (onUpdate && updates) {
        // Make sure we have all required fields with valid values
        const styleUpdates = {
          font_family: updates.font_family || 'JetBrains Mono',
          font_size: updates.font_size !== undefined ? parseInt(updates.font_size) || 16 : 16,
          font_weight: updates.font_weight || 'normal',
          font_style: updates.font_style || 'normal',
          color: updates.color || '#ff00ff'
        };
        
        // Only include position for non-textarea elements (textareas use banner position)
        // For original book/site texts (system-info, page-number), NEVER update position - they must stay fixed
        const originalTextTypes = ['system-info', 'page-number'];
        if (elementType !== 'textarea' && !originalTextTypes.includes(elementType)) {
          // Get current style to preserve positions if not in updates
          const currentStyle = textStyles.find(s => s.page_number === pageNumber && s.element_type === elementType);
          const existingPositionX = currentStyle?.position_x;
          const existingPositionY = currentStyle?.position_y;
          
          // Use position from updates if provided, otherwise preserve existing position
          styleUpdates.position_x = updates.position_x !== undefined && updates.position_x !== null 
            ? parseInt(updates.position_x) 
            : (existingPositionX !== undefined && existingPositionX !== null ? existingPositionX : null);
          styleUpdates.position_y = updates.position_y !== undefined && updates.position_y !== null 
            ? parseInt(updates.position_y) 
            : (existingPositionY !== undefined && existingPositionY !== null ? existingPositionY : null);
        } else if (originalTextTypes.includes(elementType)) {
          // For original texts, always preserve existing position (never update it)
          const currentStyle = textStyles.find(s => s.page_number === pageNumber && s.element_type === elementType);
          styleUpdates.position_x = currentStyle?.position_x !== undefined && currentStyle?.position_x !== null 
            ? currentStyle.position_x 
            : null;
          styleUpdates.position_y = currentStyle?.position_y !== undefined && currentStyle?.position_y !== null 
            ? currentStyle.position_y 
            : null;
        }
        
        console.log('TextElementEditor: Sending style updates:', styleUpdates);
        await onUpdate(styleUpdates);
      }
      
      // Save content updates if title, content, or textarea element type
      if (elementType === 'textarea' && selectedTextElement?.bannerId) {
        // For textarea, update the banner's text_content directly
        const token = localStorage.getItem('token');
        if (!token) {
          throw new Error('No authentication token');
        }
        await axios.put(
          `/api/admin/banners/${selectedTextElement.bannerId}`,
          { text_content: contentUpdates.content || '' },
          {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            }
          }
        );
        // Reload elements to reflect changes
        if (window.__bookMenuReload) {
          window.__bookMenuReload();
        }
        console.log('Textarea content updated successfully');
      } else if (onPageContentUpdate && (elementType === 'title' || elementType === 'content')) {
        // For title element, only update title
        // For content element, only update content
        const contentToSave = elementType === 'title' 
          ? { title: contentUpdates.title || '' }
          : { content: contentUpdates.content || '' };
        
        console.log('Saving page content:', pageNumber, contentToSave);
        await onPageContentUpdate(pageNumber, contentToSave);
      }
      
      alert('Changes saved successfully!');
    } catch (error) {
      console.error('Error saving:', error);
      console.error('Error response:', error.response?.data);
      const errorMessage = error.response?.data?.details || error.response?.data?.error || error.message || 'Unknown error';
      alert('Error saving changes: ' + errorMessage);
      throw error; // Re-throw to allow parent to handle
    }
  };

  const elementNames = {
    'title': 'PAGE TITLE',
    'content': 'PAGE CONTENT',
    'system-info': 'SYSTEM INFO',
    'page-number': 'PAGE NUMBER',
    'textarea': 'PAGE TEXTAREA'
  };

  return (
    <div className="element-properties">
      <h3>EDIT {elementNames[elementType]} - PAGE {pageNumber}</h3>
      
      {/* Content editor for title and content */}
      {elementType === 'title' && (
        <div className="property-group">
          <label>TITLE TEXT:</label>
          <input
            type="text"
            value={contentUpdates.title}
            onChange={(e) => setContentUpdates({ ...contentUpdates, title: e.target.value })}
            className="property-input"
            style={{ width: '100%', padding: '10px' }}
          />
        </div>
      )}
      
      {elementType === 'content' && (
        <div className="property-group">
          <label>CONTENT TEXT:</label>
          <textarea
            value={contentUpdates.content}
            onChange={(e) => setContentUpdates({ ...contentUpdates, content: e.target.value })}
            className="property-input"
            style={{ width: '100%', minHeight: '200px', padding: '10px', fontFamily: 'JetBrains Mono' }}
          />
        </div>
      )}
      
      {elementType === 'textarea' && (
        <div className="property-group">
          <label>TEXTAREA CONTENT:</label>
          <textarea
            value={contentUpdates.content}
            onChange={(e) => setContentUpdates({ ...contentUpdates, content: e.target.value })}
            className="property-input"
            style={{ width: '100%', minHeight: '200px', padding: '10px', fontFamily: 'JetBrains Mono' }}
          />
        </div>
      )}
      
      {(elementType === 'system-info' || elementType === 'page-number') && (
        <div className="property-group">
          <label style={{ color: '#888' }}>
            {elementType === 'system-info' 
              ? 'NOTE: System info displays dynamic content (time, status). Only styles can be edited.'
              : 'NOTE: Page number is auto-generated. Only styles can be edited.'}
          </label>
          <button 
            onClick={async () => {
              if (window.confirm(`Reset position of ${elementType} on page ${pageNumber} to default?`)) {
                try {
                  const token = localStorage.getItem('token');
                  await axios.put(
                    `/api/admin/page-text-styles/${pageNumber}/${elementType}`,
                    { position_x: null, position_y: null },
                    {
                      headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                      }
                    }
                  );
                  // Reload text styles via onUpdate (which calls loadTextStyles)
                  if (onUpdate) {
                    await onUpdate({ position_x: null, position_y: null });
                  }
                  // Also reload BookMenu to show changes immediately
                  if (window.__bookMenuReload) {
                    window.__bookMenuReload();
                  }
                  // Update local state after reload
                  setUpdates({ ...updates, position_x: null, position_y: null });
                  alert('Position reset to default successfully!');
                } catch (error) {
                  console.error('Error resetting position:', error);
                  const errorMessage = error.response?.data?.details || error.response?.data?.error || error.message || 'Unknown error';
                  alert('Error resetting position: ' + errorMessage);
                }
              }
            }}
            className="admin-button"
            style={{ marginTop: '10px', fontSize: '11px', padding: '5px 10px' }}
          >
            RESET POSITION TO DEFAULT
          </button>
        </div>
      )}
      
      <div className="property-group">
        <label>FONT:</label>
        <select
          value={updates.font_family || 'JetBrains Mono'}
          onChange={(e) => handleChange('font_family', e.target.value)}
          className="property-input"
        >
          <option value="JetBrains Mono">JetBrains Mono</option>
          {fonts.map(font => (
            <option key={font.id} value={font.font_family}>{font.name}</option>
          ))}
        </select>
        <button onClick={onShowFontUpload} className="small-button">UPLOAD NEW FONT</button>
      </div>

      <div className="property-group">
        <label>FONT SIZE: {updates.font_size}px</label>
        <input
          type="range"
          min="8"
          max="200"
          value={updates.font_size || 16}
          onChange={(e) => handleChange('font_size', e.target.value)}
          className="property-slider"
        />
      </div>

      <div className="property-group">
        <label>WEIGHT:</label>
        <select
          value={updates.font_weight}
          onChange={(e) => handleChange('font_weight', e.target.value)}
          className="property-input"
        >
          <option value="normal">Normal</option>
          <option value="bold">Bold</option>
          <option value="100">100</option>
          <option value="200">200</option>
          <option value="300">300</option>
          <option value="400">400</option>
          <option value="500">500</option>
          <option value="600">600</option>
          <option value="700">700</option>
          <option value="800">800</option>
          <option value="900">900</option>
        </select>
      </div>

      <div className="property-group">
        <label>STYLE:</label>
        <select
          value={updates.font_style}
          onChange={(e) => handleChange('font_style', e.target.value)}
          className="property-input"
        >
          <option value="normal">Normal</option>
          <option value="italic">Italic</option>
        </select>
      </div>

      <div className="property-group">
        <label>COLOR:</label>
        <input
          type="color"
          value={updates.color}
          onChange={(e) => handleChange('color', e.target.value)}
          className="property-input"
          style={{ width: '60px', height: '30px' }}
        />
      </div>

      <div className="property-actions">
        <button onClick={handleSave} className="admin-button">SAVE</button>
      </div>
    </div>
  );
};

export default DesignMode;

