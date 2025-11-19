const express = require('express');
const cors = require('cors');
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors({ origin: '*' })); // Temporaire
app.use(express.json());

// Database connection
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || '3bplt'
};

let pool;

async function initDatabase() {
  try {
    pool = mysql.createPool({
      ...dbConfig,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0
    });

    // Create database if not exists
    const connection = await mysql.createConnection({
      host: dbConfig.host,
      user: dbConfig.user,
      password: dbConfig.password
    });
    
    await connection.query(`CREATE DATABASE IF NOT EXISTS ${dbConfig.database}`);
    await connection.end();

    // Create users table
    const dbConnection = await pool.getConnection();
    await dbConnection.query(`
      CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        username VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        role VARCHAR(50) DEFAULT 'user',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // Create applications table
    await dbConnection.query(`
      CREATE TABLE IF NOT EXISTS applications (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) NOT NULL,
        skills TEXT,
        message TEXT NOT NULL,
        status VARCHAR(50) DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);
    
    // Create banners table
    await dbConnection.query(`
      CREATE TABLE IF NOT EXISTS banners (
        id INT AUTO_INCREMENT PRIMARY KEY,
        type ENUM('image', 'gif', 'banner', 'text', 'textarea') NOT NULL,
        url VARCHAR(500) NOT NULL,
        position_x INT DEFAULT 0,
        position_y INT DEFAULT 0,
        rotation INT DEFAULT 0,
        width INT DEFAULT 200,
        height INT DEFAULT 200,
        z_index INT DEFAULT 1,
        is_active BOOLEAN DEFAULT true,
        page_number INT DEFAULT NULL,
        text_content TEXT,
        font_family VARCHAR(255),
        font_size INT DEFAULT 16,
        font_weight VARCHAR(50) DEFAULT 'normal',
        font_style VARCHAR(50) DEFAULT 'normal',
        color VARCHAR(50) DEFAULT '#ff00ff',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);
    
    // Add missing columns if they don't exist (migration for existing tables)
    // Check which columns exist and add missing ones
    try {
      const [columns] = await dbConnection.query(`
        SELECT COLUMN_NAME, COLUMN_TYPE 
        FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'banners'
      `, [dbConfig.database]);
      
      const existingColumns = columns.map(col => col.COLUMN_NAME);
      const columnsToAdd = [];
      
      if (!existingColumns.includes('text_content')) {
        columnsToAdd.push('text_content TEXT');
      }
      if (!existingColumns.includes('font_family')) {
        columnsToAdd.push('font_family VARCHAR(255)');
      }
      if (!existingColumns.includes('font_size')) {
        columnsToAdd.push('font_size INT DEFAULT 16');
      }
      if (!existingColumns.includes('font_weight')) {
        columnsToAdd.push('font_weight VARCHAR(50) DEFAULT \'normal\'');
      }
      if (!existingColumns.includes('font_style')) {
        columnsToAdd.push('font_style VARCHAR(50) DEFAULT \'normal\'');
      }
      if (!existingColumns.includes('color')) {
        columnsToAdd.push('color VARCHAR(50) DEFAULT \'#ff00ff\'');
      }
      if (!existingColumns.includes('is_locked')) {
        columnsToAdd.push('is_locked BOOLEAN DEFAULT false');
      }
      if (!existingColumns.includes('scale')) {
        columnsToAdd.push('scale INT DEFAULT 100');
      }
      if (!existingColumns.includes('page_number')) {
        columnsToAdd.push('page_number INT DEFAULT NULL');
      }
      if (!existingColumns.includes('glow_color')) {
        columnsToAdd.push('glow_color VARCHAR(50) DEFAULT NULL');
      }
      if (!existingColumns.includes('glow_intensity')) {
        columnsToAdd.push('glow_intensity INT DEFAULT 0');
      }
      if (!existingColumns.includes('shadow_color')) {
        columnsToAdd.push('shadow_color VARCHAR(50) DEFAULT NULL');
      }
      if (!existingColumns.includes('shadow_blur')) {
        columnsToAdd.push('shadow_blur INT DEFAULT 0');
      }
      if (!existingColumns.includes('shadow_x')) {
        columnsToAdd.push('shadow_x INT DEFAULT 0');
      }
      if (!existingColumns.includes('shadow_y')) {
        columnsToAdd.push('shadow_y INT DEFAULT 0');
      }
      if (!existingColumns.includes('opacity')) {
        columnsToAdd.push('opacity DECIMAL(3,2) DEFAULT 1.0');
      }
      if (!existingColumns.includes('blur')) {
        columnsToAdd.push('blur INT DEFAULT 0');
      }
      
      if (columnsToAdd.length > 0) {
        await dbConnection.query(`
          ALTER TABLE banners 
          ADD COLUMN ${columnsToAdd.join(', ADD COLUMN ')}
        `);
        console.log('Added missing columns to banners table:', columnsToAdd.map(c => c.split(' ')[0]).join(', '));
      }
      
      // Check and modify type column if needed
      const typeColumn = columns.find(col => col.COLUMN_NAME === 'type');
      if (typeColumn && typeColumn.COLUMN_TYPE && typeColumn.COLUMN_TYPE.includes('enum')) {
        console.log('Type column is ENUM:', typeColumn.COLUMN_TYPE);
        // Check if 'textarea' is already in the ENUM
        const enumValues = typeColumn.COLUMN_TYPE.match(/'([^']+)'/g) || [];
        const hasTextarea = enumValues.some(val => val.includes('textarea'));
        
        if (!hasTextarea) {
          // Try to modify ENUM to include 'textarea'
          try {
            await dbConnection.query(`
              ALTER TABLE banners 
              MODIFY COLUMN type ENUM('image', 'gif', 'banner', 'text', 'textarea') NOT NULL
            `);
            console.log('Updated type ENUM to include textarea');
          } catch (modifyError) {
            console.log('Could not modify type column:', modifyError.message);
            // If modification fails, try a different approach - drop and recreate
            try {
              console.log('Attempting to recreate type column...');
              // First, change to VARCHAR temporarily
              await dbConnection.query(`
                ALTER TABLE banners 
                MODIFY COLUMN type VARCHAR(50) NOT NULL
              `);
              // Then change back to ENUM with all values
              await dbConnection.query(`
                ALTER TABLE banners 
                MODIFY COLUMN type ENUM('image', 'gif', 'banner', 'text', 'textarea') NOT NULL
              `);
              console.log('Successfully recreated type ENUM with textarea');
            } catch (recreateError) {
              console.error('Could not recreate type column:', recreateError.message);
            }
          }
        } else {
          console.log('Type ENUM already includes textarea');
        }
      }
    } catch (error) {
      console.error('Error adding columns to banners table:', error.message);
    }
    
    // Create fonts table
    await dbConnection.query(`
      CREATE TABLE IF NOT EXISTS fonts (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        file_path VARCHAR(500) NOT NULL,
        font_family VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // Create book_pages table for editable content
    await dbConnection.query(`
      CREATE TABLE IF NOT EXISTS book_pages (
        id INT AUTO_INCREMENT PRIMARY KEY,
        page_number INT NOT NULL UNIQUE,
        title VARCHAR(255) NOT NULL,
        content TEXT NOT NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);
    
    // Insert default book pages if they don't exist
    const [existingPages] = await dbConnection.query('SELECT COUNT(*) as count FROM book_pages');
    if (existingPages[0].count === 0) {
      const defaultPages = [
        { page_number: 1, title: "WELCOME TO THE PROJECT", content: "> INITIALIZING SYSTEM...\n> LOADING PROJECT DATA...\n> CONNECTION ESTABLISHED\n\nWelcome, USER.\n\nYou have been granted access to our classified project documentation.\nThis interface contains critical information about our mission.\n\nNavigate using the arrow controls to proceed through the documentation.\n\n> STATUS: READY\n> AWAITING USER INPUT..." },
        { page_number: 2, title: "OUR MISSION", content: "> MISSION BRIEFING\n> CLASSIFIED DOCUMENTATION\n\nOur project represents a cutting-edge initiative in the realm of \ndigital innovation and technological advancement.\n\nWe are building a platform that bridges the gap between traditional \ncomputing paradigms and next-generation hardware interfaces.\n\nOur mission is to create solutions that are:\n- Efficient\n- Scalable  \n- Secure\n- Revolutionary\n\n> OBJECTIVE: TRANSFORM THE DIGITAL LANDSCAPE\n> PROCEED TO NEXT SECTION..." },
        { page_number: 3, title: "TECHNOLOGY STACK", content: "> SYSTEM ARCHITECTURE\n> TECHNOLOGY SPECIFICATIONS\n\nOur infrastructure is built on modern, robust technologies:\n\n[BACKEND]\n- Node.js & Express Framework\n- MySQL Database Architecture\n- RESTful API Design\n- JWT Authentication System\n\n[FRONTEND]\n- React.js Framework\n- Modern UI/UX Design\n- Responsive Architecture\n- Real-time Data Processing\n\n[SECURITY]\n- Encrypted Communications\n- Secure Authentication\n- Data Protection Protocols\n\n> SYSTEM STATUS: OPERATIONAL\n> ALL SYSTEMS NOMINAL..." },
        { page_number: 4, title: "TEAM & CULTURE", content: "> TEAM COMPOSITION\n> ORGANIZATIONAL STRUCTURE\n\nWe are a dynamic team of engineers, designers, and innovators\nworking together to push the boundaries of what's possible.\n\nOur culture values:\n- Innovation & Creativity\n- Collaboration & Communication\n- Continuous Learning\n- Technical Excellence\n\nWe believe in creating an environment where ideas flourish\nand technical challenges are met with enthusiasm.\n\n> TEAM STATUS: ACTIVE\n> RECRUITMENT: OPEN..." },
        { page_number: 5, title: "JOIN US", content: "> RECRUITMENT PROTOCOL\n> APPLICATION PROCESS\n\nWe are actively seeking talented individuals to join our mission.\n\nIf you are passionate about technology, innovation, and making\nan impact, we want to hear from you.\n\nWe're looking for:\n- Developers & Engineers\n- Designers & Creatives\n- Problem Solvers\n- Visionaries\n\nReady to take the next step?\n\n> PROCEED TO APPLICATION FORM\n> PRESS NEXT TO CONTINUE..." }
      ];
      
      for (const page of defaultPages) {
        await dbConnection.query(
          'INSERT INTO book_pages (page_number, title, content) VALUES (?, ?, ?)',
          [page.page_number, page.title, page.content]
        );
      }
    }
    
    // Insert default textareas for each page (one per page, locked and fixed position)
    const [existingTextareas] = await dbConnection.query(
      'SELECT COUNT(*) as count FROM banners WHERE type = ? AND page_number IS NOT NULL',
      ['textarea']
    );
    if (existingTextareas[0].count === 0) {
      // Get page content from book_pages to populate textareas
      const [pages] = await dbConnection.query('SELECT * FROM book_pages ORDER BY page_number');
      
      // Create one textarea per page (pages 1-5)
      // Position them centered (null = centered automatically)
      const defaultTextareas = [
        { page_number: 1, position_x: null, position_y: null, width: 325, height: 395 },
        { page_number: 2, position_x: null, position_y: null, width: 325, height: 395 },
        { page_number: 3, position_x: null, position_y: null, width: 325, height: 395 },
        { page_number: 4, position_x: null, position_y: null, width: 325, height: 395 },
        { page_number: 5, position_x: null, position_y: null, width: 325, height: 395 }
      ];
      
      for (const textarea of defaultTextareas) {
        // Find the corresponding page content
        const page = pages.find(p => p.page_number === textarea.page_number);
        const textContent = page ? page.content : '';
        
        await dbConnection.query(
          `INSERT INTO banners (type, url, position_x, position_y, rotation, width, height, z_index, is_active, 
            page_number, text_content, font_family, font_size, font_weight, font_style, color, is_locked, scale) 
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            'textarea',
            '', // No URL for textarea
            textarea.position_x,
            textarea.position_y,
            0, // No rotation
            textarea.width,
            textarea.height,
            10, // z_index
            true, // is_active
            textarea.page_number,
            textContent, // Use page content as default text
            'JetBrains Mono',
            16,
            'normal',
            'normal',
            '#ff00ff',
            true, // is_locked - they won't move
            100 // scale
          ]
        );
      }
      console.log('Inserted default textareas for book pages with page content');
    } else {
      // Update existing locked textareas to have correct position (centered: null, null) and size (325x395)
      const [existingTextareas] = await dbConnection.query(
        'SELECT id, page_number FROM banners WHERE type = ? AND page_number IS NOT NULL AND is_locked = ?',
        ['textarea', true]
      );
      
      for (const textarea of existingTextareas) {
        await dbConnection.query(
          'UPDATE banners SET position_x = ?, position_y = ?, width = ?, height = ? WHERE id = ?',
          [null, null, 325, 395, textarea.id]
        );
      }
      
      if (existingTextareas.length > 0) {
        console.log(`Updated ${existingTextareas.length} existing locked textareas to centered position with size 325x395`);
      }
    }
    
    // Create site_texts table for storing all editable site texts
    await dbConnection.query(`
      CREATE TABLE IF NOT EXISTS site_texts (
        id INT AUTO_INCREMENT PRIMARY KEY,
        text_key VARCHAR(255) UNIQUE NOT NULL,
        text_value TEXT NOT NULL,
        description VARCHAR(500),
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // Insert default site texts if they don't exist
    const [existingTexts] = await dbConnection.query('SELECT COUNT(*) as count FROM site_texts');
    if (existingTexts[0].count === 0) {
      const defaultTexts = [
        { text_key: 'terminal_title', text_value: 'PROJECT_DOCUMENTATION.exe', description: 'Title displayed in the terminal header' },
        { text_key: 'user_label', text_value: 'USER:', description: 'Label prefix for username display' },
        { text_key: 'admin_panel_link', text_value: 'ADMIN PANEL', description: 'Text for admin panel link' },
        { text_key: 'logout_button', text_value: 'LOGOUT', description: 'Text for logout button' },
        { text_key: 'prev_button', text_value: 'PREV', description: 'Text for previous page button' },
        { text_key: 'next_button', text_value: 'NEXT', description: 'Text for next page button' },
        { text_key: 'system_info_prefix', text_value: 'SYSTEM: ONLINE | STATUS: ACTIVE | TIME:', description: 'Prefix for system info display (TIME: will be appended automatically)' },
        { text_key: 'login_title', text_value: 'ACCESS GRANTED', description: 'Title on login page' },
        { text_key: 'login_username_label', text_value: 'USERNAME:', description: 'Username label on login form' },
        { text_key: 'login_password_label', text_value: 'PASSWORD:', description: 'Password label on login form' },
        { text_key: 'login_button', text_value: 'LOGIN', description: 'Login button text' },
        { text_key: 'login_connecting', text_value: 'CONNECTING...', description: 'Login button text when loading' },
        { text_key: 'login_no_account', text_value: 'No account?', description: 'Text before register link' },
        { text_key: 'login_register_link', text_value: 'REGISTER', description: 'Register link text' }
      ];
      
      for (const text of defaultTexts) {
        await dbConnection.query(
          'INSERT INTO site_texts (text_key, text_value, description) VALUES (?, ?, ?)',
          [text.text_key, text.text_value, text.description]
        );
      }
      console.log('Inserted default site texts');
    }
    
    // Create page_text_styles table for storing text element styles
    await dbConnection.query(`
      CREATE TABLE IF NOT EXISTS page_text_styles (
        id INT AUTO_INCREMENT PRIMARY KEY,
        page_number INT NOT NULL,
        element_type ENUM('title', 'content', 'system-info', 'page-number') NOT NULL,
        font_family VARCHAR(255) DEFAULT 'JetBrains Mono',
        font_size INT DEFAULT 16,
        font_weight VARCHAR(50) DEFAULT 'normal',
        font_style VARCHAR(50) DEFAULT 'normal',
        color VARCHAR(50) DEFAULT '#ff00ff',
        position_x INT DEFAULT NULL,
        position_y INT DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY unique_page_element (page_number, element_type)
      )
    `);
    
    // Add position columns if they don't exist (migration)
    try {
      const [pageTextColumns] = await dbConnection.query(`
        SELECT COLUMN_NAME 
        FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'page_text_styles'
      `, [dbConfig.database]);
      
      const existingPageTextColumns = pageTextColumns.map(col => col.COLUMN_NAME);
      const pageTextColumnsToAdd = [];
      
      if (!existingPageTextColumns.includes('position_x')) {
        pageTextColumnsToAdd.push('position_x INT DEFAULT NULL');
      }
      if (!existingPageTextColumns.includes('position_y')) {
        pageTextColumnsToAdd.push('position_y INT DEFAULT NULL');
      }
      
      if (pageTextColumnsToAdd.length > 0) {
        await dbConnection.query(`
          ALTER TABLE page_text_styles 
          ADD COLUMN ${pageTextColumnsToAdd.join(', ADD COLUMN ')}
        `);
        console.log('Added missing columns to page_text_styles table:', pageTextColumnsToAdd.map(c => c.split(' ')[0]).join(', '));
      }
    } catch (error) {
      console.error('Error adding columns to page_text_styles table:', error.message);
    }
    
    dbConnection.release();
    
    console.log('Database initialized successfully');
  } catch (error) {
    console.error('Database initialization error:', error);
  }
}

// Initialize database on startup
initDatabase();

// JWT Secret
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

// Auth middleware
const authenticateToken = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(403).json({ error: 'Invalid or expired token' });
  }
};

// Routes

// Register
app.post('/api/auth/register', async (req, res) => {
  try {
    const { username, password, role = 'user' } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const connection = await pool.getConnection();
    
    const [result] = await connection.query(
      'INSERT INTO users (username, password, role) VALUES (?, ?, ?)',
      [username, hashedPassword, role]
    );
    
    connection.release();

    const token = jwt.sign(
      { id: result.insertId, username, role },
      JWT_SECRET,
      { expiresIn: '15m' }
    );

    res.status(201).json({
      message: 'User created successfully',
      token,
      user: { id: result.insertId, username, role }
    });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ error: 'Username already exists' });
    }
    console.error('Register error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Login
app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    const connection = await pool.getConnection();
    const [users] = await connection.query(
      'SELECT * FROM users WHERE username = ?',
      [username]
    );
    connection.release();

    if (users.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = users[0];
    const isValidPassword = await bcrypt.compare(password, user.password);

    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role },
      JWT_SECRET,
      { expiresIn: '15m' }
    );

    res.json({
      message: 'Login successful',
      token,
      user: { id: user.id, username: user.username, role: user.role }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Refresh token (allows expired tokens to be refreshed)
app.post('/api/auth/refresh', async (req, res) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({ error: 'Access token required' });
    }

    // Try to decode the token even if expired
    let decoded;
    try {
      decoded = jwt.verify(token, JWT_SECRET);
    } catch (error) {
      // If token is expired, try to decode without verification
      if (error.name === 'TokenExpiredError') {
        decoded = jwt.decode(token);
      } else {
        return res.status(403).json({ error: 'Invalid token' });
      }
    }

    if (!decoded || !decoded.id) {
      return res.status(403).json({ error: 'Invalid token' });
    }

    // Verify user still exists
    const connection = await pool.getConnection();
    const [users] = await connection.query(
      'SELECT id, username, role FROM users WHERE id = ?',
      [decoded.id]
    );
    connection.release();

    if (users.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = users[0];

    // Generate new token with 15 minutes expiration
    const newToken = jwt.sign(
      { id: user.id, username: user.username, role: user.role },
      JWT_SECRET,
      { expiresIn: '15m' }
    );

    res.json({
      message: 'Token refreshed successfully',
      token: newToken,
      user: { id: user.id, username: user.username, role: user.role }
    });
  } catch (error) {
    console.error('Refresh token error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get current user
app.get('/api/auth/me', authenticateToken, async (req, res) => {
  try {
    const connection = await pool.getConnection();
    const [users] = await connection.query(
      'SELECT id, username, role FROM users WHERE id = ?',
      [req.user.id]
    );
    connection.release();

    if (users.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ user: users[0] });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// CRUD Users

// Get all users (admin only)
app.get('/api/users', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const connection = await pool.getConnection();
    const [users] = await connection.query(
      'SELECT id, username, role, created_at FROM users'
    );
    connection.release();

    res.json({ users });
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get user by ID
app.get('/api/users/:id', authenticateToken, async (req, res) => {
  try {
    const userId = parseInt(req.params.id);
    
    // Users can only view their own profile unless admin
    if (req.user.role !== 'admin' && req.user.id !== userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const connection = await pool.getConnection();
    const [users] = await connection.query(
      'SELECT id, username, role, created_at FROM users WHERE id = ?',
      [userId]
    );
    connection.release();

    if (users.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ user: users[0] });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update user
app.put('/api/users/:id', authenticateToken, async (req, res) => {
  try {
    const userId = parseInt(req.params.id);
    
    // Users can only update their own profile unless admin
    if (req.user.role !== 'admin' && req.user.id !== userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const { username, password, role } = req.body;
    const updates = [];
    const values = [];

    if (username) {
      updates.push('username = ?');
      values.push(username);
    }

    if (password) {
      const hashedPassword = await bcrypt.hash(password, 10);
      updates.push('password = ?');
      values.push(hashedPassword);
    }

    if (role && req.user.role === 'admin') {
      updates.push('role = ?');
      values.push(role);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    values.push(userId);

    const connection = await pool.getConnection();
    await connection.query(
      `UPDATE users SET ${updates.join(', ')} WHERE id = ?`,
      values
    );
    connection.release();

    res.json({ message: 'User updated successfully' });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ error: 'Username already exists' });
    }
    console.error('Update user error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete user
app.delete('/api/users/:id', authenticateToken, async (req, res) => {
  try {
    const userId = parseInt(req.params.id);
    
    // Only admin can delete users, or users can delete themselves
    if (req.user.role !== 'admin' && req.user.id !== userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const connection = await pool.getConnection();
    await connection.query('DELETE FROM users WHERE id = ?', [userId]);
    connection.release();

    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Application submission route
app.post('/api/applications', authenticateToken, async (req, res) => {
  try {
    const { name, email, message, skills } = req.body;
    
    if (!name || !email || !message) {
      return res.status(400).json({ error: 'Name, email, and message are required' });
    }

    const connection = await pool.getConnection();
    const [result] = await connection.query(
      'INSERT INTO applications (user_id, name, email, skills, message) VALUES (?, ?, ?, ?, ?)',
      [req.user.id, name, email, skills || '', message]
    );
    connection.release();
    
    res.status(201).json({
      message: 'Application submitted successfully',
      application: { 
        id: result.insertId,
        name, 
        email, 
        message, 
        skills, 
        userId: req.user.id 
      }
    });
  } catch (error) {
    console.error('Application submission error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get applications (admin only)
app.get('/api/applications', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const connection = await pool.getConnection();
    const [applications] = await connection.query(
      'SELECT a.*, u.username FROM applications a JOIN users u ON a.user_id = u.id ORDER BY a.created_at DESC'
    );
    connection.release();

    res.json({ applications });
  } catch (error) {
    console.error('Get applications error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Banners CRUD (Admin only)
app.get('/api/banners', async (req, res) => {
  try {
    const connection = await pool.getConnection();
    const [banners] = await connection.query(
      'SELECT * FROM banners WHERE is_active = true ORDER BY z_index, created_at DESC'
    );
    connection.release();
    res.json({ banners });
  } catch (error) {
    console.error('Get banners error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/admin/banners', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const connection = await pool.getConnection();
    const [banners] = await connection.query('SELECT * FROM banners ORDER BY created_at DESC');
    connection.release();
    res.json({ banners });
  } catch (error) {
    console.error('Get all banners error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/admin/banners', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    let { type, url, position_x, position_y, rotation, width, height, z_index, is_active, 
            text_content, font_family, font_size, font_weight, font_style, color, page_number, is_locked, scale,
            glow_color, glow_intensity, shadow_color, shadow_blur, shadow_x, shadow_y, opacity, blur } = req.body;
    
    // Normalize type to match ENUM values exactly
    if (type) {
      type = String(type).toLowerCase().trim();
      const validTypes = ['image', 'gif', 'banner', 'text', 'textarea'];
      if (!validTypes.includes(type)) {
        console.error('Invalid type received:', type, 'Valid types:', validTypes);
        return res.status(400).json({ error: `Invalid type "${type}". Must be one of: ${validTypes.join(', ')}` });
      }
    }
    
    console.log('Creating banner with data:', { 
      type: type, 
      typeLength: type ? type.length : 0,
      url: url ? url.substring(0, 50) : 'none', 
      text_content: text_content ? text_content.substring(0, 50) : 'none', 
      position_x, 
      position_y 
    });
    
    if (!type || type === '') {
      return res.status(400).json({ error: 'Type is required' });
    }

    // For non-text and non-textarea elements, URL is required
    if (type !== 'text' && type !== 'textarea' && (!url || url.trim() === '')) {
      return res.status(400).json({ error: `URL is required for ${type} elements` });
    }

    // For text and textarea elements, text_content is required
    if ((type === 'text' || type === 'textarea') && (!text_content || (typeof text_content === 'string' && text_content.trim() === ''))) {
      return res.status(400).json({ error: 'Text content is required for text and textarea elements' });
    }

    const connection = await pool.getConnection();
    
    // Log the exact values being inserted
    const insertValues = [
      type, 
      url || '', 
      parseInt(position_x) || 0, 
      parseInt(position_y) || 0, 
      parseInt(rotation) || 0, 
      parseInt(width) || 200, 
      parseInt(height) || 200, 
      parseInt(z_index) || 1, 
      is_active !== undefined ? is_active : true,
      page_number !== undefined && page_number !== null ? parseInt(page_number) : null,
      text_content || null,
      font_family || null,
      parseInt(font_size) || 16,
      font_weight || 'normal',
      font_style || 'normal',
      color || '#ff00ff',
      is_locked !== undefined ? Boolean(is_locked) : false,
      parseInt(scale) || 100,
      (glow_color !== undefined && glow_color !== null) ? String(glow_color) : null,
      (glow_intensity !== undefined && glow_intensity !== null) ? parseInt(glow_intensity) || 0 : 0,
      (shadow_color !== undefined && shadow_color !== null) ? String(shadow_color) : null,
      (shadow_blur !== undefined && shadow_blur !== null) ? parseInt(shadow_blur) || 0 : 0,
      (shadow_x !== undefined && shadow_x !== null) ? parseInt(shadow_x) || 0 : 0,
      (shadow_y !== undefined && shadow_y !== null) ? parseInt(shadow_y) || 0 : 0,
      (opacity !== undefined && opacity !== null) ? parseFloat(opacity) || 1.0 : 1.0,
      (blur !== undefined && blur !== null) ? parseInt(blur) || 0 : 0
    ];
    
    console.log('Inserting values:', {
      type: insertValues[0],
      typeType: typeof insertValues[0],
      url: insertValues[1],
      page_number: insertValues[9],
      is_locked: insertValues[17],
      scale: insertValues[18]
    });
    
    const [result] = await connection.query(
      `INSERT INTO banners (type, url, position_x, position_y, rotation, width, height, z_index, is_active, 
        page_number, text_content, font_family, font_size, font_weight, font_style, color, is_locked, scale,
        glow_color, glow_intensity, shadow_color, shadow_blur, shadow_x, shadow_y, opacity, blur) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      insertValues
    );
    
    const [newBanner] = await connection.query('SELECT * FROM banners WHERE id = ?', [result.insertId]);
    connection.release();

    res.status(201).json({ 
      message: 'Banner created successfully',
      banner: newBanner[0]
    });
  } catch (error) {
    console.error('Create banner error:', error);
    console.error('Request body:', req.body);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

app.put('/api/admin/banners/:id', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { position_x, position_y, rotation, width, height, z_index, is_active, url,
            text_content, font_family, font_size, font_weight, font_style, color, is_locked, scale, page_number,
            glow_color, glow_intensity, shadow_color, shadow_blur, shadow_x, shadow_y, opacity, blur } = req.body;
    const bannerId = parseInt(req.params.id);

    const updates = [];
    const values = [];

    if (position_x !== undefined) { updates.push('position_x = ?'); values.push(parseInt(position_x) || 0); }
    if (position_y !== undefined) { updates.push('position_y = ?'); values.push(parseInt(position_y) || 0); }
    if (rotation !== undefined) { updates.push('rotation = ?'); values.push(parseInt(rotation) || 0); }
    if (width !== undefined) { updates.push('width = ?'); values.push(parseInt(width) || 200); }
    if (height !== undefined) { updates.push('height = ?'); values.push(parseInt(height) || 200); }
    if (z_index !== undefined) { updates.push('z_index = ?'); values.push(parseInt(z_index) || 1); }
    if (is_active !== undefined) { updates.push('is_active = ?'); values.push(Boolean(is_active)); }
    if (url !== undefined && url !== null) { updates.push('url = ?'); values.push(String(url)); }
    // Handle text_content - allow null or empty string
    if (text_content !== undefined) { 
      updates.push('text_content = ?'); 
      values.push(text_content === null || text_content === '' ? null : String(text_content)); 
    }
    if (font_family !== undefined && font_family !== null) { updates.push('font_family = ?'); values.push(String(font_family)); }
    if (font_size !== undefined) { updates.push('font_size = ?'); values.push(parseInt(font_size) || 16); }
    if (font_weight !== undefined && font_weight !== null) { updates.push('font_weight = ?'); values.push(String(font_weight)); }
    if (font_style !== undefined && font_style !== null) { updates.push('font_style = ?'); values.push(String(font_style)); }
    if (color !== undefined && color !== null) { updates.push('color = ?'); values.push(String(color)); }
    if (is_locked !== undefined) { updates.push('is_locked = ?'); values.push(Boolean(is_locked)); }
    if (scale !== undefined) { updates.push('scale = ?'); values.push(parseInt(scale) || 100); }
    if (page_number !== undefined) { updates.push('page_number = ?'); values.push(page_number !== null && page_number !== '' ? parseInt(page_number) : null); }
    if (glow_color !== undefined) { updates.push('glow_color = ?'); values.push(glow_color === null || glow_color === '' ? null : String(glow_color)); }
    if (glow_intensity !== undefined) { updates.push('glow_intensity = ?'); values.push(parseInt(glow_intensity) || 0); }
    if (shadow_color !== undefined) { updates.push('shadow_color = ?'); values.push(shadow_color === null || shadow_color === '' ? null : String(shadow_color)); }
    if (shadow_blur !== undefined) { updates.push('shadow_blur = ?'); values.push(parseInt(shadow_blur) || 0); }
    if (shadow_x !== undefined) { updates.push('shadow_x = ?'); values.push(parseInt(shadow_x) || 0); }
    if (shadow_y !== undefined) { updates.push('shadow_y = ?'); values.push(parseInt(shadow_y) || 0); }
    if (opacity !== undefined) { updates.push('opacity = ?'); values.push(parseFloat(opacity) || 1.0); }
    if (blur !== undefined) { updates.push('blur = ?'); values.push(parseInt(blur) || 0); }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    values.push(bannerId);

    const connection = await pool.getConnection();
    
    // Log the update query for debugging
    console.log('Updating banner:', bannerId);
    console.log('Updates:', updates);
    console.log('Values:', values);
    
    try {
      await connection.query(
        `UPDATE banners SET ${updates.join(', ')} WHERE id = ?`,
        values
      );
      connection.release();

      res.json({ message: 'Banner updated successfully' });
    } catch (dbError) {
      connection.release();
      console.error('Database update error:', dbError);
      console.error('SQL Error:', dbError.sqlMessage || dbError.message);
      console.error('SQL State:', dbError.sqlState);
      throw dbError; // Re-throw to be caught by outer catch
    }
  } catch (error) {
    console.error('Update banner error:', error);
    console.error('Error details:', error.message, error.stack);
    console.error('Request body:', req.body);
    console.error('Banner ID:', req.params.id);
    res.status(500).json({ 
      error: 'Internal server error',
      details: error.message,
      sqlMessage: error.sqlMessage || null,
      sqlState: error.sqlState || null
    });
  }
});

app.delete('/api/admin/banners/:id', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const bannerId = parseInt(req.params.id);
    const connection = await pool.getConnection();
    await connection.query('DELETE FROM banners WHERE id = ?', [bannerId]);
    connection.release();

    res.json({ message: 'Banner deleted successfully' });
  } catch (error) {
    console.error('Delete banner error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Book Pages CRUD (Admin only)
app.get('/api/book-pages', async (req, res) => {
  try {
    const connection = await pool.getConnection();
    const [pages] = await connection.query('SELECT * FROM book_pages ORDER BY page_number');
    connection.release();
    res.json({ pages });
  } catch (error) {
    console.error('Get book pages error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.put('/api/admin/book-pages/:pageNumber', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { title, content } = req.body;
    const pageNumber = parseInt(req.params.pageNumber);

    // Allow partial updates - only update provided fields
    const updates = [];
    const values = [];

    if (title !== undefined) {
      updates.push('title = ?');
      values.push(title);
    }
    if (content !== undefined) {
      updates.push('content = ?');
      values.push(content);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    values.push(pageNumber);

    const connection = await pool.getConnection();
    await connection.query(
      `UPDATE book_pages SET ${updates.join(', ')} WHERE page_number = ?`,
      values
    );
    connection.release();

    res.json({ message: 'Book page updated successfully' });
  } catch (error) {
    console.error('Update book page error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Site Texts CRUD
app.get('/api/site-texts', async (req, res) => {
  try {
    const connection = await pool.getConnection();
    const [texts] = await connection.query('SELECT * FROM site_texts ORDER BY text_key');
    connection.release();
    
    // Convert array to object for easier access
    const textsObject = {};
    texts.forEach(text => {
      textsObject[text.text_key] = text.text_value;
    });
    
    res.json({ texts: textsObject, allTexts: texts });
  } catch (error) {
    console.error('Get site texts error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.put('/api/admin/site-texts/:textKey', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { text_value } = req.body;
    const textKey = req.params.textKey;

    if (!text_value) {
      return res.status(400).json({ error: 'text_value is required' });
    }

    const connection = await pool.getConnection();
    
    // Check if text exists
    const [existing] = await connection.query('SELECT * FROM site_texts WHERE text_key = ?', [textKey]);
    
    if (existing.length === 0) {
      connection.release();
      return res.status(404).json({ error: 'Text key not found' });
    }
    
    await connection.query(
      'UPDATE site_texts SET text_value = ? WHERE text_key = ?',
      [text_value, textKey]
    );
    connection.release();

    res.json({ message: 'Site text updated successfully' });
  } catch (error) {
    console.error('Update site text error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Page Text Styles CRUD (Admin only)
app.get('/api/page-text-styles', async (req, res) => {
  try {
    const connection = await pool.getConnection();
    const [styles] = await connection.query('SELECT * FROM page_text_styles ORDER BY page_number, element_type');
    connection.release();
    res.json({ styles });
  } catch (error) {
    console.error('Get page text styles error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.put('/api/admin/page-text-styles/:pageNumber/:elementType', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { font_family, font_size, font_weight, font_style, color, position_x, position_y } = req.body;
    const pageNumber = parseInt(req.params.pageNumber);
    const elementType = req.params.elementType;

    console.log('Updating page text style:', pageNumber, elementType, req.body);

    const connection = await pool.getConnection();
    
    // First, check if the record exists
    const [existing] = await connection.query(
      'SELECT * FROM page_text_styles WHERE page_number = ? AND element_type = ?',
      [pageNumber, elementType]
    );
    
    // Prepare values - use provided values or keep existing/default values
    const values = {
      page_number: pageNumber,
      element_type: elementType,
      font_family: font_family !== undefined ? font_family : (existing[0]?.font_family || 'JetBrains Mono'),
      font_size: font_size !== undefined ? parseInt(font_size) : (existing[0]?.font_size || 16),
      font_weight: font_weight !== undefined ? font_weight : (existing[0]?.font_weight || 'normal'),
      font_style: font_style !== undefined ? font_style : (existing[0]?.font_style || 'normal'),
      color: color !== undefined ? color : (existing[0]?.color || '#ff00ff'),
      position_x: position_x !== undefined && position_x !== null ? parseInt(position_x) : (existing[0]?.position_x ?? null),
      position_y: position_y !== undefined && position_y !== null ? parseInt(position_y) : (existing[0]?.position_y ?? null)
    };
    
    // Use INSERT ... ON DUPLICATE KEY UPDATE
    await connection.query(`
      INSERT INTO page_text_styles (page_number, element_type, font_family, font_size, font_weight, font_style, color, position_x, position_y)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        font_family = VALUES(font_family),
        font_size = VALUES(font_size),
        font_weight = VALUES(font_weight),
        font_style = VALUES(font_style),
        color = VALUES(color),
        position_x = VALUES(position_x),
        position_y = VALUES(position_y)
    `, [
      values.page_number,
      values.element_type,
      values.font_family,
      values.font_size,
      values.font_weight,
      values.font_style,
      values.color,
      values.position_x,
      values.position_y
    ]);
    
    connection.release();
    res.json({ message: 'Text style updated successfully' });
  } catch (error) {
    console.error('Update page text style error:', error);
    console.error('Error details:', error.message, error.stack);
    res.status(500).json({ 
      error: 'Internal server error',
      details: error.message 
    });
  }
});

// Fonts CRUD (Admin only)
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const cloudinary = require('cloudinary').v2;
const sharp = require('sharp');

// Configure Cloudinary - REQUIRED for cloud storage
const useCloudinary = process.env.CLOUDINARY_CLOUD_NAME && 
                      process.env.CLOUDINARY_API_KEY && 
                      process.env.CLOUDINARY_API_SECRET;

// Debug: Log environment variables (without showing secrets)
console.log('🔍 Cloudinary Configuration Check:');
console.log('   CLOUDINARY_CLOUD_NAME:', process.env.CLOUDINARY_CLOUD_NAME ? '✅ Set' : '❌ Missing');
console.log('   CLOUDINARY_API_KEY:', process.env.CLOUDINARY_API_KEY ? '✅ Set' : '❌ Missing');
console.log('   CLOUDINARY_API_SECRET:', process.env.CLOUDINARY_API_SECRET ? '✅ Set' : '❌ Missing');

if (useCloudinary) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
  });
  console.log('✅ Cloudinary configured - using cloud storage with optimization');
  console.log('   Cloud Name:', process.env.CLOUDINARY_CLOUD_NAME);
  console.log('   API Key:', process.env.CLOUDINARY_API_KEY);
} else {
  console.log('⚠️  Cloudinary not configured - using local storage');
  console.log('   Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET to use cloud storage');
}

// Create uploads directories if they don't exist (fallback for local storage)
const uploadsDir = path.join(__dirname, 'uploads');
const fontsDir = path.join(uploadsDir, 'fonts');
const imagesDir = path.join(uploadsDir, 'images');

// Always create upload directories (needed for fallback even if using Cloudinary)
if (!fs.existsSync(fontsDir)) {
  fs.mkdirSync(fontsDir, { recursive: true });
  console.log('📁 Created fonts directory');
}
if (!fs.existsSync(imagesDir)) {
  fs.mkdirSync(imagesDir, { recursive: true });
  console.log('📁 Created images directory');
}

// Helper function to upload to Cloudinary
const uploadToCloudinary = async (buffer, folder, options = {}) => {
  console.log(`🚀 uploadToCloudinary called - folder: ${folder}, buffer size: ${(buffer.length / 1024).toFixed(2)} KB`);
  
  if (!useCloudinary) {
    console.error('❌ Cloudinary is not configured in uploadToCloudinary');
    throw new Error('Cloudinary is not configured');
  }

  console.log('☁️  Starting Cloudinary upload stream...');
  return new Promise((resolve, reject) => {
    const uploadOptions = {
      folder: folder,
      resource_type: 'auto',
      use_filename: false,
      unique_filename: true,
      overwrite: false,
      ...options
    };

    console.log('   Upload options:', JSON.stringify(uploadOptions, null, 2));

    const uploadStream = cloudinary.uploader.upload_stream(uploadOptions, (error, result) => {
      if (error) {
        console.error('❌ Cloudinary upload stream error:', error);
        console.error('   Error message:', error.message);
        console.error('   Error http_code:', error.http_code);
        reject(error);
      } else {
        console.log(`✅ Uploaded to Cloudinary: ${result.secure_url}`);
        console.log('   Result:', JSON.stringify({
          public_id: result.public_id,
          format: result.format,
          bytes: result.bytes,
          width: result.width,
          height: result.height
        }, null, 2));
        resolve(result);
      }
    });
    
    uploadStream.end(buffer);
    console.log('   Buffer sent to upload stream');
  });
};

// Helper function to optimize image before upload
const optimizeImage = async (buffer, maxWidth = 1920, quality = 85) => {
  try {
    // Check if sharp is available
    if (!sharp) {
      console.warn('⚠️  Sharp not available, skipping optimization');
      return buffer;
    }
    
    const image = sharp(buffer);
    const metadata = await image.metadata();
    
    // Resize if too large
    if (metadata.width > maxWidth) {
      image.resize(maxWidth, null, { withoutEnlargement: true });
    }
    
    // Convert to WebP for better compression (fallback to JPEG if WebP not supported)
    return await image
      .webp({ quality: quality })
      .toBuffer()
      .catch(() => image.jpeg({ quality: quality }).toBuffer());
  } catch (error) {
    console.error('⚠️  Image optimization error:', error.message);
    console.error('   Returning original buffer without optimization');
    return buffer; // Return original if optimization fails
  }
};

// Multer storage configuration
// Use memory storage for Cloudinary, disk storage for local fallback
const fontStorage = useCloudinary 
  ? multer.memoryStorage()
  : multer.diskStorage({
      destination: (req, file, cb) => {
        cb(null, fontsDir);
      },
      filename: (req, file, cb) => {
        const uniqueName = `${Date.now()}-${file.originalname}`;
        cb(null, uniqueName);
      }
    });

const imageStorage = useCloudinary
  ? multer.memoryStorage()
  : multer.diskStorage({
      destination: (req, file, cb) => {
        cb(null, imagesDir);
      },
      filename: (req, file, cb) => {
        const uniqueName = `${Date.now()}-${file.originalname}`;
        cb(null, uniqueName);
      }
    });

const fontUpload = multer({ 
  storage: fontStorage,
  fileFilter: (req, file, cb) => {
    // Accept various MIME types for fonts and check file extension
    const validMimeTypes = [
      'font/ttf', 'font/otf',
      'application/font-ttf', 'application/font-otf',
      'application/x-font-ttf', 'application/x-font-otf',
      'application/x-font-truetype', 'application/x-font-opentype',
      'font/truetype', 'font/opentype'
    ];
    
    if (validMimeTypes.includes(file.mimetype) || 
        file.originalname.match(/\.(ttf|otf)$/i)) {
      cb(null, true);
    } else {
      cb(new Error('Only .ttf and .otf files are allowed'));
    }
  },
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

const imageUpload = multer({ 
  storage: imageStorage,
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/') || 
        file.originalname.match(/\.(jpg|jpeg|png|gif|webp|svg)$/i)) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  },
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

// Public fonts endpoint (for loading fonts on frontend)
app.get('/api/fonts', async (req, res) => {
  try {
    const connection = await pool.getConnection();
    const [fonts] = await connection.query('SELECT * FROM fonts ORDER BY created_at DESC');
    connection.release();
    res.json({ fonts });
  } catch (error) {
    console.error('Get fonts error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/admin/fonts', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const connection = await pool.getConnection();
    const [fonts] = await connection.query('SELECT * FROM fonts ORDER BY created_at DESC');
    connection.release();
    res.json({ fonts });
  } catch (error) {
    console.error('Get fonts error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/admin/fonts', authenticateToken, fontUpload.single('font'), async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'Font file is required' });
    }

    const { name } = req.body;
    let filePath;
    
    // Get file buffer (from memory storage) or read from disk
    let fileBuffer;
    if (req.file.buffer) {
      fileBuffer = req.file.buffer;
    } else {
      // Read from disk if using disk storage
      fileBuffer = fs.readFileSync(req.file.path);
    }
    
    // Upload to Cloudinary (preferred) or use local storage as fallback
    console.log('🔍 Font upload check - useCloudinary:', useCloudinary);
    if (useCloudinary) {
      console.log('☁️  Attempting to upload font to Cloudinary...');
      try {
        const result = await uploadToCloudinary(fileBuffer, 'fonts', {
          public_id: `font_${Date.now()}_${req.file.originalname.replace(/\.(ttf|otf)$/i, '')}`,
          resource_type: 'raw', // Fonts are raw files
          format: 'ttf' // Preserve font format
        });
        filePath = result.secure_url;
        console.log('✅ Font uploaded to Cloudinary:', filePath);
        // Clean up temporary file if using disk storage
        if (req.file.path && fs.existsSync(req.file.path)) {
          fs.unlinkSync(req.file.path);
        }
      } catch (cloudinaryError) {
        console.error('❌ Cloudinary upload failed:', cloudinaryError);
        console.error('   Error details:', cloudinaryError.message);
        console.error('   Stack:', cloudinaryError.stack);
        // Fallback to local storage only if Cloudinary fails
        console.log('⚠️  Falling back to local storage...');
        const uniqueName = `${Date.now()}-${req.file.originalname}`;
        const localPath = path.join(fontsDir, uniqueName);
        if (!fs.existsSync(localPath)) {
          fs.writeFileSync(localPath, fileBuffer);
        }
        filePath = `/uploads/fonts/${uniqueName}`;
        console.log('📁 Font saved locally (Cloudinary fallback):', filePath);
      }
    } else {
      // Local storage only (Cloudinary not configured)
      console.log('📁 Cloudinary not configured, using local storage');
      filePath = `/uploads/fonts/${req.file.filename}`;
      console.log('📁 Font saved locally:', filePath);
    }
    
    // Clean font name: remove extension and sanitize
    let fontFamily = name || req.file.originalname.replace(/\.(ttf|otf)$/i, '');
    // Remove spaces and special characters, keep only alphanumeric and hyphens/underscores
    fontFamily = fontFamily.replace(/[^a-zA-Z0-9_-]/g, '').replace(/\s+/g, '');
    // Ensure it's not empty
    if (!fontFamily || fontFamily.length === 0) {
      fontFamily = 'CustomFont' + Date.now();
    }
    
    // Use original name for display, cleaned name for font_family
    const displayName = name || req.file.originalname.replace(/\.(ttf|otf)$/i, '');

    console.log('Uploading font:', { displayName, fontFamily, filePath });

    const connection = await pool.getConnection();
    const [result] = await connection.query(
      'INSERT INTO fonts (name, file_path, font_family) VALUES (?, ?, ?)',
      [displayName, filePath, fontFamily]
    );
    connection.release();

    res.status(201).json({
      message: 'Font uploaded successfully',
      font: { 
        id: result.insertId, 
        name: displayName, 
        file_path: filePath, 
        font_family: fontFamily 
      }
    });
  } catch (error) {
    console.error('Upload font error:', error);
    // If multer error, return specific message
    if (error.message && error.message.includes('Only .ttf and .otf')) {
      return res.status(400).json({ error: error.message });
    }
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// Image upload endpoint
app.post('/api/admin/images', authenticateToken, imageUpload.single('image'), async (req, res) => {
  console.log('\n========================================');
  console.log('📤 IMAGE UPLOAD ENDPOINT CALLED');
  console.log('========================================');
  console.log('File received:', req.file ? `${req.file.originalname} (${(req.file.size / 1024).toFixed(2)} KB)` : 'NO FILE');
  console.log('MIME type:', req.file?.mimetype || 'N/A');
  console.log('useCloudinary:', useCloudinary ? '✅ TRUE' : '❌ FALSE');
  
  // Log Cloudinary config status
  if (!useCloudinary) {
    console.log('\n⚠️  CLOUDINARY NOT CONFIGURED - CHECK ENVIRONMENT VARIABLES:');
    console.log('   CLOUDINARY_CLOUD_NAME:', process.env.CLOUDINARY_CLOUD_NAME ? '✅ Set' : '❌ Missing');
    console.log('   CLOUDINARY_API_KEY:', process.env.CLOUDINARY_API_KEY ? '✅ Set' : '❌ Missing');
    console.log('   CLOUDINARY_API_SECRET:', process.env.CLOUDINARY_API_SECRET ? '✅ Set' : '❌ Missing');
  }
  console.log('========================================\n');
  
  try {
    if (req.user.role !== 'admin') {
      console.log('❌ Admin access required');
      return res.status(403).json({ error: 'Admin access required' });
    }

    if (!req.file) {
      console.log('❌ No file provided');
      return res.status(400).json({ error: 'Image file is required' });
    }

    let filePath;
    let storageType = 'local'; // 'cloudinary' or 'local'
    let cloudinaryError = null;
    
    // Get file buffer (from memory storage) or read from disk
    let originalBuffer;
    try {
      if (req.file.buffer) {
        originalBuffer = req.file.buffer;
        console.log('✅ Using memory buffer (size:', (originalBuffer.length / 1024).toFixed(2), 'KB)');
      } else if (req.file.path) {
        // Read from disk if using disk storage
        originalBuffer = fs.readFileSync(req.file.path);
        console.log('✅ Read from disk (path:', req.file.path, ', size:', (originalBuffer.length / 1024).toFixed(2), 'KB)');
      } else {
        throw new Error('No file buffer or path available');
      }
    } catch (bufferError) {
      console.error('❌ Error reading file buffer:', bufferError);
      return res.status(500).json({ 
        error: 'Failed to read uploaded file',
        details: bufferError.message 
      });
    }
    
    let optimizedBuffer = originalBuffer;

    // Optimize image before upload (reduce size)
    if (req.file.mimetype.startsWith('image/') && !req.file.mimetype.includes('svg')) {
      try {
        optimizedBuffer = await optimizeImage(originalBuffer, 1920, 85);
        console.log('✅ Image optimized:', {
          original: (originalBuffer.length / 1024).toFixed(2) + ' KB',
          optimized: (optimizedBuffer.length / 1024).toFixed(2) + ' KB',
          reduction: ((1 - optimizedBuffer.length / originalBuffer.length) * 100).toFixed(1) + '%'
        });
      } catch (optError) {
        console.error('⚠️  Image optimization error:', optError.message);
        optimizedBuffer = originalBuffer; // Use original if optimization fails
      }
    }

    // Upload to Cloudinary (preferred) or use local storage as fallback
    if (useCloudinary) {
      console.log('\n☁️  ATTEMPTING CLOUDINARY UPLOAD...');
      try {
        const result = await uploadToCloudinary(optimizedBuffer, 'images', {
          public_id: `img_${Date.now()}`,
          format: 'auto', // Auto format (WebP if supported by browser)
          quality: 'auto:good', // Auto quality optimization (good balance)
          fetch_format: 'auto', // Serve best format for browser
          transformation: [
            { width: 1920, crop: 'limit' }, // Max width 1920px
            { quality: 'auto:good' } // Auto quality
          ]
        });
        filePath = result.secure_url;
        storageType = 'cloudinary';
        console.log('✅✅✅ SUCCESS: Image uploaded to Cloudinary!');
        console.log('   URL:', filePath);
        console.log('   Format:', result.format, '| Size:', (result.bytes / 1024).toFixed(2), 'KB');
        // Clean up temporary file if using disk storage
        if (req.file.path && fs.existsSync(req.file.path)) {
          fs.unlinkSync(req.file.path);
          console.log('   Temporary file cleaned up');
        }
      } catch (err) {
        cloudinaryError = err;
        console.error('\n❌❌❌ CLOUDINARY UPLOAD FAILED!');
        console.error('   Error:', err.message);
        console.error('   HTTP Code:', err.http_code || 'N/A');
        console.error('   Error Name:', err.name || 'N/A');
        if (err.stack) {
          console.error('   Stack:', err.stack);
        }
        // Fallback to local storage only if Cloudinary fails
        console.log('\n⚠️  FALLING BACK TO LOCAL STORAGE...');
        const uniqueName = `${Date.now()}-${req.file.originalname}`;
        const localPath = path.join(imagesDir, uniqueName);
        if (!fs.existsSync(localPath)) {
          fs.writeFileSync(localPath, optimizedBuffer);
        }
        filePath = `/uploads/images/${uniqueName}`;
        storageType = 'local';
        console.log('📁 Image saved locally (Cloudinary fallback):', filePath);
      }
    } else {
      // Local storage with optimized image (Cloudinary not configured)
      console.log('\n📁 CLOUDINARY NOT CONFIGURED - USING LOCAL STORAGE');
      const uniqueName = `${Date.now()}-${req.file.originalname}`;
      const localPath = path.join(imagesDir, uniqueName);
      if (!fs.existsSync(localPath)) {
        fs.writeFileSync(localPath, optimizedBuffer);
      }
      filePath = `/uploads/images/${uniqueName}`;
      storageType = 'local';
      console.log('📁 Image saved locally (optimized):', filePath);
    }

    console.log('\n========================================');
    console.log('📤 SENDING RESPONSE');
    console.log('   Storage Type:', storageType.toUpperCase());
    console.log('   File Path:', filePath);
    console.log('   Is Cloudinary URL?', filePath && filePath.startsWith('https://res.cloudinary.com') ? '✅ YES' : '❌ NO');
    if (cloudinaryError) {
      console.log('   ⚠️  Cloudinary Error:', cloudinaryError.message);
    }
    console.log('========================================\n');
    
    res.status(201).json({
      message: 'Image uploaded successfully',
      image: { 
        url: filePath, 
        path: filePath 
      },
      storage: {
        type: storageType,
        isCloudinary: storageType === 'cloudinary',
        cloudinaryError: cloudinaryError ? cloudinaryError.message : null
      }
    });
  } catch (error) {
    console.error('\n❌❌❌ UPLOAD IMAGE ERROR:');
    console.error('   Error name:', error.name);
    console.error('   Error message:', error.message);
    console.error('   Error stack:', error.stack);
    console.error('========================================\n');
    res.status(500).json({ 
      error: 'Internal server error',
      details: error.message || 'Unknown error',
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// Serve uploaded files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

