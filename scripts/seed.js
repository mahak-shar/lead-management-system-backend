const bcrypt = require('bcryptjs');
const { initializeDatabase, getDatabase } = require('../database/init');
const fs = require('fs');

// Load environment variables - try config.env first, then fallback to .env
const envPath = './config.env';
if (fs.existsSync(envPath)) {
  require('dotenv').config({ path: envPath });
} else {
  require('dotenv').config();
}

const sources = ['website', 'facebook_ads', 'google_ads', 'referral', 'events', 'other'];
const statuses = ['new', 'contacted', 'qualified', 'lost', 'won'];
const companies = [
  'TechCorp', 'InnovateLabs', 'Digital Solutions', 'Future Systems', 'SmartTech',
  'Global Enterprises', 'Creative Agency', 'DataFlow Inc', 'CloudWorks', 'NextGen',
  'Peak Performance', 'Elite Solutions', 'Prime Technologies', 'Advanced Systems',
  'Strategic Partners', 'Visionary Corp', 'Dynamic Solutions', 'Excellence Inc'
];
const cities = [
  'New York', 'Los Angeles', 'Chicago', 'Houston', 'Phoenix', 'Philadelphia',
  'San Antonio', 'San Diego', 'Dallas', 'San Jose', 'Austin', 'Jacksonville',
  'Fort Worth', 'Columbus', 'Charlotte', 'San Francisco', 'Indianapolis', 'Seattle'
];
const states = [
  'NY', 'CA', 'IL', 'TX', 'AZ', 'PA', 'FL', 'OH', 'NC', 'WA', 'IN', 'GA',
  'MI', 'VA', 'NJ', 'CO', 'MN', 'TN', 'WI', 'MD'
];

const firstNames = [
  'John', 'Jane', 'Michael', 'Sarah', 'David', 'Emily', 'Robert', 'Jessica',
  'William', 'Ashley', 'Christopher', 'Amanda', 'James', 'Stephanie', 'Daniel',
  'Nicole', 'Matthew', 'Elizabeth', 'Anthony', 'Helen', 'Mark', 'Deborah',
  'Donald', 'Lisa', 'Steven', 'Nancy', 'Paul', 'Karen', 'Andrew', 'Betty',
  'Joshua', 'Sandra', 'Kenneth', 'Donna', 'Kevin', 'Carol', 'Brian', 'Ruth',
  'George', 'Sharon', 'Timothy', 'Michelle', 'Ronald', 'Laura', 'Jason', 'Emily'
];

const lastNames = [
  'Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis',
  'Rodriguez', 'Martinez', 'Hernandez', 'Lopez', 'Gonzalez', 'Wilson', 'Anderson',
  'Thomas', 'Taylor', 'Moore', 'Jackson', 'Martin', 'Lee', 'Perez', 'Thompson',
  'White', 'Harris', 'Sanchez', 'Clark', 'Ramirez', 'Lewis', 'Robinson', 'Walker',
  'Young', 'Allen', 'King', 'Wright', 'Scott', 'Torres', 'Nguyen', 'Hill', 'Flores'
];

function generateRandomEmail(firstName, lastName) {
  const domains = ['gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'company.com'];
  const domain = domains[Math.floor(Math.random() * domains.length)];
  const number = Math.floor(Math.random() * 1000);
  return `${firstName.toLowerCase()}.${lastName.toLowerCase()}${number}@${domain}`;
}

function generateRandomPhone() {
  const areaCode = Math.floor(Math.random() * 900) + 100;
  const prefix = Math.floor(Math.random() * 900) + 100;
  const lineNumber = Math.floor(Math.random() * 9000) + 1000;
  return `(${areaCode}) ${prefix}-${lineNumber}`;
}

function generateRandomDate(start, end) {
  return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
}

async function seedDatabase() {
  try {
    console.log('🌱 Starting database seeding...');
    
    await initializeDatabase();
    const db = getDatabase();
    
    // Create test user
    const testUser = {
      email: 'test@example.com',
      password: 'password123',
      first_name: 'Test',
      last_name: 'User'
    };
    
    // Hash password
    const saltRounds = 12;
    const hashedPassword = await bcrypt.hash(testUser.password, saltRounds);
    
    // Insert test user
    db.run(
      'INSERT OR IGNORE INTO users (email, password, first_name, last_name) VALUES (?, ?, ?, ?)',
      [testUser.email, hashedPassword, testUser.first_name, testUser.last_name],
      function(err) {
        if (err) {
          console.error('Error creating test user:', err);
          return;
        }
        
        const userId = this.lastID || 1; // Use existing user if already exists
        console.log(`✅ Test user created/verified (ID: ${userId})`);
        console.log(`📧 Email: ${testUser.email}`);
        console.log(`🔑 Password: ${testUser.password}`);
        
        // Generate leads
        const leads = [];
        const numLeads = 120; // Generate 120 leads
        
        for (let i = 0; i < numLeads; i++) {
          const firstName = firstNames[Math.floor(Math.random() * firstNames.length)];
          const lastName = lastNames[Math.floor(Math.random() * lastNames.length)];
          const email = generateRandomEmail(firstName, lastName);
          const phone = generateRandomPhone();
          const company = companies[Math.floor(Math.random() * companies.length)];
          const city = cities[Math.floor(Math.random() * cities.length)];
          const state = states[Math.floor(Math.random() * states.length)];
          const source = sources[Math.floor(Math.random() * sources.length)];
          const status = statuses[Math.floor(Math.random() * statuses.length)];
          const score = Math.floor(Math.random() * 101); // 0-100
          const leadValue = Math.floor(Math.random() * 50000) + 1000; // $1000-$51000
          const isQualified = Math.random() > 0.7; // 30% chance of being qualified
          
          // Generate random dates
          const createdDate = generateRandomDate(new Date(2023, 0, 1), new Date());
          const lastActivityDate = Math.random() > 0.3 ? generateRandomDate(createdDate, new Date()) : null;
          
          leads.push([
            userId,
            firstName,
            lastName,
            email,
            phone,
            company,
            city,
            state,
            source,
            status,
            score,
            leadValue,
            isQualified ? 1 : 0,
            lastActivityDate ? lastActivityDate.toISOString() : null,
            createdDate.toISOString(),
            createdDate.toISOString()
          ]);
        }
        
        // Insert leads in batches
        const batchSize = 20;
        let insertedCount = 0;
        
        for (let i = 0; i < leads.length; i += batchSize) {
          const batch = leads.slice(i, i + batchSize);
          const placeholders = batch.map(() => '(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').join(',');
          
          const values = batch.flat();
          
          db.run(
            `INSERT INTO leads (
              user_id, first_name, last_name, email, phone, company, city, state,
              source, status, score, lead_value, is_qualified, last_activity_at,
              created_at, updated_at
            ) VALUES ${placeholders}`,
            values,
            function(err) {
              if (err) {
                console.error('Error inserting leads batch:', err);
                return;
              }
              
              insertedCount += batch.length;
              console.log(`📊 Inserted ${insertedCount}/${numLeads} leads...`);
              
              if (insertedCount >= numLeads) {
                console.log('✅ Database seeding completed successfully!');
                console.log(`👤 Test user: ${testUser.email} / ${testUser.password}`);
                console.log(`📈 Total leads created: ${insertedCount}`);
                console.log('🚀 You can now start the server and test the application');
                process.exit(0);
              }
            }
          );
        }
      }
    );
    
  } catch (error) {
    console.error('❌ Error seeding database:', error);
    throw error;
  }
}

// Export the function for use in other modules
module.exports = { seedDatabase };

// Only run if this file is executed directly
if (require.main === module) {
  seedDatabase();
}
