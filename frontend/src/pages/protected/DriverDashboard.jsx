// src/pages/DriverDashboard.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import MapComponent from '../components/MapComponent';
import { BusFront, Navigation, Users, MapPin, Settings, User } from 'lucide-react';

const DriverDashboard = () => {
  const navigate = useNavigate();
  const { user, isLogged, loading, logout, getAuthHeader } = useAuth();
  const [buses, setBuses] = useState([]);
  const [trips, setTrips] = useState([]);
  const [passengers, setPassengers] = useState([]);
  const [selectedBus, setSelectedBus] = useState(null);
  const [isOnline, setIsOnline] = useState(false); // Driver's online status
  const [locationEnabled, setLocationEnabled] = useState(true);
  const [userLocation, setUserLocation] = useState(null);
  const [hasGeolocationError, setHasGeolocationError] = useState(false);

  // Fetch buses assigned to the driver
  useEffect(() => {
    if (!isLogged || !user || user.role !== 'driver') {
      navigate('/'); // Redirect if not logged in as driver
      return;
    }

    const fetchDriverBuses = async () => {
      try {
        const response = await fetch('http://localhost:5000/vehicles', {
          headers: getAuthHeader(),
        });
        if (!response.ok) throw new Error('Failed to fetch vehicles');
        const data = await response.json();
        // Filter vehicles assigned to the current driver
        const driverBuses = data.filter(v => v.driver_id == user.id); // Note: == for potential string/number comparison
        setBuses(driverBuses);
        if (driverBuses.length > 0 && !selectedBus) {
          setSelectedBus(driverBuses[0]); // Auto-select first bus
        }
      } catch (err) {
        console.error('Error fetching driver vehicles:', err);
        // Handle error (e.g., show message)
      }
    };

    const fetchDriverTrips = async () => {
      try {
        const response = await fetch('http://localhost:5000/trips', {
          headers: getAuthHeader(),
        });
        if (!response.ok) throw new Error('Failed to fetch trips');
        const data = await response.json();
        // Filter trips for the current driver
        const driverTrips = data.filter(t => t.driver_id == user.id);
        setTrips(driverTrips);
      } catch (err) {
        console.error('Error fetching driver trips:', err);
        // Handle error
      }
    };

    fetchDriverBuses();
    fetchDriverTrips();
  }, [isLogged, user, navigate, getAuthHeader, selectedBus]);

  // Fetch passengers for the selected trip (if any)
  useEffect(() => {
    if (!selectedBus) {
      setPassengers([]);
      return;
    }

    // Find an active trip for the selected bus assigned to this driver
    const activeTrip = trips.find(t => t.vehicle_id == selectedBus.id && t.status === 'on_route');
    if (activeTrip) {
      // Fetch bookings for this trip
      const fetchTripPassengers = async () => {
        try {
          // Assuming you have an endpoint to get bookings for a trip
          const response = await fetch(`http://localhost:5000/bookings/trip/${activeTrip.id}`, {
            headers: getAuthHeader(),
          });
          if (!response.ok) throw new Error('Failed to fetch trip passengers');
          const data = await response.json();
          setPassengers(data);
        } catch (err) {
          console.error('Error fetching trip passengers:', err);
          setPassengers([]); // Reset on error
        }
      };
      fetchTripPassengers();
    } else {
      setPassengers([]); // No active trip, no passengers
    }

  }, [selectedBus, trips, getAuthHeader]);

  // Geolocation for driver
  useEffect(() => {
    if (!locationEnabled || !isOnline) return; // Only watch if enabled and online

    if (!navigator.geolocation) {
      if (!hasGeolocationError) {
        alert('Geolocation is not supported by this browser.');
        setHasGeolocationError(true);
      }
      return;
    }

    const handleGeoError = (error) => {
      console.error('Geolocation error:', error);
      if (!hasGeolocationError) {
        let message = 'Unable to access your location.';
        if (error.code === 1) message = 'Location permission was denied.';
        alert(message);
        setHasGeolocationError(true);
      }
    };

    const updateLocationInDB = async (position) => {
      if (!selectedBus) return; // Can't update if no bus selected
      const lat = position.coords.latitude;
      const lng = position.coords.longitude;
      setUserLocation({ lat, lng });

      // Update the vehicle's location in the database
      // You might need a new endpoint like /vehicles/:id/update-location
      // For now, let's assume we update the vehicle record itself
      try {
        const response = await fetch(`http://localhost:5000/vehicles/${selectedBus.id}`, {
          method: 'PUT',
          headers: {
            ...getAuthHeader(),
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            ...selectedBus, // Include other fields if needed
            current_location: { lat, lng }, // Add current location
            // You might want to update status too if driver goes online/offline
            status: isOnline ? 'active' : 'inactive'
          }),
        });
        if (!response.ok) {
          console.error('Failed to update vehicle location in DB');
          // Note: This is a simplified approach. You might want to store location in a separate table
          // or update a 'current_location' field on the trip record if available.
        }
      } catch (err) {
        console.error('Error updating location:', err);
      }
    };

    const watchId = navigator.geolocation.watchPosition(
      updateLocationInDB,
      handleGeoError,
      { enableHighAccuracy: true, maximumAge: 10000, timeout: 5000 }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, [locationEnabled, isOnline, selectedBus, getAuthHeader, hasGeolocationError]);

  const handleLocationToggle = (enabled) => {
    setLocationEnabled(enabled);
    if (!enabled) {
      // Optionally clear location in DB when disabled
      setUserLocation(null);
    }
  };

  if (loading || !isLogged || (user && user.role !== 'driver')) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-950 via-blue-950 to-slate-950">
        <p className="text-slate-300">Loading dashboard...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-blue-950 to-slate-950 text-white p-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-white">Bus Driver Dashboard</h1>
              <p className="text-slate-400">Manage your route and passengers</p>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${isOnline ? 'bg-green-500/20 text-green-400' : 'bg-slate-700 text-slate-400'}`}>
                  {isOnline ? 'Online' : 'Offline'}
                </span>
                <button
                  onClick={() => setIsOnline(!isOnline)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${isOnline ? 'bg-cyan-500' : 'bg-slate-600'}`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${isOnline ? 'translate-x-6' : 'translate-x-1'}`}
                  />
                </button>
              </div>
              <div className="flex items-center gap-2">
                <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${locationEnabled ? 'bg-cyan-500/20 text-cyan-400' : 'bg-slate-700 text-slate-400'}`}>
                  <MapPin className="w-4 h-4 mr-1" />
                  {locationEnabled ? 'Sharing' : 'Hidden'}
                </span>
                <button
                  onClick={() => handleLocationToggle(!locationEnabled)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${locationEnabled ? 'bg-cyan-500' : 'bg-slate-600'}`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${locationEnabled ? 'translate-x-6' : 'translate-x-1'}`}
                  />
                </button>
              </div>
              <button
                onClick={logout}
                className="text-red-400 hover:text-red-300 transition-colors"
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl p-6 border border-slate-700">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-400">Active Trips</p>
                <h3 className="text-2xl font-bold text-white">
                  {trips.filter(t => t.status === 'on_route').length}
                </h3>
              </div>
              <Navigation className="w-8 h-8 text-cyan-500" />
            </div>
          </div>
          <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl p-6 border border-slate-700">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-400">Total Passengers</p>
                <h3 className="text-2xl font-bold text-white">{passengers.length}</h3>
              </div>
              <Users className="w-8 h-8 text-blue-500" />
            </div>
          </div>
          <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl p-6 border border-slate-700">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-400">Assigned Buses</p>
                <h3 className="text-2xl font-bold text-white">{buses.length}</h3>
              </div>
              <BusFront className="w-8 h-8 text-green-500" />
            </div>
          </div>
          <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl p-6 border border-slate-700">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-400">Current Bus</p>
                <h3 className="text-lg font-bold text-white">
                  {selectedBus ? selectedBus.plate_number : 'N/A'}
                </h3>
              </div>
              <Settings className="w-8 h-8 text-purple-500" />
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Map Section */}
          <div className="lg:col-span-2">
            <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl p-6 border border-slate-700 h-[500px]">
              <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                <Navigation className="w-5 h-5" />
                Live Tracking Map
              </h2>
              <div className="h-[calc(100%-40px)] rounded-xl overflow-hidden">
                <MapComponent
                  role="driver"
                  buses={buses.map(b => ({ ...b, currentLocation: b.current_location }))}
                  passengers={passengers}
                  selectedBus={selectedBus}
                  onBusSelect={setSelectedBus}
                  userLocation={userLocation}
                  locationEnabled={locationEnabled}
                />
              </div>
            </div>
          </div>

          {/* Right Panel - Driver Controls & Passenger List */}
          <div className="space-y-6">
            {/* Driver Controls */}
            {selectedBus && (
              <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl p-6 border border-slate-700">
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <BusFront className="w-5 h-5" />
                  Bus: {selectedBus.plate_number}
                </h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm text-slate-400 mb-1">Status</label>
                    <p className="text-white">{selectedBus.status}</p>
                  </div>
                  <div>
                    <label className="block text-sm text-slate-400 mb-1">Capacity</label>
                    <p className="text-white">{selectedBus.capacity} seats</p>
                  </div>
                  <div>
                    <label className="block text-sm text-slate-400 mb-1">Model</label>
                    <p className="text-white">{selectedBus.make} {selectedBus.model}</p>
                  </div>
                  {/* Add controls for trip status (start, end, update) if needed */}
                </div>
              </div>
            )}

            {/* Passenger List */}
            <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl p-6 border border-slate-700">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Users className="w-5 h-5" />
                Passengers ({passengers.length})
              </h3>
              {passengers.length === 0 ? (
                <p className="text-slate-400 text-center py-4">No passengers on this trip.</p>
              ) : (
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {passengers.map((passenger) => (
                    <div key={passenger.id} className="flex items-center justify-between p-3 bg-slate-700/50 rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-cyan-500/20 flex items-center justify-center">
                          <User className="w-5 h-5 text-cyan-400" />
                        </div>
                        <div>
                          <p className="font-medium text-white">{passenger.name}</p>
                          <p className="text-xs text-slate-400">Seat: {passenger.seat_number}</p>
                        </div>
                      </div>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${passenger.status === 'confirmed' ? 'bg-green-500/20 text-green-400' :
                        passenger.status === 'pending' ? 'bg-yellow-500/20 text-yellow-400' :
                          'bg-red-500/20 text-red-400'
                        }`}>
                        {passenger.status}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DriverDashboard;
