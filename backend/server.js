const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const Database = require('better-sqlite3');
const path = require('path');
const multer = require('multer');
const fs = require('fs');
const { resolve } = require('path');

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
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (driver_id) REFERENCES users(id)
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
      start_location TEXT NOT NULL,
      end_location TEXT NOT NULL,
      distance REAL NOT NULL,
      estimated_time INTEGER NOT NULL, -- in minutes
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
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
      driver_id INTEGER NOT NULL,
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
      FOREIGN KEY (trip_id) REFERENCES trips(id),
      FOREIGN KEY (passenger_id) REFERENCES users(id)
    )
  `;
  db.prepare(sql).run();
  console.log('[✓] Bookings table created or already exists');
}

// Initialize tables
createUsersTable();
createVehiclesTable();
createRoutesTable();
createTripsTable();
createBookingsTable();

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

// Vehicle management routes
app.post('/vehicles', authenticateJWT, authorizeRole(['admin']), (req, res) => {
  const { plate_number, make, model, year, capacity, status = 'active', driver_id } = req.body;

  if (!plate_number || !make || !model || !year || !capacity) {
    return res.status(400).json({ message: 'Plate number, make, model, year, and capacity are required' });
  }

  try {
    const stmt = db.prepare(`
      INSERT INTO vehicles (plate_number, make, model, year, capacity, status, driver_id)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    const result = stmt.run(plate_number, make, model, year, capacity, status, driver_id);

    res.status(201).json({
      message: 'Vehicle added successfully',
      vehicleId: result.lastInsertRowid
    });
  } catch (err) {
    if (err.message.includes('UNIQUE constraint failed')) {
      return res.status(409).json({ message: 'Plate number already exists' });
    }
    res.status(500).json({ message: 'Error adding vehicle', error: err.message });
  }
});

app.get('/vehicles', authenticateJWT, (req, res) => {
  try {
    let query = 'SELECT v.*, u.user_name as driver_name FROM vehicles v LEFT JOIN users u ON v.driver_id = u.id';
    let params = [];

    // Admins can see all vehicles, drivers can see their assigned vehicles
    if (req.user.role === 'driver') {
      query += ' WHERE v.driver_id = ?';
      params = [req.user.id];
    }

    const vehicles = db.prepare(query).all(...params);
    res.json(vehicles);
  } catch (err) {
    res.status(500).json({ message: 'Error fetching vehicles', error: err.message });
  }
});

app.get('/vehicles/:id', authenticateJWT, (req, res) => {
  try {
    const vehicle = db.prepare(`
      SELECT v.*, u.user_name as driver_name
      FROM vehicles v
      LEFT JOIN users u ON v.driver_id = u.id
      WHERE v.id = ?
    `).get(req.params.id);

    if (!vehicle) {
      return res.status(404).json({ message: 'Vehicle not found' });
    }

    res.json(vehicle);
  } catch (err) {
    res.status(500).json({ message: 'Error fetching vehicle', error: err.message });
  }
});

app.put('/vehicles/:id', authenticateJWT, authorizeRole(['admin']), (req, res) => {
  const { plate_number, make, model, year, capacity, status, driver_id } = req.body;

  try {
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
app.post('/routes', authenticateJWT, authorizeRole(['admin']), (req, res) => {
  const { route_name, start_location, end_location, distance, estimated_time } = req.body;

  if (!route_name || !start_location || !end_location || !distance || !estimated_time) {
    return res.status(400).json({
      message: 'Route name, start location, end location, distance, and estimated time are required'
    });
  }

  try {
    const stmt = db.prepare(`
      INSERT INTO routes (route_name, start_location, end_location, distance, estimated_time)
      VALUES (?, ?, ?, ?, ?)
    `);
    const result = stmt.run(route_name, start_location, end_location, distance, estimated_time);

    res.status(201).json({
      message: 'Route added successfully',
      routeId: result.lastInsertRowid
    });
  } catch (err) {
    res.status(500).json({ message: 'Error adding route', error: err.message });
  }
});

app.get('/routes', authenticateJWT, (req, res) => {
  try {
    const routes = db.prepare('SELECT * FROM routes').all();
    res.json(routes);
  } catch (err) {
    res.status(500).json({ message: 'Error fetching routes', error: err.message });
  }
});

// Trip management routes
app.post('/trips', authenticateJWT, authorizeRole(['admin', 'driver']), (req, res) => {
  const { route_id, vehicle_id, driver_id, departure_time, arrival_time, fare, available_seats } = req.body;

  if (!route_id || !vehicle_id || !driver_id || !departure_time || !arrival_time || !fare || !available_seats) {
    return res.status(400).json({
      message: 'All trip details are required'
    });
  }

  try {
    // Check if driver has permission (admin can assign to any driver, driver can only assign to themselves)
    if (req.user.role === 'driver' && req.user.id !== driver_id) {
      return res.status(403).json({ message: 'You can only create trips for yourself' });
    }

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
    res.status(500).json({ message: 'Error creating trip', error: err.message });
  }
});

app.get('/trips', authenticateJWT, (req, res) => {
  try {
    let query = `
      SELECT t.*, r.route_name, r.start_location, r.end_location, v.plate_number, u.user_name as driver_name
      FROM trips t
      JOIN routes r ON t.route_id = r.id
      JOIN vehicles v ON t.vehicle_id = v.id
      JOIN users u ON t.driver_id = u.id
    `;
    let params = [];

    // Passengers see upcoming trips, drivers see their trips, admins see all
    if (req.user.role === 'passenger') {
      query += ' WHERE t.status = ? AND t.departure_time > ?';
      params = ['scheduled', new Date().toISOString()];
    } else if (req.user.role === 'driver') {
      query += ' WHERE t.driver_id = ?';
      params = [req.user.id];
    }

    query += ' ORDER BY t.departure_time ASC';

    const trips = db.prepare(query).all(...params);
    res.json(trips);
  } catch (err) {
    res.status(500).json({ message: 'Error fetching trips', error: err.message });
  }
});

// Booking routes
app.post('/bookings', authenticateJWT, authorizeRole(['passenger']), (req, res) => {
  const { trip_id, seat_number } = req.body;

  if (!trip_id || !seat_number) {
    return res.status(400).json({ message: 'Trip ID and seat number are required' });
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
      INSERT INTO bookings (trip_id, passenger_id, seat_number, total_amount)
      VALUES (?, ?, ?, ?)
    `);
    const result = stmt.run(trip_id, req.user.id, seat_number, fare);

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
      SELECT b.*, t.departure_time, t.arrival_time, r.route_name, r.start_location, r.end_location, v.plate_number
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

app.use('/uploads/driver', express.static(path.join(__dirname, 'uploads/driver')));
app.use('/uploads/vehicle', express.static(path.join(__dirname, 'uploads/vehicle')));

app.get('/uploads/vehicles/*splatVehicle', (req, res) => {
  const requestedPath = req.params.splatVehicle; // Gets everything after /uploads/vehicles/
  const fullPath = path.join(__dirname, 'uploads', 'vehicles', requestedPath);

  // Security check to prevent directory traversal (important!)
  const allowedDir = path.resolve(path.join(__dirname, 'uploads', 'vehicles'));
  const resolvedPath = path.resolve(fullPath);

  if (!resolvedPath.startsWith(allowedDir)) {
    console.log("Attempted directory traversal detected:", req.ip, req.path);
    return res.status(403).send('Forbidden');
  }

  res.sendFile(fullPath, (err) => {
    if (err) {
      console.error("File not found:", fullPath, err.message);
      res.status(404).send('File not found');
    }
  });
});

app.get('/uploads/drivers/*splatDriver', (req, res) => {
  const requestedPath = req.params.splatDriver; // Gets everything after /uploads/drivers/
  const fullPath = path.join(__dirname, 'uploads', 'drivers', requestedPath);

  // Security check to prevent directory traversal (important!)
  const allowedDir = path.resolve(path.join(__dirname, 'uploads', 'drivers'));
  const resolvedPath = path.resolve(fullPath);

  if (!resolvedPath.startsWith(allowedDir)) {
    console.log("Attempted directory traversal detected:", req.ip, req.path);
    return res.status(403).send('Forbidden');
  }

  res.sendFile(fullPath, (err) => {
    if (err) {
      console.error("File not found:", fullPath, err.message);
      res.status(404).send('File not found');
    }
  });
});

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
