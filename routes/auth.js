const express = require('express');
const bcrypt = require('bcryptjs');
const { body, validationResult } = require('express-validator');
const { getDatabase } = require('../database/init');
const { generateToken, setTokenCookie, clearTokenCookie, authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Validation middleware
const validateRegistration = [
  body('email').isEmail().normalizeEmail().withMessage('Please provide a valid email'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters long'),
  body('first_name').trim().notEmpty().withMessage('First name is required'),
  body('last_name').trim().notEmpty().withMessage('Last name is required')
];

const validateLogin = [
  body('email').isEmail().normalizeEmail().withMessage('Please provide a valid email'),
  body('password').notEmpty().withMessage('Password is required')
];

// Register user
router.post('/register', validateRegistration, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        error: 'Validation Error', 
        errors: errors.array() 
      });
    }

    const { email, password, first_name, last_name } = req.body;
    const db = getDatabase();

    // Check if user already exists
    db.get('SELECT id FROM users WHERE email = ?', [email], async (err, user) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ 
          error: 'Database error', 
          message: 'Failed to check user existence' 
        });
      }

      if (user) {
        return res.status(409).json({ 
          error: 'User already exists', 
          message: 'A user with this email already exists' 
        });
      }

      // Hash password
      const saltRounds = 12;
      const hashedPassword = await bcrypt.hash(password, saltRounds);

      // Create user
      db.run(
        'INSERT INTO users (email, password, first_name, last_name) VALUES (?, ?, ?, ?)',
        [email, hashedPassword, first_name, last_name],
        function(err) {
          if (err) {
            console.error('Database error:', err);
            return res.status(500).json({ 
              error: 'Database error', 
              message: 'Failed to create user' 
            });
          }

          const userId = this.lastID;
          const token = generateToken(userId, email);
          setTokenCookie(res, token);

          res.status(201).json({
            message: 'User registered successfully',
            user: {
              id: userId,
              email,
              first_name,
              last_name
            }
          });
        }
      );
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ 
      error: 'Server error', 
      message: 'Failed to register user' 
    });
  }
});

// Login user
router.post('/login', validateLogin, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        error: 'Validation Error', 
        errors: errors.array() 
      });
    }

    const { email, password } = req.body;
    const db = getDatabase();

    // Find user
    db.get('SELECT * FROM users WHERE email = ?', [email], async (err, user) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ 
          error: 'Database error', 
          message: 'Failed to find user' 
        });
      }

      if (!user) {
        return res.status(401).json({ 
          error: 'Invalid credentials', 
          message: 'Email or password is incorrect' 
        });
      }

      // Check password
      const isValidPassword = await bcrypt.compare(password, user.password);
      if (!isValidPassword) {
        return res.status(401).json({ 
          error: 'Invalid credentials', 
          message: 'Email or password is incorrect' 
        });
      }

      // Generate token and set cookie
      const token = generateToken(user.id, user.email);
      setTokenCookie(res, token);

      res.status(200).json({
        message: 'Login successful',
        user: {
          id: user.id,
          email: user.email,
          first_name: user.first_name,
          last_name: user.last_name
        }
      });
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ 
      error: 'Server error', 
      message: 'Failed to login' 
    });
  }
});

// Logout user
router.post('/logout', (req, res) => {
  clearTokenCookie(res);
  res.status(200).json({ 
    message: 'Logout successful' 
  });
});

// Get current user
router.get('/me', authenticateToken, (req, res) => {
  const db = getDatabase();
  
  db.get('SELECT id, email, first_name, last_name, created_at FROM users WHERE id = ?', 
    [req.user.userId], 
    (err, user) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ 
          error: 'Database error', 
          message: 'Failed to fetch user' 
        });
      }

      if (!user) {
        return res.status(404).json({ 
          error: 'User not found', 
          message: 'User does not exist' 
        });
      }

      res.status(200).json({
        user
      });
    }
  );
});

module.exports = router;
