// src/pages/PassengerDashboard.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import MapComponent from '../components/MapComponent';
import { Navigation, MapPin, Ticket, Users, Clock, Smartphone } from 'lucide-react';

const PassengerDashboard = () => {
  const navigate = useNavigate();
  const { user, isLogged, loading, logout, getAuthHeader } = useAuth();
  const [buses, setBuses] = useState([]);
  const [trips, setTrips] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [selectedBus, setSelectedBus] = useState(null);
  const [pickupLocation, setPickupLocation] = useState(null);
  const [dropoffLocation, setDropoffLocation] = useState(null);
  const [bookingLoading, setBookingLoading] = useState(false);
  const [userLocation, setUserLocation] = useState(null);
  const [locationEnabled, setLocationEnabled] = useState(true);
  const [hasGeolocationError, setHasGeolocationError] = useState(false);
  const [proximityLevel, setProximityLevel] = useState(null); // For highlighting nearby buses

  // Fetch available buses and trips
  useEffect(() => {
    if (!isLogged || !user || user.role !== 'passenger') {
      navigate('/'); // Redirect if not logged in as passenger
      return;
    }

    const fetchBusesAndTrips = async () => {
      try {
        // Fetch all active trips
        const tripsResponse = await fetch('http://localhost:5000/trips', {
          headers: getAuthHeader(),
        });
        if (!tripsResponse.ok) throw new Error('Failed to fetch trips');
        const tripsData = await tripsResponse.json();
        setTrips(tripsData);

        // Fetch all vehicles to get bus details
        const vehiclesResponse = await fetch('http://localhost:5000/vehicles', {
          headers: getAuthHeader(),
        });
        if (!vehiclesResponse.ok) throw new Error('Failed to fetch vehicles');
        const vehiclesData = await vehiclesResponse.json();

        // Combine trip and vehicle data to get bus info with location
        const busesWithLocation = tripsData
          .filter(trip => trip.status === 'on_route' || trip.status === 'scheduled') // Only show active/scheduled trips
          .map(trip => {
            const vehicle = vehiclesData.find(v => v.id == trip.vehicle_id);
            return {
              ...vehicle,
              current_location: vehicle?.current_location, // Assuming you add this field when updating location
              trip_info: trip // Include trip details if needed
            };
          })
          .filter(bus => bus.current_location); // Only buses with location

        setBuses(busesWithLocation);
      } catch (err) {
        console.error('Error fetching data:', err);
        // Handle error
      }
    };

    const fetchPassengerBookings = async () => {
      try {
        // Assuming you have an endpoint to get bookings for the current user
        // This might require modifying your backend to filter by passenger_id
        // For now, let's assume it's available at /bookings/passenger
        const response = await fetch('http://localhost:5000/bookings/passenger', {
          headers: getAuthHeader(),
        });
        if (!response.ok) throw new Error('Failed to fetch bookings');
        const data = await response.json();
        setBookings(data);
      } catch (err) {
        console.error('Error fetching bookings:', err);
        setBookings([]);
      }
    };

    fetchBusesAndTrips();
    fetchPassengerBookings();
  }, [isLogged, user, navigate, getAuthHeader]);

  // Geolocation for passenger
  useEffect(() => {
    if (!locationEnabled) return;

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

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        setUserLocation({ lat, lng });

        // Optional: Update user's location in your system if needed for proximity alerts
        // This would require a backend endpoint to store passenger location temporarily
      },
      handleGeoError,
      { enableHighAccuracy: true, maximumAge: 10000, timeout: 5000 }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, [locationEnabled, hasGeolocationError]);

  // Handle location selection from map click
  const handleLocationSelect = (location) => {
    if (!pickupLocation) {
      setPickupLocation(location);
    } else if (!dropoffLocation) {
      setDropoffLocation(location);
    } else {
      // If both are set, reset and set new pickup
      setPickupLocation(location);
      setDropoffLocation(null);
    }
  };

  const handleResetLocations = () => {
    setPickupLocation(null);
    setDropoffLocation(null);
    setSelectedBus(null); // Reset selected bus when locations are reset
  };

  const handleBookBus = async () => {
    if (!selectedBus || !pickupLocation || !dropoffLocation) {
      alert('Please select a bus and set pickup/dropoff locations.');
      return;
    }

    setBookingLoading(true);
    try {
      // Find the trip ID for the selected bus
      const trip = trips.find(t => t.vehicle_id == selectedBus.id && (t.status === 'on_route' || t.status === 'scheduled'));
      if (!trip) {
        alert('Selected bus has no active trip.');
        setBookingLoading(false);
        return;
      }

      // Find an available seat number (this is a simplification)
      // You might need a backend endpoint to find an available seat
      // For now, let's assume seat 1 is available if available_seats > 0
      if (trip.available_seats <= 0) {
        alert('No seats available on this trip.');
        setBookingLoading(false);
        return;
      }
      const seatNumber = 1; // Simplified

      const bookingData = {
        trip_id: trip.id,
        passenger_id: user.id,
        seat_number: seatNumber,
        pickup_location: pickupLocation,
        dropoff_location: dropoffLocation,
        // Add other booking details if needed
      };

      const response = await fetch('http://localhost:5000/bookings', {
        method: 'POST',
        headers: {
          ...getAuthHeader(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(bookingData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to book bus');
      }

      const result = await response.json();
      alert('Booking confirmed successfully!');
      setBookings(prev => [...prev, { id: result.bookingId, ...bookingData, status: 'confirmed' }]); // Update local state
      handleResetLocations(); // Clear selections after booking

    } catch (error) {
      console.error('Booking error:', error);
      alert('Booking failed: ' + error.message);
    } finally {
      setBookingLoading(false);
    }
  };

  if (loading || !isLogged || (user && user.role !== 'passenger')) {
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
        <div className="mb-8">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-white">Passenger Bus Tracker</h1>
              <p className="text-slate-400">Book buses in real-time and track their routes</p>
            </div>
            <div className="flex flex-col items-stretch md:items-end gap-3">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${locationEnabled ? 'bg-cyan-500/20 text-cyan-400' : 'bg-slate-700 text-slate-400'}`}>
                    <MapPin className="w-4 h-4 mr-1" />
                    {locationEnabled ? 'Sharing' : 'Hidden'}
                  </span>
                  <button
                    onClick={() => setLocationEnabled(!locationEnabled)}
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
        </div>

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Panel - Booking Controls */}
          <div className="space-y-6">
            {/* Booking Panel */}
            <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl p-6 border border-slate-700">
              <h2 className="text-xl font-semibold mb-4">Book a Bus</h2>
              {pickupLocation ? (
                <div className="mb-2 p-2 bg-slate-700 rounded">
                  <p className="text-sm text-slate-300">Pickup: ({pickupLocation.lat.toFixed(4)}, {pickupLocation.lng.toFixed(4)})</p>
                </div>
              ) : (
                <p className="text-slate-400 text-sm mb-2">Click map to select pickup location</p>
              )}
              {dropoffLocation ? (
                <div className="mb-4 p-2 bg-slate-700 rounded">
                  <p className="text-sm text-slate-300">Dropoff: ({dropoffLocation.lat.toFixed(4)}, {dropoffLocation.lng.toFixed(4)})</p>
                </div>
              ) : (
                <p className="text-slate-400 text-sm mb-4">Click map to select dropoff location</p>
              )}
              <div className="flex gap-2">
                <button
                  onClick={handleResetLocations}
                  className="flex-1 py-2 px-4 rounded-lg bg-slate-700 hover:bg-slate-600 transition-colors"
                >
                  Reset
                </button>
                <button
                  onClick={handleBookBus}
                  disabled={!selectedBus || !pickupLocation || !dropoffLocation || bookingLoading}
                  className={`flex-1 py-2 px-4 rounded-lg transition-colors ${!selectedBus || !pickupLocation || !dropoffLocation || bookingLoading
                    ? 'bg-slate-700 cursor-not-allowed'
                    : 'bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500'
                    }`}
                >
                  {bookingLoading ? 'Booking...' : 'Book Bus'}
                </button>
              </div>
            </div>

            {/* Current Bookings */}
            {bookings.length > 0 && (
              <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl p-6 border border-slate-700">
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <Ticket className="w-5 h-5" />
                  Your Bookings ({bookings.length})
                </h3>
                <div className="space-y-3 max-h-60 overflow-y-auto">
                  {bookings.map((booking) => (
                    <div key={booking.id} className="p-3 bg-slate-700/50 rounded-lg">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium text-white">Booking #{booking.id}</p>
                          <p className="text-sm text-slate-400">Trip ID: {booking.trip_id}</p>
                          <p className="text-xs text-slate-500">Seat: {booking.seat_number}</p>
                        </div>
                        <span className="px-2 py-1 rounded-full text-xs font-medium bg-green-500/20 text-green-400">
                          Confirmed
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Map Section */}
          <div className="lg:col-span-2">
            <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl p-6 border border-slate-700 h-[600px]">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold flex items-center gap-2">
                  <Navigation className="w-5 h-5" />
                  Available Buses
                </h2>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-slate-400">
                    {buses.filter(b => b.current_location).length} Active
                  </span>
                  {(pickupLocation || dropoffLocation) && (
                    <span className="text-sm text-slate-400">
                      <MapPin className="w-3 h-3 inline mr-1" />
                      {(pickupLocation ? 1 : 0) + (dropoffLocation ? 1 : 0)}/2
                    </span>
                  )}
                </div>
              </div>
              <div className="h-[calc(100%-50px)] rounded-xl overflow-hidden">
                <MapComponent
                  role="passenger"
                  buses={buses.map(b => ({ ...b, currentLocation: b.current_location }))}
                  selectedBus={selectedBus}
                  onBusSelect={setSelectedBus}
                  onLocationSelect={handleLocationSelect}
                  pickupLocation={pickupLocation}
                  dropoffLocation={dropoffLocation}
                  userLocation={userLocation}
                  locationEnabled={locationEnabled}
                  proximityLevel={proximityLevel} // Pass proximity level if implemented
                />
              </div>
            </div>
            {/* Instructions */}
            <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl p-4 border border-slate-700">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-cyan-500/20 flex items-center justify-center">
                    <MapPin className="w-5 h-5 text-cyan-400" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-white">Select Locations</h4>
                    <p className="text-sm text-slate-400">Click map for pickup & dropoff</p>
                  </div>
                </div>
              </div>
              <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl p-4 border border-slate-700">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center">
                    <Smartphone className="w-5 h-5 text-blue-400" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-white">Click Bus Icons</h4>
                    <p className="text-sm text-slate-400">Select bus to book</p>
                  </div>
                </div>
              </div>
              <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl p-4 border border-slate-700">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center">
                    <Clock className="w-5 h-5 text-green-400" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-white">Real-time Tracking</h4>
                    <p className="text-sm text-slate-400">Live bus locations</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PassengerDashboard;
