// server.js

const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const Database = require('better-sqlite3');
const path = require('path');
const multer = require('multer');
const fs = require('fs');

const app = express();

// Configuration
app.use(cors({
  origin: 'http://localhost:5173',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  credentials: true
}));
app.use(express.json());

// Database setup
const dbPath = path.join(__dirname, './db/database.db');
const db = new Database(dbPath, { verbose: console.log });

// Create directories if they don't exist
const uploadsDir = path.join(__dirname, 'uploads');
const vehiclesDir = path.join(uploadsDir, 'vehicles');
const driversDir = path.join(uploadsDir, 'drivers');

[uploadsDir, vehiclesDir, driversDir].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// JWT Secret
const JWT_SECRET = process.env.JWT_SECRET || 'your_vehicle_management_secret_key';

// Authentication middleware
const authenticateJWT = (req, res, next) => {
  const token = req.header('Authorization')?.split(' ')[1];

  if (!token) {
    return res.status(403).json({ message: 'Access denied. No token provided.' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ message: 'Invalid token.' });
  }
};

// Role-based authorization middleware
const authorizeRole = (roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ message: 'Insufficient permissions' });
    }

    next();
  };
};

// Database table creation functions
function createUsersTable() {
  const sql = `
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('admin', 'driver', 'passenger')),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `;
  db.prepare(sql).run();
  console.log('[✓] Users table created or already exists');
}

function createVehiclesTable() {
  const sql = `
    CREATE TABLE IF NOT EXISTS vehicles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      plate_number TEXT NOT NULL UNIQUE,
      make TEXT NOT NULL,
      model TEXT NOT NULL,
      year INTEGER NOT NULL,
      capacity INTEGER NOT NULL,
      status TEXT NOT NULL CHECK(status IN ('active', 'maintenance', 'inactive')) DEFAULT 'active',
      driver_id INTEGER,
      proposed_by_driver_id INTEGER,
      approved BOOLEAN DEFAULT 0, -- 0 = pending, 1 = approved
      approved_at DATETIME,
      approved_by_admin_id INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (driver_id) REFERENCES users(id),
      FOREIGN KEY (proposed_by_driver_id) REFERENCES users(id),
      FOREIGN KEY (approved_by_admin_id) REFERENCES users(id)
    )
  `;
  db.prepare(sql).run();
  console.log('[✓] Vehicles table created or already exists');
}

function createRoutesTable() {
  const sql = `
    CREATE TABLE IF NOT EXISTS routes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      route_name TEXT NOT NULL,
      start_location_name TEXT NOT NULL,
      start_location_lat REAL NOT NULL,
      start_location_lng REAL NOT NULL,
      end_location_name TEXT NOT NULL,
      end_location_lat REAL NOT NULL,
      end_location_lng REAL NOT NULL,
      distance REAL NOT NULL,
      estimated_time INTEGER NOT NULL, -- in minutes
      approved BOOLEAN DEFAULT 0, -- 0 = pending, 1 = approved
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      approved_at DATETIME,
      approved_by_admin_id INTEGER,
      proposed_by_driver_id INTEGER,
      FOREIGN KEY (approved_by_admin_id) REFERENCES users(id),
      FOREIGN KEY (proposed_by_driver_id) REFERENCES users(id)
    )
  `;
  db.prepare(sql).run();
  console.log('[✓] Routes table created or already exists');
}

function createTripsTable() {
  const sql = `
    CREATE TABLE IF NOT EXISTS trips (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      route_id INTEGER NOT NULL,
      vehicle_id INTEGER NOT NULL,
      driver_id INTEGER,
      departure_time DATETIME NOT NULL,
      arrival_time DATETIME NOT NULL,
      status TEXT NOT NULL CHECK(status IN ('scheduled', 'on_route', 'completed', 'cancelled')) DEFAULT 'scheduled',
      fare REAL NOT NULL,
      available_seats INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (route_id) REFERENCES routes(id),
      FOREIGN KEY (vehicle_id) REFERENCES vehicles(id),
      FOREIGN KEY (driver_id) REFERENCES users(id)
    )
  `;
  db.prepare(sql).run();
  console.log('[✓] Trips table created or already exists');
}

function createTripLocationsTable() {
  // New table to store real-time locations for active trips
  const sql = `
    CREATE TABLE IF NOT EXISTS trip_locations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      trip_id INTEGER NOT NULL,
      latitude REAL NOT NULL,
      longitude REAL NOT NULL,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (trip_id) REFERENCES trips(id) ON DELETE CASCADE
    )
  `;
  db.prepare(sql).run();
  console.log('[✓] Trip locations table created or already exists');
}

function createBookingsTable() {
  const sql = `
    CREATE TABLE IF NOT EXISTS bookings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      trip_id INTEGER NOT NULL,
      passenger_id INTEGER NOT NULL,
      seat_number INTEGER NOT NULL,
      booking_date DATETIME DEFAULT CURRENT_TIMESTAMP,
      status TEXT NOT NULL CHECK(status IN ('confirmed', 'pending', 'cancelled')) DEFAULT 'confirmed',
      total_amount REAL NOT NULL,
      pickup_location_lat REAL,
      pickup_location_lng REAL,
      dropoff_location_lat REAL,
      dropoff_location_lng REAL,
      FOREIGN KEY (trip_id) REFERENCES trips(id),
      FOREIGN KEY (passenger_id) REFERENCES users(id)
    )
  `;
  db.prepare(sql).run();
  console.log('[✓] Bookings table created or already exists');
}


function createDefaultAdmin() {
  const defaultAdmin = {
    user_name: 'Admin User',
    email: 'admin@mail.com',
    password: 'admin1', // TODO: hashing
    role: 'admin'
  };

  // Check if admin user already exists
  const existingAdmin = db.prepare('SELECT id FROM users WHERE email = ? AND role = ?').get(defaultAdmin.email, defaultAdmin.role);

  if (!existingAdmin) {
    try {
      const stmt = db.prepare(`
        INSERT INTO users (user_name, email, password, role)
        VALUES (?, ?, ?, ?)
      `);
      stmt.run(defaultAdmin.user_name, defaultAdmin.email, defaultAdmin.password, defaultAdmin.role);
      console.log(`[✓] Default admin user created: ${defaultAdmin.email}`);
    } catch (err) {
      console.error(`[x] Failed to create default admin user: `, err.message);
    }
  } else {
    console.log(`[i] Default admin user already exists: ${defaultAdmin.email}`);
  }
}

// Initialize tables
createUsersTable();
createVehiclesTable(); // Removed location fields from vehicle
createRoutesTable();
createTripsTable();
createTripLocationsTable(); // New table
createBookingsTable();
createDefaultAdmin();

// Database migration: Add driver_id column if it doesn't exist
function migrateTripsTable() {
  try {
    // Check if driver_id column exists
    const columns = db.prepare("PRAGMA table_info(trips)").all();
    const hasDriverId = columns.some(col => col.name === 'driver_id');

    if (!hasDriverId) {
      console.log('[!] Adding driver_id column to trips table...');
      db.prepare('ALTER TABLE trips ADD COLUMN driver_id INTEGER REFERENCES users(id)').run();
      console.log('[✓] driver_id column added to trips table');
    } else {
      console.log('[✓] driver_id column already exists in trips table');
    }
  } catch (err) {
    console.error('[✗] Error migrating trips table:', err.message);
  }
}

migrateTripsTable();

// Helper functions
function generateToken(user) {
  const payload = {
    id: user.id,
    email: user.email,
    name: user.user_name,
    role: user.role
  };
  const options = { expiresIn: '24h' };
  return jwt.sign(payload, JWT_SECRET, options);
}

// Authentication routes
app.post('/register', (req, res) => {
  const { user_name, email, password, role } = req.body;

  if (!user_name || !email || !password || !role) {
    return res.status(400).json({ message: 'Name, email, password, and role are required' });
  }

  // Validate role
  if (!['admin', 'driver', 'passenger'].includes(role)) {
    return res.status(400).json({ message: 'Invalid role. Must be admin, driver, or passenger' });
  }

  try {
    const stmt = db.prepare(`
      INSERT INTO users (user_name, email, password, role)
      VALUES (?, ?, ?, ?)
    `);
    stmt.run(user_name, email, password, role);

    res.status(201).json({ message: 'User registered successfully' });
  } catch (err) {
    if (err.message.includes('UNIQUE constraint failed')) {
      return res.status(409).json({ message: 'Email already exists' });
    }
    res.status(500).json({ message: 'Error registering user', error: err.message });
  }
});

app.post('/login', (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: 'Email and password are required' });
  }

  try {
    const user = db.prepare(`
      SELECT id, user_name, email, role, password
      FROM users
      WHERE email = ?
    `).get(email);

    if (!user || user.password !== password) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const token = generateToken(user);
    res.status(200).json({
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        name: user.user_name,
        email: user.email,
        role: user.role
      }
    });
  } catch (err) {
    res.status(500).json({ message: 'Login error', error: err.message });
  }
});

// Profile routes
app.get('/profile', authenticateJWT, (req, res) => {
  try {
    const user = db.prepare(`
      SELECT id, user_name, email, role, created_at
      FROM users
      WHERE id = ?
    `).get(req.user.id);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json(user);
  } catch (err) {
    res.status(500).json({ message: 'Error fetching profile', error: err.message });
  }
});

app.put('/profile', authenticateJWT, (req, res) => {
  const { user_name, email } = req.body;

  if (!user_name || !email) {
    return res.status(400).json({ message: 'Name and email are required' });
  }

  try {
    const stmt = db.prepare(`
      UPDATE users
      SET user_name = ?, email = ?
      WHERE id = ?
    `);
    const result = stmt.run(user_name, email, req.user.id);

    if (result.changes === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({ message: 'Profile updated successfully' });
  } catch (err) {
    if (err.message.includes('UNIQUE constraint failed')) {
      return res.status(409).json({ message: 'Email already exists' });
    }
    res.status(500).json({ message: 'Error updating profile', error: err.message });
  }
});

// Add this route near your other routes, after the authentication middleware is defined
app.get('/users', authenticateJWT, authorizeRole(['admin']), (req, res) => {
  try {
    // Only allow admin to list all users
    const users = db.prepare('SELECT id, user_name, email, role, created_at FROM users').all();
    res.json(users);
  } catch (err) {
    console.error("Error fetching users list:", err);
    res.status(500).json({ message: 'Error fetching users list', error: err.message });
  }
});

// Vehicle management routes

app.get('/vehicles', authenticateJWT, (req, res) => {
  try {
    let query = `
      SELECT v.*, u.user_name as driver_name,
             (SELECT user_name FROM users WHERE id = v.proposed_by_driver_id) as proposed_by_driver_name,
             (SELECT user_name FROM users WHERE id = v.approved_by_admin_id) as approved_by_admin_name
      FROM vehicles v
      LEFT JOIN users u ON v.driver_id = u.id
    `;
    let params = [];

    // Admins see all vehicles, drivers see only their *approved* vehicles
    if (req.user.role === 'driver') {
      query += ' WHERE v.driver_id = ? AND v.approved = 1'; // Only show approved vehicles assigned to the driver
      params = [req.user.id];
    } else if (req.user.role === 'admin') {
      // Admin can see all, or filter by query params like ?pending=true
      if (req.query.pending === 'true') {
        query += ' WHERE v.approved = 0';
      } else if (req.query.approved === 'true') {
        query += ' WHERE v.approved = 1';
      }
      // If no specific query, admin sees all
    }
    // Passengers might not need to see vehicles directly, or maybe approved ones for trip info?

    const vehicles = db.prepare(query).all(...params);
    res.json(vehicles);
  } catch (err) {
    res.status(500).json({ message: 'Error fetching vehicles', error: err.message });
  }
});

app.get('/vehicles/:id', authenticateJWT, (req, res) => {
  try {
    const vehicle = db.prepare(`
      SELECT v.*, u.user_name as driver_name,
             (SELECT user_name FROM users WHERE id = v.proposed_by_driver_id) as proposed_by_driver_name,
             (SELECT user_name FROM users WHERE id = v.approved_by_admin_id) as approved_by_admin_name
      FROM vehicles v
      LEFT JOIN users u ON v.driver_id = u.id
      WHERE v.id = ?
    `).get(req.params.id);

    if (!vehicle) {
      return res.status(404).json({ message: 'Vehicle not found' });
    }

    // Non-admins can only see their own *approved* vehicle
    if (req.user.role !== 'admin' && (vehicle.driver_id != req.user.id || !vehicle.approved)) { // Use != for potential string/number comparison
      return res.status(404).json({ message: 'Vehicle not found' }); // Or 403 Forbidden
    }

    res.json(vehicle);
  } catch (err) {
    res.status(500).json({ message: 'Error fetching vehicle', error: err.message });
  }
});

app.post('/vehicles', authenticateJWT, authorizeRole(['driver']), (req, res) => { // Only drivers can request
  const { plate_number, make, model, year, capacity, status = 'active' } = req.body;

  if (!plate_number || !make || !model || !year || !capacity) {
    return res.status(400).json({ message: 'Plate number, make, model, year, and capacity are required' });
  }

  // The driver requesting is the one who proposed it
  const proposed_by_driver_id = req.user.id;

  try {
    const stmt = db.prepare(`
      INSERT INTO vehicles (plate_number, make, model, year, capacity, status, proposed_by_driver_id, approved) -- Set approved to 0 initially
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const result = stmt.run(plate_number, make, model, year, capacity, status, proposed_by_driver_id, 0); // approved = 0

    res.status(201).json({
      message: 'Vehicle request submitted successfully. Awaiting approval.',
      vehicleId: result.lastInsertRowid
    });
  } catch (err) {
    if (err.message.includes('UNIQUE constraint failed')) {
      return res.status(409).json({ message: 'Plate number already exists' });
    }
    res.status(500).json({ message: 'Error submitting vehicle request', error: err.message });
  }
});

app.put('/vehicles/:id/approve', authenticateJWT, authorizeRole(['admin']), (req, res) => {
  const { id } = req.params;

  try {
    // Check if vehicle exists and is pending approval
    const vehicle = db.prepare('SELECT id, proposed_by_driver_id FROM vehicles WHERE id = ? AND approved = 0').get(id);
    if (!vehicle) {
      return res.status(404).json({ message: 'Vehicle request not found or already approved.' });
    }

    // Approve: Set approved = 1, set driver_id to the proposer, set approval time/admin
    const stmt = db.prepare(`
      UPDATE vehicles
      SET approved = 1, driver_id = ?, approved_at = CURRENT_TIMESTAMP, approved_by_admin_id = ?
      WHERE id = ?
    `);
    const result = stmt.run(vehicle.proposed_by_driver_id, req.user.id, id); // Assign to proposer, mark approved by admin

    if (result.changes === 0) {
      return res.status(404).json({ message: 'Vehicle request not found' });
    }

    res.json({ message: 'Vehicle request approved successfully' });
  } catch (err) {
    res.status(500).json({ message: 'Error approving vehicle request', error: err.message });
  }
});

app.put('/vehicles/:id', authenticateJWT, authorizeRole(['admin']), (req, res) => {
  const { plate_number, make, model, year, capacity, status, driver_id } = req.body; // driver_id can be changed by admin

  try {
    // Check if vehicle is approved before allowing changes (optional, stricter rule)
    // const vehicle = db.prepare('SELECT approved FROM vehicles WHERE id = ?').get(req.params.id);
    // if (!vehicle || !vehicle.approved) {
    //     return res.status(400).json({ message: 'Cannot update vehicle: Not approved.' });
    // }

    const stmt = db.prepare(`
      UPDATE vehicles
      SET plate_number = ?, make = ?, model = ?, year = ?, capacity = ?, status = ?, driver_id = ?
      WHERE id = ?
    `);
    const result = stmt.run(plate_number, make, model, year, capacity, status, driver_id, req.params.id);

    if (result.changes === 0) {
      return res.status(404).json({ message: 'Vehicle not found' });
    }

    res.json({ message: 'Vehicle updated successfully' });
  } catch (err) {
    res.status(500).json({ message: 'Error updating vehicle', error: err.message });
  }
});

app.delete('/vehicles/:id', authenticateJWT, authorizeRole(['admin']), (req, res) => {
  try {
    const stmt = db.prepare('DELETE FROM vehicles WHERE id = ?');
    const result = stmt.run(req.params.id);

    if (result.changes === 0) {
      return res.status(404).json({ message: 'Vehicle not found' });
    }

    res.json({ message: 'Vehicle deleted successfully' });
  } catch (err) {
    res.status(500).json({ message: 'Error deleting vehicle', error: err.message });
  }
});

// Route management routes

// Get routes (modified to include approval status)
app.get('/routes', authenticateJWT, (req, res) => {
  try {
    let query = `SELECT * FROM routes`;
    let params = [];

    // Admins see all routes, drivers/passengers see only approved routes
    if (req.user.role !== 'admin') {
      query += ' WHERE approved = 1';
    }

    // Optionally, filter further based on role or add query params for pending routes for admin
    if (req.user.role === 'admin' && req.query.pending === 'true') {
      query += req.query.pending ? ' WHERE approved = 0' : ' WHERE approved = 1';
      // If no WHERE clause was added before, we need to use WHERE here
      if (!query.includes('WHERE')) {
        query += ' WHERE approved = 0';
      } else {
        // If WHERE was already added (e.g., for non-admins), this logic is flawed.
        // Let's simplify: Admins get all if no query, approved if query=pending=false, pending if query=pending=true
        // Non-admins get only approved.
        // So, for admin:
        if (req.query.pending === 'true') {
          query = 'SELECT * FROM routes WHERE approved = 0'; // Override for pending
        } else if (req.query.pending === 'false') {
          query = 'SELECT * FROM routes WHERE approved = 1'; // Override for approved
        } else {
          // Admin sees all
        }
      }
    } else if (req.user.role !== 'admin') {
      // Non-admins always see approved only
      query = 'SELECT * FROM routes WHERE approved = 1';
    }


    const routes = db.prepare(query).all(...params);
    res.json(routes);
  } catch (err) {
    res.status(500).json({ message: 'Error fetching routes', error: err.message });
  }
});

// Get a specific route
app.get('/routes/:id', authenticateJWT, (req, res) => {
  try {
    const route = db.prepare('SELECT * FROM routes WHERE id = ?').get(req.params.id);

    if (!route) {
      return res.status(404).json({ message: 'Route not found' });
    }

    // Non-admins can only see approved routes
    if (req.user.role !== 'admin' && !route.approved) {
      return res.status(404).json({ message: 'Route not found' }); // Or 403 Forbidden
    }

    res.json(route);
  } catch (err) {
    res.status(500).json({ message: 'Error fetching route', error: err.message });
  }
});

// Create a new route proposal (Driver only)
app.post('/routes', authenticateJWT, authorizeRole(['driver']), (req, res) => {
  const { route_name, start_location, end_location, distance, estimated_time } = req.body;

  if (!route_name || !start_location || !end_location || !distance || !estimated_time) {
    return res.status(400).json({
      message: 'Route name, start location, end location, distance, and estimated time are required'
    });
  }

  // Extract properties correctly from the location objects sent by the frontend
  // The frontend sends { lat: ..., lng: ..., name: ... }
  const { name: start_name, lat: start_lat, lng: start_lng } = start_location;
  const { name: end_name, lat: end_lat, lng: end_lng } = end_location;

  // Validate coordinates
  if (typeof start_lat !== 'number' || typeof start_lng !== 'number' ||
    typeof end_lat !== 'number' || typeof end_lng !== 'number') {
    return res.status(400).json({ message: 'Start and end location coordinates must be numbers.' });
  }

  // Validate names (or use coordinates as fallback names if names are not sent)
  if (typeof start_name !== 'string' || typeof end_name !== 'string') {
    // Or, if names are optional and you want to use coordinates as names:
    // const start_name = `Start (${start_lat.toFixed(4)}, ${start_lng.toFixed(4)})`;
    // const end_name = `End (${end_lat.toFixed(4)}, ${end_lng.toFixed(4)})`;
    return res.status(400).json({ message: 'Start and end location names must be strings.' });
  }


  try {
    const stmt = db.prepare(`
      INSERT INTO routes (route_name, start_location_name, start_location_lat, start_location_lng, end_location_name, end_location_lat, end_location_lng, distance, estimated_time, proposed_by_driver_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    // Use the extracted values
    const result = stmt.run(route_name, start_name, start_lat, start_lng, end_name, end_lat, end_lng, distance, estimated_time, req.user.id);

    res.status(201).json({
      message: 'Route proposal submitted successfully. Awaiting approval.',
      routeId: result.lastInsertRowid
    });
  } catch (err) {
    console.error("Error in POST /routes:", err); // Add this log for debugging
    res.status(500).json({ message: 'Error submitting route proposal', error: err.message });
  }
});

// ... (rest of your server.js code remains the same) ...

// Modify GET /routes to include proposer ID for admin view
app.get('/routes', authenticateJWT, (req, res) => {
  try {
    let query = `SELECT *, (SELECT user_name FROM users WHERE id = routes.proposed_by_driver_id) as proposed_by_driver_name FROM routes`; // Join or subquery to get proposer name
    let params = [];

    // Admins see all routes, drivers/passengers see only approved routes
    if (req.user.role !== 'admin') {
      query += ' WHERE approved = 1';
    }

    // Optionally, filter further based on role or add query params for pending routes for admin
    if (req.user.role === 'admin' && req.query.pending === 'true') {
      query = 'SELECT *, (SELECT user_name FROM users WHERE id = routes.proposed_by_driver_id) as proposed_by_driver_name FROM routes WHERE approved = 0'; // Override for pending
    } else if (req.user.role === 'admin' && req.query.approved === 'true') {
      query = 'SELECT *, (SELECT user_name FROM users WHERE id = routes.proposed_by_driver_id) as proposed_by_driver_name FROM routes WHERE approved = 1'; // Override for approved
    } else if (req.user.role !== 'admin') {
      // Non-admins always see approved only
      query = 'SELECT * FROM routes WHERE approved = 1';
    }


    const routes = db.prepare(query).all(...params);
    res.json(routes);
  } catch (err) {
    res.status(500).json({ message: 'Error fetching routes', error: err.message });
  }
});

// Approve a route (Admin only)
app.put('/routes/:id/approve', authenticateJWT, authorizeRole(['admin']), (req, res) => {
  const { id } = req.params;

  try {
    const route = db.prepare('SELECT id FROM routes WHERE id = ? AND approved = 0').get(id);
    if (!route) {
      return res.status(404).json({ message: 'Route not found or already approved.' });
    }

    const stmt = db.prepare(`
      UPDATE routes
      SET approved = 1, approved_at = CURRENT_TIMESTAMP, approved_by_admin_id = ?
      WHERE id = ?
    `);
    const result = stmt.run(req.user.id, id);

    if (result.changes === 0) {
      return res.status(404).json({ message: 'Route not found' });
    }

    res.json({ message: 'Route approved successfully' });
  } catch (err) {
    res.status(500).json({ message: 'Error approving route', error: err.message });
  }
});

// Trip management routes

// Get trips (modified to include location from trip_locations table and route approval status)
app.get('/trips', authenticateJWT, (req, res) => {
  try {
    let query = `
      SELECT t.*, r.route_name, r.start_location_name, r.end_location_name, r.approved as route_approved, v.plate_number, u.user_name as driver_name,
             tl.latitude as current_location_lat, tl.longitude as current_location_lng, tl.timestamp as location_timestamp
      FROM trips t
      JOIN routes r ON t.route_id = r.id
      JOIN vehicles v ON t.vehicle_id = v.id
      JOIN users u ON t.driver_id = u.id
      LEFT JOIN (
          SELECT trip_id, latitude, longitude, timestamp
          FROM trip_locations
          WHERE (trip_id, timestamp) IN (
              SELECT trip_id, MAX(timestamp)
              FROM trip_locations
              GROUP BY trip_id
          )
      ) tl ON t.id = tl.trip_id -- Join with latest location for each trip
    `;
    let params = [];

    // Passengers see upcoming trips on approved routes, drivers see their trips, admins see all
    if (req.user.role === 'passenger') {
      query += ' WHERE t.status = ? AND t.departure_time > ? AND r.approved = 1'; // Only approved routes for passengers
      params = ['scheduled', new Date().toISOString()];
    } else if (req.user.role === 'driver') {
      query += ' WHERE t.driver_id = ?'; // Driver sees their own trips
      params = [req.user.id];
    }
    // Admins see all trips

    query += ' ORDER BY t.departure_time ASC';

    const trips = db.prepare(query).all(...params);
    // Format the result to include location as an object
    const tripsWithLocation = trips.map(t => ({
      ...t,
      current_location: t.current_location_lat !== null && t.current_location_lng !== null
        ? { lat: t.current_location_lat, lng: t.current_location_lng, timestamp: t.location_timestamp }
        : null,
      // Exclude the separate lat/lng columns from the response
      current_location_lat: undefined,
      current_location_lng: undefined,
      location_timestamp: undefined
    }));

    res.json(tripsWithLocation);
  } catch (err) {
    res.status(500).json({ message: 'Error fetching trips', error: err.message });
  }
});

// Create a new trip (Modified to ensure route is approved and driver is assigned)
app.post('/trips', authenticateJWT, authorizeRole(['admin', 'driver']), (req, res) => {
  const { route_id, vehicle_id, departure_time, arrival_time, fare, available_seats } = req.body;
  // Driver ID is taken from the authenticated user's token
  const driver_id = req.user.id;

  if (!route_id || !vehicle_id || !departure_time || !arrival_time || !fare || !available_seats) {
    return res.status(400).json({
      message: 'Route ID, Vehicle ID, Departure Time, Arrival Time, Fare, and Available Seats are required'
    });
  }

  try {
    // Check if the route is approved
    const route = db.prepare('SELECT approved, proposed_by_driver_id FROM routes WHERE id = ?').get(route_id);
    if (!route) {
      return res.status(404).json({ message: 'Route not found.' });
    }
    if (!route.approved) {
      return res.status(400).json({ message: 'Cannot create trip: Route is not approved.' });
    }

    // Optional: Check if the driver proposing the trip is the one who proposed the route (or is admin)
    // This adds a layer of security ensuring drivers can only create trips on routes they proposed (or admin can create for anyone)
    if (req.user.role === 'driver' && route.proposed_by_driver_id != req.user.id) {
      return res.status(403).json({ message: 'You can only create trips for routes you proposed.' });
    }

    // Check if the vehicle belongs to the driver (or is admin)
    const vehicle = db.prepare('SELECT id FROM vehicles WHERE id = ? AND driver_id = ?').get(vehicle_id, req.user.id);
    if (!vehicle && req.user.role !== 'admin') { // Admin can assign any vehicle
      return res.status(403).json({ message: 'You do not own the selected vehicle.' });
    }

    // Check if driver already has an active trip on the same route overlapping times?
    // This might be an optional check depending on business logic.

    const stmt = db.prepare(`
      INSERT INTO trips (route_id, vehicle_id, driver_id, departure_time, arrival_time, fare, available_seats)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    const result = stmt.run(route_id, vehicle_id, driver_id, departure_time, arrival_time, fare, available_seats);

    res.status(201).json({
      message: 'Trip created successfully',
      tripId: result.lastInsertRowid
    });
  } catch (err) {
    console.error('[ERROR] Failed to create trip:', err);
    res.status(500).json({ message: 'Error creating trip', error: err.message });
  }
});

// Update trip status (e.g., start, end)
app.put('/trips/:id/status', authenticateJWT, authorizeRole(['admin', 'driver']), (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  if (!['scheduled', 'on_route', 'completed', 'cancelled'].includes(status)) {
    return res.status(400).json({ message: 'Invalid status.' });
  }

  try {
    // Verify driver owns the trip if driver is updating
    if (req.user.role === 'driver') {
      const trip = db.prepare('SELECT driver_id FROM trips WHERE id = ?').get(id);
      if (!trip || trip.driver_id != req.user.id) {
        return res.status(403).json({ message: 'You do not have permission to update this trip.' });
      }
    }

    const stmt = db.prepare('UPDATE trips SET status = ? WHERE id = ?');
    const result = stmt.run(status, id);

    if (result.changes === 0) {
      return res.status(404).json({ message: 'Trip not found' });
    }

    res.json({ message: `Trip status updated to ${status}` });
  } catch (err) {
    res.status(500).json({ message: 'Error updating trip status', error: err.message });
  }
});


// Booking routes
app.post('/bookings', authenticateJWT, authorizeRole(['passenger']), (req, res) => {
  const { trip_id, seat_number, pickup_location, dropoff_location } = req.body;

  if (!trip_id || !seat_number || !pickup_location || !dropoff_location) {
    return res.status(400).json({ message: 'Trip ID, seat number, pickup location, and dropoff location are required' });
  }

  try {
    // Check if trip exists and has available seats
    const trip = db.prepare('SELECT * FROM trips WHERE id = ?').get(trip_id);
    if (!trip) {
      return res.status(404).json({ message: 'Trip not found' });
    }

    if (trip.available_seats <= 0) {
      return res.status(400).json({ message: 'No available seats' });
    }

    // Check if seat is already booked
    const existingBooking = db.prepare(`
      SELECT * FROM bookings
      WHERE trip_id = ? AND seat_number = ? AND status != 'cancelled'
    `).get(trip_id, seat_number);

    if (existingBooking) {
      return res.status(400).json({ message: 'Seat already booked' });
    }

    // Calculate fare (you might want to store this in the trip record)
    const fare = trip.fare;

    // Create booking
    const stmt = db.prepare(`
      INSERT INTO bookings (trip_id, passenger_id, seat_number, total_amount, pickup_location_lat, pickup_location_lng, dropoff_location_lat, dropoff_location_lng)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const result = stmt.run(
      trip_id,
      req.user.id,
      seat_number,
      fare,
      pickup_location.lat,
      pickup_location.lng,
      dropoff_location.lat,
      dropoff_location.lng
    );

    // Update available seats
    db.prepare('UPDATE trips SET available_seats = available_seats - 1 WHERE id = ?').run(trip_id);

    res.status(201).json({
      message: 'Booking confirmed successfully',
      bookingId: result.lastInsertRowid
    });
  } catch (err) {
    res.status(500).json({ message: 'Error making booking', error: err.message });
  }
});

app.get('/bookings', authenticateJWT, (req, res) => {
  try {
    let query = `
      SELECT b.*, t.departure_time, t.arrival_time, r.route_name, r.start_location_name, r.end_location_name, v.plate_number
      FROM bookings b
      JOIN trips t ON b.trip_id = t.id
      JOIN routes r ON t.route_id = r.id
      JOIN vehicles v ON t.vehicle_id = v.id
    `;
    let params = [];

    if (req.user.role === 'passenger') {
      query += ' WHERE b.passenger_id = ?';
      params = [req.user.id];
    } else if (req.user.role === 'driver') {
      query += ' WHERE t.driver_id = ?';
      params = [req.user.id];
    }

    query += ' ORDER BY b.booking_date DESC';

    const bookings = db.prepare(query).all(...params);
    res.json(bookings);
  } catch (err) {
    res.status(500).json({ message: 'Error fetching bookings', error: err.message });
  }
});

// Cancel a booking (Passenger only - can only cancel own bookings)
app.put('/bookings/:id/cancel', authenticateJWT, authorizeRole(['passenger']), (req, res) => {
  const { id } = req.params;

  try {
    // Verify the booking belongs to the current passenger
    const booking = db.prepare('SELECT * FROM bookings WHERE id = ? AND passenger_id = ?').get(id, req.user.id);
    if (!booking) {
      return res.status(404).json({ message: 'Booking not found or you do not own this booking.' });
    }

    // Check if already cancelled
    if (booking.status === 'cancelled') {
      return res.status(400).json({ message: 'This booking is already cancelled.' });
    }

    // Update booking status to cancelled
    const stmt = db.prepare('UPDATE bookings SET status = ? WHERE id = ?');
    stmt.run('cancelled', id);

    // Restore available seats to the trip
    db.prepare('UPDATE trips SET available_seats = available_seats + 1 WHERE id = ?').run(booking.trip_id);

    res.json({ message: 'Booking cancelled successfully', bookingId: id });
  } catch (err) {
    res.status(500).json({ message: 'Error cancelling booking', error: err.message });
  }
});

// NEW: Endpoint for drivers to update their trip's location
app.post('/trips/:id/location', authenticateJWT, authorizeRole(['driver']), (req, res) => {
  const { id } = req.params;
  const { lat, lng } = req.body;

  if (typeof lat !== 'number' || typeof lng !== 'number') {
    return res.status(400).json({ message: 'Latitude and longitude are required and must be numbers.' });
  }

  // Verify the driver owns the trip
  const trip = db.prepare('SELECT id, driver_id FROM trips WHERE id = ?').get(id);
  if (!trip) {
    return res.status(404).json({ message: 'Trip not found.' });
  }
  if (trip.driver_id != req.user.id) { // Use != for potential string/number comparison
    return res.status(403).json({ message: 'You do not have permission to update this trip\'s location.' });
  }

  // Optionally, check if trip status is 'on_route' before allowing location updates
  const tripStatus = db.prepare('SELECT status FROM trips WHERE id = ?').get(id);
  if (tripStatus.status !== 'on_route') {
    return res.status(400).json({ message: 'Cannot update location: Trip is not currently on route.' });
  }

  try {
    const stmt = db.prepare(`
      INSERT INTO trip_locations (trip_id, latitude, longitude)
      VALUES (?, ?, ?)
    `);
    stmt.run(id, lat, lng);

    res.json({ message: 'Location updated successfully for trip', tripId: id, location: { lat, lng } });
  } catch (err) {
    res.status(500).json({ message: 'Error updating trip location', error: err.message });
  }
});


// Multer configuration for file uploads
const storage = multer.diskStorage({
  destination: function(req, file, cb) {
    if (req.baseUrl.includes('/vehicles')) {
      cb(null, vehiclesDir);
    } else {
      cb(null, driversDir);
    }
  },
  filename: function(req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'upload-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  },
  fileFilter: function(req, file, cb) {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed!'), false);
    }
  }
});

// Serve static files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Error handling middleware
app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ message: 'File too large' });
    }
  }
  res.status(500).json({ message: 'Server error', error: err.message });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ message: 'Route not found' });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Vehicle Management Backend running on http://localhost:${PORT}`);
});
