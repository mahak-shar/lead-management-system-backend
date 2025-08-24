const express = require('express');
const { body, validationResult, query } = require('express-validator');
const { getDatabase } = require('../database/init');

const router = express.Router();

// Validation middleware
const validateLead = [
  body('first_name').trim().notEmpty().withMessage('First name is required'),
  body('last_name').trim().notEmpty().withMessage('Last name is required'),
  body('email').isEmail().normalizeEmail().withMessage('Please provide a valid email'),
  body('phone').optional().trim(),
  body('company').optional().trim(),
  body('city').optional().trim(),
  body('state').optional().trim(),
  body('source').isIn(['website', 'facebook_ads', 'google_ads', 'referral', 'events', 'other']).withMessage('Invalid source'),
  body('status').optional().isIn(['new', 'contacted', 'qualified', 'lost', 'won']).withMessage('Invalid status'),
  body('score').optional().isInt({ min: 0, max: 100 }).withMessage('Score must be between 0 and 100'),
  body('lead_value').optional().isFloat({ min: 0 }).withMessage('Lead value must be a positive number'),
  body('is_qualified').optional().isBoolean().withMessage('is_qualified must be a boolean')
];

// Helper function to build WHERE clause for filters
function buildWhereClause(filters, userId) {
  let whereClause = 'WHERE user_id = ?';
  let params = [userId];
  
  if (!filters) return { whereClause, params };
  
  // String fields with equals and contains
  if (filters.email) {
    if (filters.email.operator === 'equals') {
      whereClause += ' AND email = ?';
      params.push(filters.email.value);
    } else if (filters.email.operator === 'contains') {
      whereClause += ' AND email LIKE ?';
      params.push(`%${filters.email.value}%`);
    }
  }
  
  if (filters.company) {
    if (filters.company.operator === 'equals') {
      whereClause += ' AND company = ?';
      params.push(filters.company.value);
    } else if (filters.company.operator === 'contains') {
      whereClause += ' AND company LIKE ?';
      params.push(`%${filters.company.value}%`);
    }
  }
  
  if (filters.city) {
    if (filters.city.operator === 'equals') {
      whereClause += ' AND city = ?';
      params.push(filters.city.value);
    } else if (filters.city.operator === 'contains') {
      whereClause += ' AND city LIKE ?';
      params.push(`%${filters.city.value}%`);
    }
  }
  
  // Enum fields
  if (filters.status) {
    if (filters.status.operator === 'equals') {
      whereClause += ' AND status = ?';
      params.push(filters.status.value);
    } else if (filters.status.operator === 'in' && Array.isArray(filters.status.value)) {
      const placeholders = filters.status.value.map(() => '?').join(',');
      whereClause += ` AND status IN (${placeholders})`;
      params.push(...filters.status.value);
    }
  }
  
  if (filters.source) {
    if (filters.source.operator === 'equals') {
      whereClause += ' AND source = ?';
      params.push(filters.source.value);
    } else if (filters.source.operator === 'in' && Array.isArray(filters.source.value)) {
      const placeholders = filters.source.value.map(() => '?').join(',');
      whereClause += ` AND source IN (${placeholders})`;
      params.push(...filters.source.value);
    }
  }
  
  // Number fields
  if (filters.score) {
    if (filters.score.operator === 'equals') {
      whereClause += ' AND score = ?';
      params.push(filters.score.value);
    } else if (filters.score.operator === 'gt') {
      whereClause += ' AND score > ?';
      params.push(filters.score.value);
    } else if (filters.score.operator === 'lt') {
      whereClause += ' AND score < ?';
      params.push(filters.score.value);
    } else if (filters.score.operator === 'between' && Array.isArray(filters.score.value)) {
      whereClause += ' AND score BETWEEN ? AND ?';
      params.push(filters.score.value[0], filters.score.value[1]);
    }
  }
  
  if (filters.lead_value) {
    if (filters.lead_value.operator === 'equals') {
      whereClause += ' AND lead_value = ?';
      params.push(filters.lead_value.value);
    } else if (filters.lead_value.operator === 'gt') {
      whereClause += ' AND lead_value > ?';
      params.push(filters.lead_value.value);
    } else if (filters.lead_value.operator === 'lt') {
      whereClause += ' AND lead_value < ?';
      params.push(filters.lead_value.value);
    } else if (filters.lead_value.operator === 'between' && Array.isArray(filters.lead_value.value)) {
      whereClause += ' AND lead_value BETWEEN ? AND ?';
      params.push(filters.lead_value.value[0], filters.lead_value.value[1]);
    }
  }
  
  // Date fields
  if (filters.created_at) {
    if (filters.created_at.operator === 'on') {
      whereClause += ' AND DATE(created_at) = DATE(?)';
      params.push(filters.created_at.value);
    } else if (filters.created_at.operator === 'before') {
      whereClause += ' AND created_at < ?';
      params.push(filters.created_at.value);
    } else if (filters.created_at.operator === 'after') {
      whereClause += ' AND created_at > ?';
      params.push(filters.created_at.value);
    } else if (filters.created_at.operator === 'between' && Array.isArray(filters.created_at.value)) {
      whereClause += ' AND created_at BETWEEN ? AND ?';
      params.push(filters.created_at.value[0], filters.created_at.value[1]);
    }
  }
  
  if (filters.last_activity_at) {
    if (filters.last_activity_at.operator === 'on') {
      whereClause += ' AND DATE(last_activity_at) = DATE(?)';
      params.push(filters.last_activity_at.value);
    } else if (filters.last_activity_at.operator === 'before') {
      whereClause += ' AND last_activity_at < ?';
      params.push(filters.last_activity_at.value);
    } else if (filters.last_activity_at.operator === 'after') {
      whereClause += ' AND last_activity_at > ?';
      params.push(filters.last_activity_at.value);
    } else if (filters.last_activity_at.operator === 'between' && Array.isArray(filters.last_activity_at.value)) {
      whereClause += ' AND last_activity_at BETWEEN ? AND ?';
      params.push(filters.last_activity_at.value[0], filters.last_activity_at.value[1]);
    }
  }
  
  // Boolean field
  if (filters.is_qualified !== undefined) {
    whereClause += ' AND is_qualified = ?';
    params.push(filters.is_qualified ? 1 : 0);
  }
  
  return { whereClause, params };
}

// Create lead
router.post('/', validateLead, (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        error: 'Validation Error', 
        errors: errors.array() 
      });
    }

    const {
      first_name, last_name, email, phone, company, city, state,
      source, status = 'new', score = 0, lead_value = 0, is_qualified = false
    } = req.body;

    const db = getDatabase();
    
    // Check if email already exists for this user
    db.get('SELECT id FROM leads WHERE user_id = ? AND email = ?', 
      [req.user.userId, email], 
      (err, existingLead) => {
        if (err) {
          console.error('Database error:', err);
          return res.status(500).json({ 
            error: 'Database error', 
            message: 'Failed to check lead existence' 
          });
        }

        if (existingLead) {
          return res.status(409).json({ 
            error: 'Lead already exists', 
            message: 'A lead with this email already exists' 
          });
        }

        // Create lead
        db.run(
          `INSERT INTO leads (
            user_id, first_name, last_name, email, phone, company, city, state,
            source, status, score, lead_value, is_qualified, last_activity_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            req.user.userId, first_name, last_name, email, phone, company, city, state,
            source, status, score, lead_value, is_qualified, new Date().toISOString()
          ],
          function(err) {
            if (err) {
              console.error('Database error:', err);
              return res.status(500).json({ 
                error: 'Database error', 
                message: 'Failed to create lead' 
              });
            }

            // Fetch the created lead
            db.get('SELECT * FROM leads WHERE id = ?', [this.lastID], (err, lead) => {
              if (err) {
                console.error('Database error:', err);
                return res.status(500).json({ 
                  error: 'Database error', 
                  message: 'Failed to fetch created lead' 
                });
              }

              res.status(201).json({
                message: 'Lead created successfully',
                lead
              });
            });
          }
        );
      }
    );
  } catch (error) {
    console.error('Create lead error:', error);
    res.status(500).json({ 
      error: 'Server error', 
      message: 'Failed to create lead' 
    });
  }
});

// Get leads with pagination and filters
router.get('/', [
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100')
], (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        error: 'Validation Error', 
        errors: errors.array() 
      });
    }

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;
    
    let filters = null;
    try {
      if (req.query.filters) {
        filters = JSON.parse(req.query.filters);
      }
    } catch (error) {
      return res.status(400).json({ 
        error: 'Invalid filters', 
        message: 'Filters must be valid JSON' 
      });
    }

    const db = getDatabase();
    const { whereClause, params } = buildWhereClause(filters, req.user.userId);

    // Get total count
    db.get(`SELECT COUNT(*) as total FROM leads ${whereClause}`, params, (err, countResult) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ 
          error: 'Database error', 
          message: 'Failed to count leads' 
        });
      }

      const total = countResult.total;
      const totalPages = Math.ceil(total / limit);

      // Get leads with pagination
      const queryParams = [...params, limit, offset];
      db.all(
        `SELECT * FROM leads ${whereClause} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
        queryParams,
        (err, leads) => {
          if (err) {
            console.error('Database error:', err);
            return res.status(500).json({ 
              error: 'Database error', 
              message: 'Failed to fetch leads' 
            });
          }

          res.status(200).json({
            data: leads,
            page,
            limit,
            total,
            totalPages
          });
        }
      );
    });
  } catch (error) {
    console.error('Get leads error:', error);
    res.status(500).json({ 
      error: 'Server error', 
      message: 'Failed to fetch leads' 
    });
  }
});

// Get single lead
router.get('/:id', (req, res) => {
  const { id } = req.params;
  const db = getDatabase();

  db.get('SELECT * FROM leads WHERE id = ? AND user_id = ?', 
    [id, req.user.userId], 
    (err, lead) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ 
          error: 'Database error', 
          message: 'Failed to fetch lead' 
        });
      }

      if (!lead) {
        return res.status(404).json({ 
          error: 'Lead not found', 
          message: 'Lead does not exist' 
        });
      }

      res.status(200).json({ lead });
    }
  );
});

// Update lead
router.put('/:id', validateLead, (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        error: 'Validation Error', 
        errors: errors.array() 
      });
    }

    const { id } = req.params;
    const {
      first_name, last_name, email, phone, company, city, state,
      source, status, score, lead_value, is_qualified
    } = req.body;

    const db = getDatabase();

    // Check if lead exists and belongs to user
    db.get('SELECT id FROM leads WHERE id = ? AND user_id = ?', 
      [id, req.user.userId], 
      (err, existingLead) => {
        if (err) {
          console.error('Database error:', err);
          return res.status(500).json({ 
            error: 'Database error', 
            message: 'Failed to check lead existence' 
          });
        }

        if (!existingLead) {
          return res.status(404).json({ 
            error: 'Lead not found', 
            message: 'Lead does not exist' 
          });
        }

        // Check if email already exists for another lead of this user
        db.get('SELECT id FROM leads WHERE user_id = ? AND email = ? AND id != ?', 
          [req.user.userId, email, id], 
          (err, duplicateLead) => {
            if (err) {
              console.error('Database error:', err);
              return res.status(500).json({ 
                error: 'Database error', 
                message: 'Failed to check email uniqueness' 
              });
            }

            if (duplicateLead) {
              return res.status(409).json({ 
                error: 'Email already exists', 
                message: 'Another lead with this email already exists' 
              });
            }

            // Update lead
            db.run(
              `UPDATE leads SET 
                first_name = ?, last_name = ?, email = ?, phone = ?, company = ?, 
                city = ?, state = ?, source = ?, status = ?, score = ?, 
                lead_value = ?, is_qualified = ?, updated_at = CURRENT_TIMESTAMP
               WHERE id = ? AND user_id = ?`,
              [
                first_name, last_name, email, phone, company, city, state,
                source, status, score, lead_value, is_qualified, id, req.user.userId
              ],
              function(err) {
                if (err) {
                  console.error('Database error:', err);
                  return res.status(500).json({ 
                    error: 'Database error', 
                    message: 'Failed to update lead' 
                  });
                }

                if (this.changes === 0) {
                  return res.status(404).json({ 
                    error: 'Lead not found', 
                    message: 'Lead does not exist' 
                  });
                }

                // Fetch updated lead
                db.get('SELECT * FROM leads WHERE id = ?', [id], (err, lead) => {
                  if (err) {
                    console.error('Database error:', err);
                    return res.status(500).json({ 
                      error: 'Database error', 
                      message: 'Failed to fetch updated lead' 
                    });
                  }

                  res.status(200).json({
                    message: 'Lead updated successfully',
                    lead
                  });
                });
              }
            );
          }
        );
      }
    );
  } catch (error) {
    console.error('Update lead error:', error);
    res.status(500).json({ 
      error: 'Server error', 
      message: 'Failed to update lead' 
    });
  }
});

// Delete lead
router.delete('/:id', (req, res) => {
  const { id } = req.params;
  const db = getDatabase();

  db.run('DELETE FROM leads WHERE id = ? AND user_id = ?', 
    [id, req.user.userId], 
    function(err) {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ 
          error: 'Database error', 
          message: 'Failed to delete lead' 
        });
      }

      if (this.changes === 0) {
        return res.status(404).json({ 
          error: 'Lead not found', 
          message: 'Lead does not exist' 
        });
      }

      res.status(200).json({
        message: 'Lead deleted successfully'
      });
    }
  );
});

module.exports = router;
