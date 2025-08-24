const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
const fs = require('fs');

// Load environment variables - try config.env first, then fallback to .env
const envPath = './config.env';
if (fs.existsSync(envPath)) {
  require('dotenv').config({ path: envPath });
} else {
  require('dotenv').config();
}

// Import routes and middleware
const { initializeDatabase, getDatabase } = require('./database/init');
const authRoutes = require('./routes/auth');
const leadRoutes = require('./routes/leads');
const { authenticateToken } = require('./middleware/auth');

const app = express();
const PORT = process.env.PORT || 5000;

// Security middleware
app.use(helmet());

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.'
});
app.use(limiter);

app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? [
        "https://lead-management-system-frontend-roan.vercel.app",  // ✅ removed trailing slash
        "https://eron-front.onrender.com"
      ]
    : true, // Allow all origins for development
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Cookie']
}));

app.options("*", cors());

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Cookie parser
app.use(cookieParser());

// Static files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'OK', 
    message: 'Lead Management System API is running',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// Database status endpoint
app.get('/api/db-status', async (req, res) => {
  try {
    const db = getDatabase();
    db.get('SELECT COUNT(*) as userCount FROM users', (err, userResult) => {
      if (err) {
        return res.status(500).json({ 
          error: 'Database error', 
          message: err.message 
        });
      }
      
      db.get('SELECT COUNT(*) as leadCount FROM leads', (err, leadResult) => {
        if (err) {
          return res.status(500).json({ 
            error: 'Database error', 
            message: err.message 
          });
        }
        
        res.status(200).json({
          status: 'OK',
          database: 'Connected',
          users: userResult.userCount,
          leads: leadResult.leadCount,
          timestamp: new Date().toISOString()
        });
      });
    });
  } catch (error) {
    res.status(500).json({ 
      error: 'Database check failed', 
      message: error.message 
    });
  }
});

// Debug endpoint to check users
app.get('/api/debug/users', async (req, res) => {
  try {
    const db = getDatabase();
    db.all('SELECT id, email, first_name, last_name, created_at FROM users', (err, users) => {
      if (err) {
        return res.status(500).json({ 
          error: 'Database error', 
          message: err.message 
        });
      }
      
      res.status(200).json({
        status: 'OK',
        users: users,
        count: users.length
      });
    });
  } catch (error) {
    res.status(500).json({ 
      error: 'Database check failed', 
      message: error.message 
    });
  }
});

// Seed database endpoint (for development/testing)
app.post('/api/seed', async (req, res) => {
  try {
    const seedModule = require('./scripts/seed');
    await seedModule.seedDatabase();
    res.status(200).json({ 
      message: 'Database seeded successfully',
      testUser: {
        email: 'test@example.com',
        password: 'password123'
      }
    });
  } catch (error) {
    console.error('Error seeding database:', error);
    res.status(500).json({ 
      error: 'Failed to seed database',
      message: error.message 
    });
  }
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/leads', authenticateToken, leadRoutes);

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ 
    error: 'Route not found',
    message: `Cannot ${req.method} ${req.originalUrl}`
  });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Error:', err);
  
  if (err.name === 'ValidationError') {
    return res.status(400).json({ 
      error: 'Validation Error', 
      message: err.message 
    });
  }
  
  if (err.name === 'UnauthorizedError') {
    return res.status(401).json({ 
      error: 'Unauthorized', 
      message: 'Invalid or missing token' 
    });
  }
  
  res.status(500).json({ 
    error: 'Internal Server Error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
  });
});

// Initialize database and start server
async function startServer() {
  try {
    await initializeDatabase();
    console.log('✅ Database initialized successfully');
    
    app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`📊 Health check: http://localhost:${PORT}/health`);
      console.log(`🔗 API Base URL: http://localhost:${PORT}/api`);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

startServer();
