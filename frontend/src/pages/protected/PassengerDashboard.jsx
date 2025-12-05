// src/pages/PassengerDashboard.jsx

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import MapComponent from '../../components/MapComponent';
import { Navigation, MapPin, Ticket, Users, Clock, Smartphone } from 'lucide-react';

const PassengerDashboard = () => {
  const navigate = useNavigate();
  const { user, isLogged, loading, logout, getAuthHeader } = useAuth();
  const [buses, setBuses] = useState([]); // Represents trips
  const [trips, setTrips] = useState([]); // Store trips separately if needed
  const [bookings, setBookings] = useState([]);
  const [selectedBus, setSelectedBus] = useState(null);
  const [pickupLocation, setPickupLocation] = useState(null); // Will be set when booking
  const [dropoffLocation, setDropoffLocation] = useState(null); // Will be set when booking
  const [bookingLoading, setBookingLoading] = useState(false);
  const [userLocation, setUserLocation] = useState(null);
  const [locationEnabled, setLocationEnabled] = useState(true);
  const [hasGeolocationError, setHasGeolocationError] = useState(false);
  const [proximityLevel, setProximityLevel] = useState(null); // For highlighting nearby buses

  // Fetch available buses (trips) and routes
  useEffect(() => {
    if (!isLogged || !user || user.role !== 'passenger') {
      navigate('/'); // Redirect if not logged in as passenger
      return;
    }

    const fetchBusesAndTrips = async () => {
      try {
        // Fetch all active trips with locations and approved routes
        const tripsResponse = await fetch('http://localhost:5000/trips', { // This endpoint already filters for approved routes for passengers
          headers: getAuthHeader(),
        });
        if (!tripsResponse.ok) throw new Error('Failed to fetch trips');
        const tripsData = await tripsResponse.json();
        setTrips(tripsData);
        setBuses(tripsData); // Buses now represent trips with location info
      } catch (err) {
        console.error('Error fetching data:', err);
      }
    };

    const fetchPassengerBookings = async () => {
      try {
        const response = await fetch('http://localhost:5000/bookings', {
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
      },
      handleGeoError,
      { enableHighAccuracy: true, maximumAge: 10000, timeout: 5000 }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, [locationEnabled, hasGeolocationError]);

  // Handle bus selection - Fetch route details for the selected bus
  const handleBusSelect = async (bus) => {
    setSelectedBus(bus);
    // Optionally, fetch the specific route details here if not included in the trip data
    // const routeResponse = await fetch(`http://localhost:5000/routes/${bus.route_id}`, { headers: getAuthHeader() });
    // if (routeResponse.ok) {
    //   const routeData = await routeResponse.json();
    //   // Update bus object with route details if needed
    // }
  };

  const handleBookBus = async () => {
    if (!selectedBus) {
      alert('Please select a bus first.');
      return;
    }

    // Prompt for pickup and dropoff locations when booking
    const pickupLat = prompt('Enter pickup latitude:');
    const pickupLng = prompt('Enter pickup longitude:');
    const dropoffLat = prompt('Enter dropoff latitude:');
    const dropoffLng = prompt('Enter dropoff longitude:');

    if (!pickupLat || !pickupLng || !dropoffLat || !dropoffLng) {
      alert('Pickup and dropoff locations are required.');
      return;
    }

    const pickupLoc = { lat: parseFloat(pickupLat), lng: parseFloat(pickupLng), name: `Pickup (${pickupLat}, ${pickupLng})` };
    const dropoffLoc = { lat: parseFloat(dropoffLat), lng: parseFloat(dropoffLng), name: `Dropoff (${dropoffLat}, ${dropoffLng})` };

    // Basic validation
    if (isNaN(pickupLoc.lat) || isNaN(pickupLoc.lng) || isNaN(dropoffLoc.lat) || isNaN(dropoffLoc.lng)) {
      alert('Please enter valid numeric coordinates.');
      return;
    }

    setBookingLoading(true);
    try {
      // Find an available seat number (this is a simplification)
      if (selectedBus.available_seats <= 0) {
        alert('No seats available on this trip.');
        setBookingLoading(false);
        return;
      }
      const seatNumber = 1; // Simplified

      const bookingData = {
        trip_id: selectedBus.id,
        passenger_id: user.id,
        seat_number: seatNumber,
        pickup_location: pickupLoc,
        dropoff_location: dropoffLoc,
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
      setBookings(prev => [...prev, { id: result.bookingId, ...bookingData, status: 'confirmed' }]);
      setBuses(prev => prev.map(b => b.id === selectedBus.id ? { ...b, available_seats: b.available_seats - 1 } : b)); // Update local trip seat count
      // Reset selection after booking
      setSelectedBus(null);
      setPickupLocation(null);
      setDropoffLocation(null);

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
              {selectedBus ? (
                <div className="mb-4 p-3 bg-slate-700 rounded">
                  <p className="font-medium text-white">Selected Bus: {selectedBus.route_name} ({selectedBus.plate_number})</p>
                  <p className="text-sm text-slate-300">Available Seats: {selectedBus.available_seats}</p>
                </div>
              ) : (
                <p className="text-slate-400 text-sm mb-4">Select a bus on the map to view details.</p>
              )}
              <button
                onClick={handleBookBus}
                disabled={!selectedBus || bookingLoading}
                className={`w-full py-2 px-4 rounded-lg transition-colors ${!selectedBus || bookingLoading
                  ? 'bg-slate-700 cursor-not-allowed'
                  : 'bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500'
                  }`}
              >
                {bookingLoading ? 'Booking...' : 'Book Selected Bus'}
              </button>
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
                          <p className="text-sm text-slate-400">Trip: {booking.route_name || 'N/A'}</p>
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
                </div>
              </div>
              <div className="h-[calc(100%-50px)] rounded-xl overflow-hidden">
                <MapComponent
                  role="passenger"
                  buses={buses.map(b => ({ ...b, currentLocation: b.current_location }))}
                  selectedBus={selectedBus}
                  onBusSelect={handleBusSelect} // Use the new handler
                  // Remove onLocationSelect as passenger doesn't select locations directly anymore
                  // onLocationSelect={handleLocationSelect}
                  pickupLocation={pickupLocation}
                  dropoffLocation={dropoffLocation}
                  userLocation={userLocation}
                  locationEnabled={locationEnabled}
                  proximityLevel={proximityLevel}
                  showRouteForSelectedBus={!!selectedBus} // Tell MapComponent to show route if bus is selected
                />
              </div>
            </div>
            {/* Instructions */}
            <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl p-4 border border-slate-700">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-cyan-500/20 flex items-center justify-center">
                    <Navigation className="w-5 h-5 text-cyan-400" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-white">View Routes</h4>
                    <p className="text-sm text-slate-400">Click bus to see its route</p>
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
