// src/pages/DriverDashboard.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import MapComponent from '../../components/MapComponent';
import { BusFront, Navigation, Users, MapPin, Settings, User, Route, RotateCcw, Plus, ChevronDown, ChevronUp, Menu, X } from 'lucide-react';

const DriverDashboard = () => {
  const navigate = useNavigate();
  const { user, isLogged, loading, logout, getAuthHeader } = useAuth();
  const [buses, setBuses] = useState([]);
  const [trips, setTrips] = useState([]);
  const [allRoutes, setAllRoutes] = useState([]);
  const [approvedRoutes, setApprovedRoutes] = useState([]);
  const [passengers, setPassengers] = useState([]);
  const [selectedTrip, setSelectedTrip] = useState(null);
  const [selectedRouteForTrip, setSelectedRouteForTrip] = useState(null);
  const [isOnline, setIsOnline] = useState(false);
  const [locationEnabled, setLocationEnabled] = useState(true);
  const [userLocation, setUserLocation] = useState(null);
  const [hasGeolocationError, setHasGeolocationError] = useState(false);
  const [proposedRoute, setProposedRoute] = useState({ start: null, end: null });
  const [routeSelectionStep, setRouteSelectionStep] = useState(0);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // State to manage expanded sections
  // Only 'vehicleRequest', 'routeProposal', 'createTrip' are controlled for mutual exclusivity
  // 'tripDetails' and 'passengers' can be open independently
  const [expandedSections, setExpandedSections] = useState({
    vehicleRequest: false, // Changed default to false
    routeProposal: false,   // Changed default to false
    createTrip: false,      // Changed default to false
    tripDetails: false,
    passengers: false
  });

  const [newTripForm, setNewTripForm] = useState({
    vehicle_id: '',
    departure_time: '',
    arrival_time: '',
    fare: '',
    available_seats: ''
  });
  const [newVehicleForm, setNewVehicleForm] = useState({
    plate_number: '',
    make: '',
    model: '',
    year: '',
    capacity: ''
  });
  const [vehicleAddLoading, setVehicleAddLoading] = useState(false);

  // Toggle section visibility
  // This function now ensures only one of the main three sections is open
  const toggleSection = (section) => {
    setExpandedSections(prev => {
      // Define the sections that should be mutually exclusive
      const mainSections = ['vehicleRequest', 'routeProposal', 'createTrip'];

      // If the clicked section is one of the main ones, close the others
      if (mainSections.includes(section)) {
        const newExpanded = { ...prev };
        // Close all main sections
        mainSections.forEach(s => newExpanded[s] = false);
        // Toggle the clicked section
        newExpanded[section] = !prev[section];
        return newExpanded;
      } else {
        // If it's not a main section (e.g., tripDetails, passengers), just toggle it normally
        return {
          ...prev,
          [section]: !prev[section]
        };
      }
    });
  };

  // Existing useEffect hooks remain unchanged
  useEffect(() => {
    if (!isLogged || !user || user.role !== 'driver') {
      navigate('/');
      return;
    }
    const fetchData = async () => {
      try {
        const [busesRes, tripsRes, routesRes] = await Promise.all([
          fetch('http://localhost:5000/vehicles', { headers: getAuthHeader() }),
          fetch('http://localhost:5000/trips', { headers: getAuthHeader() }),
          fetch('http://localhost:5000/routes', { headers: getAuthHeader() })
        ]);
        if (!busesRes.ok || !tripsRes.ok || !routesRes.ok) throw new Error('Failed to fetch data');
        const busesData = await busesRes.json();
        const tripsData = await tripsRes.json();
        const routesData = await routesRes.json();
        const driverBuses = busesData;
        const driverTrips = tripsData.filter(t => t.driver_id == user.id);
        const driverRoutes = routesData.filter(r => r.proposed_by_driver_id == user.id);
        setBuses(driverBuses);
        setTrips(driverTrips);
        setAllRoutes(driverRoutes);
        setApprovedRoutes(driverRoutes.filter(r => r.approved));
        const activeTrip = driverTrips.find(t => t.status === 'on_route');
        if (activeTrip && !selectedTrip) {
          setSelectedTrip(activeTrip);
          setIsOnline(true);
          // Auto-expand trip details when active trip is found
          setExpandedSections(prev => ({ ...prev, tripDetails: true }));
        }
        if (driverBuses.length > 0 && !newTripForm.vehicle_id) {
          setNewTripForm(prev => ({ ...prev, vehicle_id: driverBuses[0].id.toString() }));
        }
      } catch (err) {
        console.error('Error fetching driver data:', err);
      }
    };
    fetchData();
  }, [isLogged, user, navigate, getAuthHeader, selectedTrip, newTripForm.vehicle_id]);

  useEffect(() => {
    if (!locationEnabled) {
      // If location is disabled, clear the user location
      setUserLocation(null);
      return;
    }

    if (!navigator.geolocation) {
      console.warn('Geolocation is not supported by this browser.');
      setHasGeolocationError(true);
      // Optionally set a default location if needed
      // setUserLocation({ lat: 27.6884, lng: 83.4490 });
      return;
    }

    const handleGeoError = (error) => {
      console.error('Geolocation error:', error);
      let message = 'Unable to access your location.';
      if (error.code === 1) message = 'Location permission was denied.';
      else if (error.code === 2) message = 'Position unavailable - trying mock location.';
      else if (error.code === 3) message = 'Position acquisition timed out - trying mock location.';
      console.warn(message);
      // Set a mock location only if not permission denied
      if (error.code !== 1) {
        setUserLocation({ lat: 27.6884, lng: 83.4490 });
      }
    };

    // Get current position first
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        setUserLocation({ lat, lng });
      },
      handleGeoError,
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 0 }
    );
  }, [locationEnabled]); // Only run if locationEnabled changes

  useEffect(() => {
    if (!selectedTrip) {
      setPassengers([]);
      return;
    }
    const fetchTripPassengers = async () => {
      try {
        const response = await fetch(`http://localhost:5000/bookings?trip_id=${selectedTrip.id}`, {
          headers: getAuthHeader(),
        });
        if (!response.ok) throw new Error('Failed to fetch trip passengers');
        const data = await response.json();
        setPassengers(data);
        if (data.length > 0) {
          setExpandedSections(prev => ({ ...prev, passengers: true }));
        }
      } catch (err) {
        console.error('Error fetching trip passengers:', err);
        setPassengers([]);
      }
    };
    fetchTripPassengers();
  }, [selectedTrip, getAuthHeader]);

  useEffect(() => {
    if (!locationEnabled || !isOnline || !selectedTrip) {
      // If not online, on a trip, or location is disabled, stop watching
      return;
    }

    if (!navigator.geolocation) {
      console.warn('Geolocation is not supported by this browser.');
      setHasGeolocationError(true);
      return;
    }

    const handleGeoError = (error) => {
      console.error('Geolocation error during trip:', error);
      // Don't set mock location here, just log
    };

    const updateLocationInDB = async (position) => {
      if (!selectedTrip) return;
      const lat = position.coords.latitude;
      const lng = position.coords.longitude;
      // Update the local userLocation state as well, so the map sees the latest
      setUserLocation({ lat, lng });

      try {
        const response = await fetch(`http://localhost:5000/trips/${selectedTrip.id}/location`, {
          method: 'POST',
          headers: {
            ...getAuthHeader(),
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ lat, lng }),
        });
        if (!response.ok) {
          const errorData = await response.json();
          console.error('Failed to update trip location in DB:', errorData.message);
        } else {
          console.log('Trip location updated successfully in DB');
          setTrips(prev => prev.map(t => t.id === selectedTrip.id ? { ...t, current_location: { lat, lng } } : t));
          if (selectedTrip.id === selectedTrip?.id) {
            setSelectedTrip(prev => prev ? { ...prev, current_location: { lat, lng } } : null);
          }
        }
      } catch (err) {
        console.error('Error updating trip location:', err);
      }
    };

    const watchId = navigator.geolocation.watchPosition(
      updateLocationInDB,
      handleGeoError,
      { enableHighAccuracy: false, maximumAge: 30000, timeout: 15000 }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, [locationEnabled, isOnline, selectedTrip, getAuthHeader]);

  // Existing handler functions remain unchanged
  const handleLocationToggle = (enabled) => {
    setLocationEnabled(enabled);
    if (!enabled) {
      setUserLocation(null);
    }
  };

  const handleOnlineToggle = async (enabled) => {
    if (!selectedTrip) {
      alert('Please select a trip first.');
      return;
    }
    setIsOnline(enabled);
    try {
      const newStatus = enabled ? 'on_route' : 'scheduled';
      const response = await fetch(`http://localhost:5000/trips/${selectedTrip.id}/status`, {
        method: 'PUT',
        headers: {
          ...getAuthHeader(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to update trip status');
      }
      setTrips(prev => prev.map(t => t.id === selectedTrip.id ? { ...t, status: newStatus } : t));
      if (enabled) {
        setSelectedTrip(prev => prev ? { ...prev, status: newStatus } : prev);
      }
      console.log(`Trip status updated to ${newStatus}`);
    } catch (err) {
      console.error('Error updating trip status:', err);
      setIsOnline(!enabled);
      alert('Failed to update trip status: ' + err.message);
    }
  };

  const handleProposeRoute = async () => {
    if (!proposedRoute.start || !proposedRoute.end) {
      alert('Please select both start and end locations on the map.');
      return;
    }
    try {
      const routeData = {
        route_name: `Route from ${proposedRoute.start.name} to ${proposedRoute.end.name}`,
        start_location: proposedRoute.start,
        end_location: proposedRoute.end,
        distance: 10,
        estimated_time: 30
      };
      const response = await fetch('http://localhost:5000/routes', {
        method: 'POST',
        headers: {
          ...getAuthHeader(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(routeData),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to propose route');
      }
      const result = await response.json();
      alert(result.message);
      const routesResponse = await fetch('http://localhost:5000/routes', { headers: getAuthHeader() });
      if (routesResponse.ok) {
        const routesData = await routesResponse.json();
        setAllRoutes(routesData.filter(r => r.proposed_by_driver_id == user.id));
        setApprovedRoutes(routesData.filter(r => r.proposed_by_driver_id == user.id && r.approved));
      }
      handleResetRoute();
    } catch (err) {
      console.error('Error proposing route:', err);
      alert('Failed to propose route: ' + err.message);
    }
  };

  const handleMapClickForRoute = (location) => {
    let newRoute = { ...proposedRoute };
    let newStep = routeSelectionStep;
    if (newStep === 0) {
      newRoute.start = { ...location, name: `Start (${location.lat.toFixed(4)}, ${location.lng.toFixed(4)})` };
      newStep = 1;
    } else if (newStep === 1) {
      newRoute.end = { ...location, name: `End (${location.lat.toFixed(4)}, ${location.lng.toFixed(4)})` };
      newStep = 2;
    } else if (newStep === 2) {
      newRoute.start = { ...location, name: `Start (${location.lat.toFixed(4)}, ${location.lng.toFixed(4)})` };
      newRoute.end = null;
      newStep = 1;
    }
    setProposedRoute(newRoute);
    setRouteSelectionStep(newStep);
  };

  const handleResetRoute = () => {
    setProposedRoute({ start: null, end: null });
    setRouteSelectionStep(0);
  };

  const handleCreateTrip = async () => {
    if (!selectedRouteForTrip || !newTripForm.vehicle_id || !newTripForm.departure_time || !newTripForm.arrival_time || !newTripForm.fare || !newTripForm.available_seats) {
      alert('Please fill in all trip details and select a route.');
      return;
    }
    try {
      const tripData = {
        ...newTripForm,
        route_id: selectedRouteForTrip.id,
      };
      const response = await fetch('http://localhost:5000/trips', {
        method: 'POST',
        headers: {
          ...getAuthHeader(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(tripData),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to create trip');
      }
      const result = await response.json();
      alert('Trip created successfully!');
      const tripsResponse = await fetch('http://localhost:5000/trips', { headers: getAuthHeader() });
      if (tripsResponse.ok) {
        const tripsData = await tripsResponse.json();
        setTrips(tripsData.filter(t => t.driver_id == user.id));
      }
      setNewTripForm({
        vehicle_id: buses.length > 0 ? buses[0].id.toString() : '',
        departure_time: '',
        arrival_time: '',
        fare: '',
        available_seats: ''
      });
      setSelectedRouteForTrip(null);
    } catch (err) {
      console.error('Error creating trip:', err);
      alert('Failed to create trip: ' + err.message);
    }
  };

  const handleAddVehicle = async () => {
    if (!newVehicleForm.plate_number || !newVehicleForm.make || !newVehicleForm.model || !newVehicleForm.year || !newVehicleForm.capacity) {
      alert('Please fill in all vehicle details.');
      return;
    }
    setVehicleAddLoading(true);
    try {
      const vehicleData = {
        ...newVehicleForm,
        year: parseInt(newVehicleForm.year, 10),
        capacity: parseInt(newVehicleForm.capacity, 10)
      };
      const response = await fetch('http://localhost:5000/vehicles', {
        method: 'POST',
        headers: {
          ...getAuthHeader(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(vehicleData),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to request vehicle');
      }
      const result = await response.json();
      alert(result.message);
      console.log('Vehicle request submitted:', result);
      setNewVehicleForm({
        plate_number: '',
        make: '',
        model: '',
        year: '',
        capacity: ''
      });
    } catch (err) {
      console.error('Error requesting vehicle:', err);
      alert('Failed to request vehicle: ' + err.message);
    } finally {
      setVehicleAddLoading(false);
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
              <h1 className="text-2xl md:text-3xl font-bold text-white">Bus Driver Dashboard</h1>
              <p className="text-slate-400 text-sm md:text-base">Manage your routes and trips</p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs md:text-sm font-medium ${isOnline ? 'bg-green-500/20 text-green-400' : 'bg-slate-700 text-slate-400'}`}>
                  {isOnline ? 'On Route' : 'Offline'}
                </span>
                <button
                  onClick={() => handleOnlineToggle(!isOnline)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${isOnline ? 'bg-cyan-500' : 'bg-slate-600'}`}
                  disabled={!selectedTrip}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${isOnline ? 'translate-x-6' : 'translate-x-1'}`}
                  />
                </button>
              </div>
              <div className="flex items-center gap-2">
                <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs md:text-sm font-medium ${locationEnabled ? 'bg-cyan-500/20 text-cyan-400' : 'bg-slate-700 text-slate-400'}`}>
                  <MapPin className="w-3 h-3 md:w-4 md:h-4 mr-1" />
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
                <p className="text-xs md:text-sm text-slate-400">Active Trips</p>
                <h3 className="text-xl md:text-2xl font-bold text-white">
                  {trips.filter(t => t.status === 'on_route').length}
                </h3>
              </div>
              <Navigation className="w-6 h-6 md:w-8 md:h-8 text-cyan-500" />
            </div>
          </div>
          <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl p-4 md:p-6 border border-slate-700">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs md:text-sm text-slate-400">Total Passengers</p>
                <h3 className="text-xl md:text-2xl font-bold text-white">{passengers.length}</h3>
              </div>
              <Users className="w-6 h-6 md:w-8 md:h-8 text-blue-500" />
            </div>
          </div>
          <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl p-4 md:p-6 border border-slate-700">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs md:text-sm text-slate-400">Assigned Buses</p>
                <h3 className="text-xl md:text-2xl font-bold text-white">{buses.length}</h3>
              </div>
              <BusFront className="w-6 h-6 md:w-8 md:h-8 text-green-500" />
            </div>
          </div>
          <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl p-4 md:p-6 border border-slate-700">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs md:text-sm text-slate-400">Approved Routes</p>
                <h3 className="text-xl md:text-2xl font-bold text-white">{approvedRoutes.length}</h3>
              </div>
              <Route className="w-6 h-6 md:w-8 md:h-8 text-purple-500" />
            </div>
          </div>
        </div>
        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
          {/* Left Panel - Collapsible Sections */}
          <div className={`lg:col-span-1 ${mobileMenuOpen ? 'block' : 'hidden lg:block'} space-y-4 md:space-y-6`}>
            {/* Vehicle Request Section */}
            <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl border border-slate-700 overflow-hidden">
              <button
                onClick={() => toggleSection('vehicleRequest')}
                className="w-full p-4 md:p-6 flex items-center justify-between hover:bg-slate-700/30 transition-colors"
              >
                <h3 className="text-base md:text-lg font-semibold flex items-center gap-2">
                  <BusFront className="w-4 h-4 md:w-5 md:h-5" />
                  Request Vehicle
                </h3>
                {expandedSections.vehicleRequest ? (
                  <ChevronUp className="w-4 h-4 md:w-5 md:h-5" />
                ) : (
                  <ChevronDown className="w-4 h-4 md:w-5 md:h-5" />
                )}
              </button>
              {expandedSections.vehicleRequest && (
                <div className="p-4 md:p-6 pt-0 space-y-3">
                  <p className="text-xs md:text-sm text-slate-400 mb-3">Your request will be reviewed by an admin.</p>
                  <div className="space-y-2 md:space-y-3">
                    <div>
                      <label className="block text-xs md:text-sm text-slate-400 mb-1">Plate Number *</label>
                      <input
                        type="text"
                        value={newVehicleForm.plate_number}
                        onChange={(e) => setNewVehicleForm(prev => ({ ...prev, plate_number: e.target.value }))}
                        className="w-full px-3 py-2 text-sm md:text-base bg-slate-900/70 border border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500 text-white"
                        placeholder="e.g., BUTWAL-01-001"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2 md:gap-3">
                      <div>
                        <label className="block text-xs md:text-sm text-slate-400 mb-1">Make *</label>
                        <input
                          type="text"
                          value={newVehicleForm.make}
                          onChange={(e) => setNewVehicleForm(prev => ({ ...prev, make: e.target.value }))}
                          className="w-full px-3 py-2 text-sm md:text-base bg-slate-900/70 border border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500 text-white"
                          placeholder="e.g., Tata"
                        />
                      </div>
                      <div>
                        <label className="block text-xs md:text-sm text-slate-400 mb-1">Model *</label>
                        <input
                          type="text"
                          value={newVehicleForm.model}
                          onChange={(e) => setNewVehicleForm(prev => ({ ...prev, model: e.target.value }))}
                          className="w-full px-3 py-2 text-sm md:text-base bg-slate-900/70 border border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500 text-white"
                          placeholder="e.g., Safari"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2 md:gap-3">
                      <div>
                        <label className="block text-xs md:text-sm text-slate-400 mb-1">Year *</label>
                        <input
                          type="number"
                          value={newVehicleForm.year}
                          onChange={(e) => setNewVehicleForm(prev => ({ ...prev, year: e.target.value }))}
                          className="w-full px-3 py-2 text-sm md:text-base bg-slate-900/70 border border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500 text-white"
                          placeholder="e.g., 2020"
                        />
                      </div>
                      <div>
                        <label className="block text-xs md:text-sm text-slate-400 mb-1">Capacity *</label>
                        <input
                          type="number"
                          value={newVehicleForm.capacity}
                          onChange={(e) => setNewVehicleForm(prev => ({ ...prev, capacity: e.target.value }))}
                          className="w-full px-3 py-2 text-sm md:text-base bg-slate-900/70 border border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500 text-white"
                          placeholder="e.g., 32"
                        />
                      </div>
                    </div>
                    <button
                      onClick={handleAddVehicle}
                      disabled={vehicleAddLoading}
                      className={`w-full py-2 px-4 rounded-lg transition-colors text-sm md:text-base ${vehicleAddLoading
                        ? 'bg-slate-700 cursor-not-allowed'
                        : 'bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500'
                        }`}
                    >
                      {vehicleAddLoading ? 'Requesting...' : 'Request Vehicle'}
                    </button>
                  </div>
                </div>
              )}
            </div>
            {/* Route Proposal Section */}
            <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl border border-slate-700 overflow-hidden">
              <button
                onClick={() => toggleSection('routeProposal')}
                className="w-full p-4 md:p-6 flex items-center justify-between hover:bg-slate-700/30 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <Route className="w-4 h-4 md:w-5 md:h-5" />
                  <h3 className="text-base md:text-lg font-semibold">Propose Route</h3>
                </div>
                {expandedSections.routeProposal ? (
                  <ChevronUp className="w-4 h-4 md:w-5 md:h-5" />
                ) : (
                  <ChevronDown className="w-4 h-4 md:w-5 md:h-5" />
                )}
              </button>
              {expandedSections.routeProposal && (
                <div className="p-4 md:p-6 pt-0 space-y-3">
                  <div className="flex justify-between items-center">
                    <p className="text-xs md:text-sm text-slate-400">Click on map to select points</p>
                    {routeSelectionStep > 0 && (
                      <button
                        onClick={handleResetRoute}
                        className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-300 transition-colors"
                      >
                        <RotateCcw className="w-3 h-3" />
                        Reset
                      </button>
                    )}
                  </div>
                  <div className="space-y-2">
                    <div className={`p-2 rounded ${routeSelectionStep >= 1 ? 'bg-slate-700' : 'bg-slate-900/50'}`}>
                      <p className="text-xs text-slate-300">Start: {proposedRoute.start ? proposedRoute.start.name : 'Not set'}</p>
                    </div>
                    <div className={`p-2 rounded ${routeSelectionStep === 2 ? 'bg-slate-700' : 'bg-slate-900/50'}`}>
                      <p className="text-xs text-slate-300">End: {proposedRoute.end ? proposedRoute.end.name : 'Not set'}</p>
                    </div>
                  </div>
                  <button
                    onClick={handleProposeRoute}
                    disabled={!proposedRoute.start || !proposedRoute.end}
                    className={`w-full py-2 px-4 rounded-lg transition-colors text-sm md:text-base ${!proposedRoute.start || !proposedRoute.end
                      ? 'bg-slate-700 cursor-not-allowed'
                      : 'bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500'
                      }`}
                  >
                    Submit Route Proposal
                  </button>
                </div>
              )}
            </div>
            {/* Create Trip Section */}
            <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl border border-slate-700 overflow-hidden">
              <button
                onClick={() => toggleSection('createTrip')}
                className="w-full p-4 md:p-6 flex items-center justify-between hover:bg-slate-700/30 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <Plus className="w-4 h-4 md:w-5 md:h-5" />
                  <h3 className="text-base md:text-lg font-semibold">Create Trip</h3>
                </div>
                {expandedSections.createTrip ? (
                  <ChevronUp className="w-4 h-4 md:w-5 md:h-5" />
                ) : (
                  <ChevronDown className="w-4 h-4 md:w-5 md:h-5" />
                )}
              </button>
              {expandedSections.createTrip && (
                <div className="p-4 md:p-6 pt-0 space-y-2 md:space-y-3">
                  <div>
                    <label className="block text-xs md:text-sm text-slate-400 mb-1">Select Route</label>
                    <select
                      value={selectedRouteForTrip ? selectedRouteForTrip.id : ''}
                      onChange={(e) => {
                        const route = approvedRoutes.find(r => r.id == e.target.value);
                        setSelectedRouteForTrip(route || null);
                      }}
                      className="w-full px-3 py-2 text-sm md:text-base bg-slate-900/70 border border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500 text-white"
                    >
                      <option value="">Choose a route...</option>
                      {approvedRoutes.map(route => (
                        <option key={route.id} value={route.id}>
                          {route.route_name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs md:text-sm text-slate-400 mb-1">Vehicle</label>
                    <select
                      value={newTripForm.vehicle_id}
                      onChange={(e) => setNewTripForm(prev => ({ ...prev, vehicle_id: e.target.value }))}
                      className="w-full px-3 py-2 text-sm md:text-base bg-slate-900/70 border border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500 text-white"
                    >
                      <option value="">Choose a vehicle...</option>
                      {buses.map(bus => (
                        <option key={bus.id} value={bus.id}>
                          {bus.plate_number}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-2 md:gap-3">
                    <div>
                      <label className="block text-xs md:text-sm text-slate-400 mb-1">Departure</label>
                      <input
                        type="datetime-local"
                        value={newTripForm.departure_time}
                        onChange={(e) => setNewTripForm(prev => ({ ...prev, departure_time: e.target.value }))}
                        className="w-full px-3 py-2 text-sm md:text-base bg-slate-900/70 border border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500 text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-xs md:text-sm text-slate-400 mb-1">Arrival</label>
                      <input
                        type="datetime-local"
                        value={newTripForm.arrival_time}
                        onChange={(e) => setNewTripForm(prev => ({ ...prev, arrival_time: e.target.value }))}
                        className="w-full px-3 py-2 text-sm md:text-base bg-slate-900/70 border border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500 text-white"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 md:gap-3">
                    <div>
                      <label className="block text-xs md:text-sm text-slate-400 mb-1">Fare</label>
                      <input
                        type="number"
                        value={newTripForm.fare}
                        onChange={(e) => setNewTripForm(prev => ({ ...prev, fare: e.target.value }))}
                        className="w-full px-3 py-2 text-sm md:text-base bg-slate-900/70 border border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500 text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-xs md:text-sm text-slate-400 mb-1">Seats</label>
                      <input
                        type="number"
                        value={newTripForm.available_seats}
                        onChange={(e) => setNewTripForm(prev => ({ ...prev, available_seats: e.target.value }))}
                        className="w-full px-3 py-2 text-sm md:text-base bg-slate-900/70 border border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500 text-white"
                      />
                    </div>
                  </div>
                  <button
                    onClick={handleCreateTrip}
                    disabled={!selectedRouteForTrip || !newTripForm.vehicle_id || !newTripForm.departure_time || !newTripForm.arrival_time}
                    className={`w-full py-2 px-4 rounded-lg transition-colors text-sm md:text-base ${!selectedRouteForTrip || !newTripForm.vehicle_id || !newTripForm.departure_time || !newTripForm.arrival_time
                      ? 'bg-slate-700 cursor-not-allowed'
                      : 'bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500'
                      }`}
                  >
                    Create Trip
                  </button>
                </div>
              )}
            </div>
            {/* Trip Details Section - Can remain open independently */}
            {selectedTrip && (
              <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl border border-slate-700 overflow-hidden">
                <button
                  onClick={() => toggleSection('tripDetails')}
                  className="w-full p-4 md:p-6 flex items-center justify-between hover:bg-slate-700/30 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <BusFront className="w-4 h-4 md:w-5 md:h-5" />
                    <h3 className="text-base md:text-lg font-semibold">Trip Details</h3>
                  </div>
                  {expandedSections.tripDetails ? (
                    <ChevronUp className="w-4 h-4 md:w-5 md:h-5" />
                  ) : (
                    <ChevronDown className="w-4 h-4 md:w-5 md:h-5" />
                  )}
                </button>
                {expandedSections.tripDetails && (
                  <div className="p-4 md:p-6 pt-0 space-y-2 md:space-y-3">
                    <div className="grid grid-cols-2 gap-2 md:gap-3">
                      <div>
                        <label className="block text-xs md:text-sm text-slate-400 mb-1">Status</label>
                        <p className="text-white text-sm md:text-base">{selectedTrip.status}</p>
                      </div>
                      <div>
                        <label className="block text-xs md:text-sm text-slate-400 mb-1">Bus</label>
                        <p className="text-white text-sm md:text-base">{selectedTrip.plate_number}</p>
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs md:text-sm text-slate-400 mb-1">Route</label>
                      <p className="text-white text-sm md:text-base">{selectedTrip.route_name}</p>
                    </div>
                    <div className="grid grid-cols-2 gap-2 md:gap-3">
                      <div>
                        <label className="block text-xs md:text-sm text-slate-400 mb-1">Departure</label>
                        <p className="text-white text-sm md:text-base">
                          {new Date(selectedTrip.departure_time).toLocaleString()}
                        </p>
                      </div>
                      <div>
                        <label className="block text-xs md:text-sm text-slate-400 mb-1">Arrival</label>
                        <p className="text-white text-sm md:text-base">
                          {new Date(selectedTrip.arrival_time).toLocaleString()}
                        </p>
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs md:text-sm text-slate-400 mb-1">Available Seats</label>
                      <p className="text-white text-sm md:text-base">{selectedTrip.available_seats}</p>
                    </div>
                  </div>
                )}
              </div>
            )}
            {/* Passengers Section - Can remain open independently */}
            {selectedTrip && (
              <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl border border-slate-700 overflow-hidden">
                <button
                  onClick={() => toggleSection('passengers')}
                  className="w-full p-4 md:p-6 flex items-center justify-between hover:bg-slate-700/30 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4 md:w-5 md:h-5" />
                    <h3 className="text-base md:text-lg font-semibold">Passengers ({passengers.length})</h3>
                  </div>
                  {expandedSections.passengers ? (
                    <ChevronUp className="w-4 h-4 md:w-5 md:h-5" />
                  ) : (
                    <ChevronDown className="w-4 h-4 md:w-5 md:h-5" />
                  )}
                </button>
                {expandedSections.passengers && (
                  <div className="p-4 md:p-6 pt-0">
                    {passengers.length === 0 ? (
                      <p className="text-slate-400 text-sm md:text-base">No passengers booked yet.</p>
                    ) : (
                      <div className="space-y-2 max-h-60 overflow-y-auto">
                        {passengers.map((passenger) => (
                          <div key={passenger.id} className="p-3 bg-slate-700/50 rounded-lg border border-slate-600">
                            <div className="flex items-center justify-between mb-1">
                              <p className="font-medium text-white text-sm">{passenger.passenger_name || `Passenger #${passenger.passenger_id}`}</p>
                              <span className="px-2 py-1 rounded-full text-xs font-medium bg-green-500/20 text-green-400">
                                Seat {passenger.seat_number}
                              </span>
                            </div>
                            <div className="text-xs text-slate-300 space-y-1">
                              <p className="truncate">
                                <span className="text-cyan-400">Pickup:</span> {passenger.pickup_location?.name || `(${passenger.pickup_location?.lat?.toFixed(2)}, ${passenger.pickup_location?.lng?.toFixed(2)})`}
                              </p>
                              <p className="truncate">
                                <span className="text-blue-400">Dropoff:</span> {passenger.dropoff_location?.name || `(${passenger.dropoff_location?.lat?.toFixed(2)}, ${passenger.dropoff_location?.lng?.toFixed(2)})`}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
          {/* Map Section - Takes 2/3 on large screens */}
          <div className="lg:col-span-2">
            <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl p-6 border border-slate-700 h-[600px]">
              <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                <Navigation className="w-5 h-5" />
                Live Tracking Map
              </h2>
              <div className="h-[calc(100%-40px)] rounded-xl overflow-hidden">
                <MapComponent
                  role="driver"
                  buses={trips.map(t => ({ ...t, currentLocation: t.current_location }))}
                  passengers={passengers}
                  selectedBus={selectedTrip}
                  onBusSelect={setSelectedTrip}
                  userLocation={userLocation} // Pass the updated userLocation
                  locationEnabled={locationEnabled}
                  onLocationSelect={handleMapClickForRoute}
                  showRouteSelection={true}
                  proposedRoute={proposedRoute}
                />
              </div>
            </div>
            {/* Quick Actions Row */}
            <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-3">
              <button
                onClick={() => setExpandedSections(prev => ({ ...prev, vehicleRequest: true, routeProposal: false, createTrip: false }))}
                className="p-3 bg-slate-800/50 backdrop-blur-sm rounded-xl border border-slate-700 hover:bg-slate-700/30 transition-colors flex items-center justify-center gap-2"
              >
                <Plus className="w-4 h-4" />
                <span className="text-sm">New Trip</span>
              </button>
              <button
                onClick={() => setExpandedSections(prev => ({ ...prev, routeProposal: true, createTrip: false, vehicleRequest: false }))}
                className="p-3 bg-slate-800/50 backdrop-blur-sm rounded-xl border border-slate-700 hover:bg-slate-700/30 transition-colors flex items-center justify-center gap-2"
              >
                <Route className="w-4 h-4" />
                <span className="text-sm">Propose Route</span>
              </button>
              <button
                onClick={() => setExpandedSections(prev => ({ ...prev, vehicleRequest: true, createTrip: false, routeProposal: false }))}
                className="p-3 bg-slate-800/50 backdrop-blur-sm rounded-xl border border-slate-700 hover:bg-slate-700/30 transition-colors flex items-center justify-center gap-2"
              >
                <BusFront className="w-4 h-4" />
                <span className="text-sm">Add Vehicle</span>
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

export default DriverDashboard;
