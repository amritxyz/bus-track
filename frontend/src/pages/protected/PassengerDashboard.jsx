// src/pages/PassengerDashboard.jsx

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import MapComponent from '../../components/MapComponent';
import { Navigation, MapPin, Ticket, Users, Clock, Smartphone, Bus, RotateCcw, ChevronDown, ChevronUp, Menu, X } from 'lucide-react';

const PassengerDashboard = () => {
  const navigate = useNavigate();
  const { user, isLogged, loading, logout, getAuthHeader } = useAuth();
  const [buses, setBuses] = useState([]); // Represents trips
  const [trips, setTrips] = useState([]); // Store trips separately if needed
  const [allRoutes, setAllRoutes] = useState([]); // Store approved routes for displaying on map
  const [bookings, setBookings] = useState([]);
  const [selectedBus, setSelectedBus] = useState(null);
  const [pickupLocation, setPickupLocation] = useState(null); // Will be set when booking via map
  const [dropoffLocation, setDropoffLocation] = useState(null); // Will be set when booking via map
  const [bookingLoading, setBookingLoading] = useState(false);
  const [userLocation, setUserLocation] = useState(null);
  const [locationEnabled, setLocationEnabled] = useState(true);
  const [hasGeolocationError, setHasGeolocationError] = useState(false);
  const [proximityLevel, setProximityLevel] = useState(null); // For highlighting nearby buses
  const [locationSelectionStep, setLocationSelectionStep] = useState(0); // 0: none, 1: pickup selected, 2: dropoff selected
  const [showLocationSelection, setShowLocationSelection] = useState(false); // Toggle for location selection UI
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // State to manage expanded sections
  // Only 'availableBuses', 'bookBus', 'yourBookings' are controlled for mutual exclusivity
  // 'tripDetails' is not applicable for passenger dashboard in this structure
  const [expandedSections, setExpandedSections] = useState({
    availableBuses: true, // Default open
    bookBus: false,
    yourBookings: false
  });

  // Toggle section visibility
  // This function ensures only one of the main sections is open
  const toggleSection = (section) => {
    setExpandedSections(prev => {
      // Define the sections that should be mutually exclusive
      const mainSections = ['availableBuses', 'bookBus', 'yourBookings'];

      // If the clicked section is one of the main ones, close the others
      if (mainSections.includes(section)) {
        const newExpanded = { ...prev };
        // Close all main sections
        mainSections.forEach(s => newExpanded[s] = false);
        // Toggle the clicked section
        newExpanded[section] = !prev[section];
        return newExpanded;
      } else {
        // If it's not a main section, just toggle it normally (though there are no other toggleable sections in this case)
        return {
          ...prev,
          [section]: !prev[section]
        };
      }
    });
  };

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
        console.log('✅ Fetched trips from API:', tripsData);
        setTrips(tripsData);
        setBuses(tripsData); // Buses now represent trips with location info
        console.log('✅ Set buses state to:', tripsData);
      } catch (err) {
        console.error('❌ Error fetching data:', err);
      }
    };

    const fetchRoutes = async () => {
      try {
        const resp = await fetch('http://localhost:5000/routes', { headers: getAuthHeader() });
        if (!resp.ok) throw new Error('Failed to fetch routes');
        const data = await resp.json();
        setAllRoutes(data);
      } catch (err) {
        console.error('Error fetching routes:', err);
        setAllRoutes([]);
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
    fetchRoutes();
  }, [isLogged, user, navigate, getAuthHeader]);

  // Memoize mapped buses passed to MapComponent to avoid new array each render
  const memoBuses = React.useMemo(() => buses.map(b => ({ ...b, currentLocation: b.current_location })), [buses]);
  const memoRoutes = React.useMemo(() => allRoutes, [allRoutes]);

  // Geolocation for passenger
  useEffect(() => {
    if (!locationEnabled) return;

    if (!navigator.geolocation) {
      console.warn('Geolocation is not supported by this browser.');
      setHasGeolocationError(true);
      return;
    }

    const handleGeoError = (error) => {
      console.error('Geolocation error:', error);
      // Don't show alerts repeatedly - just log errors
      let message = 'Unable to access your location.';
      if (error.code === 1) message = 'Location permission was denied.';
      else if (error.code === 2) message = 'Position unavailable - trying mock location.';
      else if (error.code === 3) message = 'Position acquisition timed out - trying mock location.';
      console.warn(message);

      // Set a mock/default location for development if geolocation fails
      // Users in real deployment would need GPS hardware or mock location
      if (error.code !== 1) { // Only use mock if not permission denied
        setUserLocation({ lat: 27.6884, lng: 83.4490 }); // Default to route start location
      }
    };

    // Try to get current position first with relaxed timeout
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        setUserLocation({ lat, lng });
      },
      handleGeoError,
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 0 }
    );

    // Then watch for position updates with relaxed settings
    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        setUserLocation({ lat, lng });
      },
      (error) => {
        console.warn('Watch position error:', error);
        // Don't fail completely on watch errors
      },
      { enableHighAccuracy: false, maximumAge: 30000, timeout: 15000 }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, [locationEnabled]);

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

  // Handler when user clicks 'Book this trip' from a route popup on the map
  const handleBookTripFromMap = (trip) => {
    if (!trip) return;
    // Ensure trip object corresponds to the same structure used elsewhere
    setSelectedBus(trip);
    // Start location selection flow
    setShowLocationSelection(true);
    setLocationSelectionStep(0);
    setPickupLocation(null);
    setDropoffLocation(null);
    // Optionally scroll booking panel into view
    const bookingPanel = document.querySelector('[data-booking-panel]');
    if (bookingPanel) bookingPanel.scrollIntoView({ behavior: 'smooth', block: 'center' });
    // Open the booking section
    setExpandedSections(prev => ({ ...prev, bookBus: true, availableBuses: false, yourBookings: false }));
  };

  // Handle map click for location selection during booking
  const handleMapClickForLocation = (location) => {
    if (!showLocationSelection) return;

    let newStep = locationSelectionStep;

    if (newStep === 0) {
      // First click: set pickup
      setPickupLocation({ ...location, name: `Pickup (${location.lat.toFixed(4)}, ${location.lng.toFixed(4)})` });
      newStep = 1;
    } else if (newStep === 1) {
      // Second click: set dropoff
      setDropoffLocation({ ...location, name: `Dropoff (${location.lat.toFixed(4)}, ${location.lng.toFixed(4)})` });
      newStep = 2;
    } else if (newStep === 2) {
      // Third click: reset pickup to new location, clear dropoff
      setPickupLocation({ ...location, name: `Pickup (${location.lat.toFixed(4)}, ${location.lng.toFixed(4)})` });
      setDropoffLocation(null);
      newStep = 1; // Now waiting for the new dropoff point
    }

    setLocationSelectionStep(newStep);
  };

  // Start location selection process
  const handleStartLocationSelection = () => {
    if (!selectedBus) {
      alert('Please select a bus first.');
      return;
    }
    setShowLocationSelection(true);
    setLocationSelectionStep(0);
    setPickupLocation(null);
    setDropoffLocation(null);
  };

  // Reset location selection
  const handleResetLocationSelection = () => {
    setPickupLocation(null);
    setDropoffLocation(null);
    setLocationSelectionStep(0);
    setShowLocationSelection(false);
  };

  // Complete booking with selected locations
  const handleCompleteBooking = async () => {
    if (!selectedBus) {
      alert('Please select a bus first.');
      return;
    }

    if (!pickupLocation || !dropoffLocation) {
      alert('Please select both pickup and dropoff locations on the map.');
      return;
    }

    setBookingLoading(true);
    try {
      // Ensure seats are available
      if (selectedBus.available_seats <= 0) {
        alert('No seats available on this trip.');
        setBookingLoading(false);
        return;
      }

      // Determine the next available seat number by querying existing bookings for this trip
      let seatNumber = 1;
      try {
        const bkResp = await fetch(`http://localhost:5000/bookings?trip_id=${selectedBus.id}`, {
          headers: getAuthHeader(),
        });
        if (bkResp.ok) {
          const existing = await bkResp.json();
          const taken = new Set(existing.filter(b => b.status !== 'cancelled').map(b => Number(b.seat_number)));
          while (taken.has(seatNumber)) seatNumber += 1;
        } else {
          // If we couldn't fetch bookings, fall back to seat 1
          seatNumber = 1;
        }
      } catch (err) {
        console.warn('Could not determine taken seats, defaulting to seat 1', err);
        seatNumber = 1;
      }

      const bookingData = {
        trip_id: selectedBus.id,
        passenger_id: user.id,
        seat_number: seatNumber,
        pickup_location: pickupLocation,
        dropoff_location: dropoffLocation,
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
      handleResetLocationSelection();
      // Optionally close the booking section after successful booking
      setExpandedSections(prev => ({ ...prev, bookBus: false }));

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
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-blue-950 to-slate-950 text-white">
      {/* Mobile Menu Button */}
      <button
        onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
        className="lg:hidden fixed top-4 right-4 z-50 p-2 bg-slate-800/80 backdrop-blur-sm rounded-lg border border-slate-700"
      >
        {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
      </button>
      <div className="max-w-7xl mx-auto p-4">
        {/* Header */}
        <div className="mb-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-white">Passenger Bus Tracker</h1>
              <p className="text-slate-400 text-sm md:text-base">Book buses in real-time and track their routes</p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs md:text-sm font-medium ${locationEnabled ? 'bg-cyan-500/20 text-cyan-400' : 'bg-slate-700 text-slate-400'}`}>
                  <MapPin className="w-3 h-3 md:w-4 md:h-4 mr-1" />
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
                className="text-red-400 hover:text-red-300 transition-colors text-sm md:text-base"
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-6">
          <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl p-4 md:p-6 border border-slate-700">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs md:text-sm text-slate-400">Available Buses</p>
                <h3 className="text-xl md:text-2xl font-bold text-white">{buses.length}</h3>
              </div>
              <Bus className="w-6 h-6 md:w-8 md:h-8 text-cyan-500" />
            </div>
          </div>
          <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl p-4 md:p-6 border border-slate-700">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs md:text-sm text-slate-400">Active Bookings</p>
                <h3 className="text-xl md:text-2xl font-bold text-white">{bookings.filter(b => b.status !== 'cancelled').length}</h3>
              </div>
              <Ticket className="w-6 h-6 md:w-8 md:h-8 text-blue-500" />
            </div>
          </div>
          <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl p-4 md:p-6 border border-slate-700">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs md:text-sm text-slate-400">Total Trips</p>
                <h3 className="text-xl md:text-2xl font-bold text-white">{trips.length}</h3>
              </div>
              <Clock className="w-6 h-6 md:w-8 md:h-8 text-green-500" />
            </div>
          </div>
          <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl p-4 md:p-6 border border-slate-700">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs md:text-sm text-slate-400">Routes</p>
                <h3 className="text-xl md:text-2xl font-bold text-white">{allRoutes.length}</h3>
              </div>
              <Navigation className="w-6 h-6 md:w-8 md:h-8 text-purple-500" />
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
          {/* Left Panel - Collapsible Sections */}
          <div className={`lg:col-span-1 ${mobileMenuOpen ? 'block' : 'hidden lg:block'} space-y-4 md:space-y-6`}>
            {/* Available Buses Section */}
            <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl border border-slate-700 overflow-hidden">
              <button
                onClick={() => toggleSection('availableBuses')}
                className="w-full p-4 md:p-6 flex items-center justify-between hover:bg-slate-700/30 transition-colors"
              >
                <h3 className="text-base md:text-lg font-semibold flex items-center gap-2">
                  <Bus className="w-4 h-4 md:w-5 md:h-5" />
                  Available Buses ({buses.length})
                </h3>
                {expandedSections.availableBuses ? (
                  <ChevronUp className="w-4 h-4 md:w-5 md:h-5" />
                ) : (
                  <ChevronDown className="w-4 h-4 md:w-5 md:h-5" />
                )}
              </button>
              {expandedSections.availableBuses && (
                <div className="p-4 md:p-6 pt-0">
                  {buses.length === 0 ? (
                    <p className="text-slate-400 text-sm">No buses available at the moment.</p>
                  ) : (
                    <div className="space-y-2 max-h-60 overflow-y-auto">
                      {buses.map((bus) => (
                        <div
                          key={bus.id}
                          onClick={() => handleBusSelect(bus)}
                          className={`p-3 rounded-lg cursor-pointer transition-all ${selectedBus?.id === bus.id
                              ? 'bg-cyan-500/30 border border-cyan-500'
                              : 'bg-slate-700/50 border border-slate-600 hover:bg-slate-700'
                            }`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex-1">
                              <p className="font-medium text-white text-sm">{bus.route_name}</p>
                              <p className="text-xs text-slate-400">{bus.plate_number}</p>
                              <div className="flex items-center justify-between mt-2">
                                <p className="text-xs text-slate-300">
                                  Departs: <span className="text-cyan-400">{new Date(bus.departure_time).toLocaleTimeString()}</span>
                                </p>
                                <p className="text-xs text-slate-300">
                                  Seats: <span className="text-green-400 font-semibold">{bus.available_seats}</span>
                                </p>
                              </div>
                              <p className="text-xs text-slate-500 mt-1">₹{bus.fare}/person</p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Book Bus Section */}
            <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl border border-slate-700 overflow-hidden">
              <button
                onClick={() => toggleSection('bookBus')}
                className="w-full p-4 md:p-6 flex items-center justify-between hover:bg-slate-700/30 transition-colors"
              >
                <h3 className="text-base md:text-lg font-semibold flex items-center gap-2">
                  <Ticket className="w-4 h-4 md:w-5 md:h-5" />
                  Book Selected Bus
                </h3>
                {expandedSections.bookBus ? (
                  <ChevronUp className="w-4 h-4 md:w-5 md:h-5" />
                ) : (
                  <ChevronDown className="w-4 h-4 md:w-5 md:h-5" />
                )}
              </button>
              {expandedSections.bookBus && (
                <div className="p-4 md:p-6 pt-0 space-y-4">
                  {selectedBus ? (
                    <div className="space-y-4">
                      <div className="p-3 bg-cyan-500/10 border border-cyan-500/30 rounded">
                        <p className="font-medium text-white text-sm">{selectedBus.route_name}</p>
                        <p className="text-xs text-slate-300 mt-1">{selectedBus.start_location_name} → {selectedBus.end_location_name}</p>
                        <p className="text-xs text-slate-400 mt-2">Available Seats: <span className="text-green-400">{selectedBus.available_seats}</span></p>
                        <p className="text-xs text-slate-400">Fare: <span className="text-yellow-400">₹{selectedBus.fare}</span></p>
                      </div>

                      {/* Location Selection UI */}
                      {!showLocationSelection ? (
                        <button
                          onClick={handleStartLocationSelection}
                          className="w-full py-2 px-4 rounded-lg bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 transition-colors text-white"
                        >
                          Select Pickup & Dropoff
                        </button>
                      ) : (
                        <div className="space-y-3">
                          <p className="text-xs md:text-sm text-slate-400">Click on the map to select Pickup and Dropoff locations (1st click = Pickup, 2nd click = Dropoff, 3rd click = New Pickup).</p>
                          <div className="flex gap-2">
                            <div className={`flex-1 p-2 rounded ${locationSelectionStep >= 1 ? 'bg-slate-700' : 'bg-slate-900/50'
                              }`}>
                              <p className="text-xs text-slate-300">Pickup: {pickupLocation ? pickupLocation.name : 'Not set'}</p>
                            </div>
                            <div className={`flex-1 p-2 rounded ${locationSelectionStep === 2 ? 'bg-slate-700' : 'bg-slate-900/50'
                              }`}>
                              <p className="text-xs text-slate-300">Dropoff: {dropoffLocation ? dropoffLocation.name : 'Not set'}</p>
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={handleResetLocationSelection}
                              className="flex-1 flex items-center justify-center gap-1 py-2 px-4 rounded-lg bg-slate-700 hover:bg-slate-600 transition-colors text-slate-300"
                            >
                              <RotateCcw className="w-3 h-3 md:w-4 md:h-4" />
                              Reset
                            </button>
                            <button
                              onClick={handleCompleteBooking}
                              disabled={!pickupLocation || !dropoffLocation || bookingLoading}
                              className={`flex-1 py-2 px-4 rounded-lg transition-colors text-sm ${!pickupLocation || !dropoffLocation || bookingLoading
                                ? 'bg-slate-700 cursor-not-allowed'
                                : 'bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500'
                                }`}
                            >
                              {bookingLoading ? 'Booking...' : 'Confirm Booking'}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="text-slate-400 text-sm">Select a bus from the list above to book.</p>
                  )}
                </div>
              )}
            </div>

            {/* Your Bookings Section */}
            <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl border border-slate-700 overflow-hidden">
              <button
                onClick={() => toggleSection('yourBookings')}
                className="w-full p-4 md:p-6 flex items-center justify-between hover:bg-slate-700/30 transition-colors"
              >
                <h3 className="text-base md:text-lg font-semibold flex items-center gap-2">
                  <Ticket className="w-4 h-4 md:w-5 md:h-5" />
                  Your Bookings ({bookings.filter(b => b.status !== 'cancelled').length})
                </h3>
                {expandedSections.yourBookings ? (
                  <ChevronUp className="w-4 h-4 md:w-5 md:h-5" />
                ) : (
                  <ChevronDown className="w-4 h-4 md:w-5 md:h-5" />
                )}
              </button>
              {expandedSections.yourBookings && (
                <div className="p-4 md:p-6 pt-0">
                  <div className="space-y-3 max-h-60 overflow-y-auto">
                    {bookings.filter(b => b.status !== 'cancelled').length === 0 ? (
                      <p className="text-slate-400 text-sm">No active bookings.</p>
                    ) : (
                      bookings.filter(b => b.status !== 'cancelled').map((booking) => (
                        <div key={booking.id} className="p-3 bg-slate-700/50 rounded-lg">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="font-medium text-white text-sm">Trip: {booking.route_name || 'N/A'}</p>
                              <p className="text-xs text-slate-400">Seat: {booking.seat_number}</p>
                              <p className="text-xs text-slate-500">Booking ID: #{booking.id}</p>
                            </div>
                            <span className="px-2 py-1 rounded-full text-xs font-medium bg-green-500/20 text-green-400">
                              Confirmed
                            </span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Map Section */}
          <div className="lg:col-span-2">
            <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl p-6 border border-slate-700 h-[600px]">
              <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                <Navigation className="w-5 h-5" />
                Available Buses
              </h2>
              <div className="h-[calc(100%-40px)] rounded-xl overflow-hidden">
                <MapComponent
                  role="passenger"
                  buses={memoBuses}
                  selectedBus={selectedBus}
                  onBusSelect={handleBusSelect} // Use the new handler
                  onLocationSelect={showLocationSelection ? handleMapClickForLocation : null} // Pass location handler only if in selection mode
                  pickupLocation={pickupLocation}
                  dropoffLocation={dropoffLocation}
                  userLocation={userLocation}
                  locationEnabled={locationEnabled}
                  proximityLevel={proximityLevel}
                  showLocationSelection={showLocationSelection} // Show pickup/dropoff markers
                  showRouteForSelectedBus={!!selectedBus} // Always show route when bus is selected
                  showAllRoutes={true} // Show all bus routes on passenger map
                  routes={memoRoutes}
                  onBookTrip={handleBookTripFromMap}
                />
              </div>
            </div>
            {/* Quick Actions Row */}
            <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-3">
              <button
                onClick={() => setExpandedSections(prev => ({ ...prev, availableBuses: true, bookBus: false, yourBookings: false }))}
                className="p-3 bg-slate-800/50 backdrop-blur-sm rounded-xl border border-slate-700 hover:bg-slate-700/30 transition-colors flex items-center justify-center gap-2"
              >
                <Bus className="w-4 h-4" />
                <span className="text-sm">Buses</span>
              </button>
              <button
                onClick={() => setExpandedSections(prev => ({ ...prev, bookBus: true, availableBuses: false, yourBookings: false }))}
                className="p-3 bg-slate-800/50 backdrop-blur-sm rounded-xl border border-slate-700 hover:bg-slate-700/30 transition-colors flex items-center justify-center gap-2"
              >
                <Ticket className="w-4 h-4" />
                <span className="text-sm">Book</span>
              </button>
              <button
                onClick={() => setExpandedSections(prev => ({ ...prev, yourBookings: true, availableBuses: false, bookBus: false }))}
                className="p-3 bg-slate-800/50 backdrop-blur-sm rounded-xl border border-slate-700 hover:bg-slate-700/30 transition-colors flex items-center justify-center gap-2"
              >
                <Ticket className="w-4 h-4" />
                <span className="text-sm">My Bookings</span>
              </button>
              <button
                onClick={() => setMobileMenuOpen(false)}
                className="p-3 bg-gradient-to-r from-cyan-500 to-blue-600 rounded-xl hover:from-cyan-400 hover:to-blue-500 transition-colors flex items-center justify-center gap-2 lg:hidden"
              >
                <Navigation className="w-4 h-4" />
                <span className="text-sm">View Map</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PassengerDashboard;
