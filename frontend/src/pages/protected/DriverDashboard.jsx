// src/pages/DriverDashboard.jsx

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import MapComponent from '../../components/MapComponent';
import { BusFront, Navigation, Users, MapPin, Settings, User, Route, RotateCcw, Plus } from 'lucide-react';

const DriverDashboard = () => {
  const navigate = useNavigate();
  const { user, isLogged, loading, logout, getAuthHeader } = useAuth();
  const [buses, setBuses] = useState([]); // Represents vehicles assigned to driver
  const [trips, setTrips] = useState([]); // Represents trips created by driver
  const [allRoutes, setAllRoutes] = useState([]); // All routes proposed by driver
  const [approvedRoutes, setApprovedRoutes] = useState([]); // Only approved routes
  const [passengers, setPassengers] = useState([]);
  const [selectedTrip, setSelectedTrip] = useState(null); // Track selected trip
  const [selectedRouteForTrip, setSelectedRouteForTrip] = useState(null); // Track route selected for new trip
  const [isOnline, setIsOnline] = useState(false); // Driver's online status for the *selected trip*
  const [locationEnabled, setLocationEnabled] = useState(true);
  const [userLocation, setUserLocation] = useState(null);
  const [hasGeolocationError, setHasGeolocationError] = useState(false);
  const [proposedRoute, setProposedRoute] = useState({ start: null, end: null });
  const [routeSelectionStep, setRouteSelectionStep] = useState(0); // 0: none, 1: start selected, 2: end selected

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
  const [vehicleAddLoading, setVehicleAddLoading] = useState(false); // Loading state for vehicle addition


  // Fetch data on load
  useEffect(() => {
    if (!isLogged || !user || user.role !== 'driver') {
      navigate('/'); // Redirect if not logged in as driver
      return;
    }

    const fetchData = async () => {
      try {
        const [busesRes, tripsRes, routesRes] = await Promise.all([
          fetch('http://localhost:5000/vehicles', { headers: getAuthHeader() }), // This endpoint now fetches approved vehicles for driver
          fetch('http://localhost:5000/trips', { headers: getAuthHeader() }),
          fetch('http://localhost:5000/routes', { headers: getAuthHeader() })
        ]);

        if (!busesRes.ok || !tripsRes.ok || !routesRes.ok) throw new Error('Failed to fetch data');

        const busesData = await busesRes.json(); // This now contains only approved vehicles for the driver
        const tripsData = await tripsRes.json();
        const routesData = await routesRes.json();

        // Filter data for the current driver (busesData is already filtered by backend)
        const driverBuses = busesData; // Already filtered by backend for approved vehicles
        const driverTrips = tripsData.filter(t => t.driver_id == user.id);
        const driverRoutes = routesData.filter(r => r.proposed_by_driver_id == user.id);

        setBuses(driverBuses);
        setTrips(driverTrips);
        setAllRoutes(driverRoutes);
        setApprovedRoutes(driverRoutes.filter(r => r.approved)); // Filter approved routes

        // Auto-select an 'on_route' trip if available
        const activeTrip = driverTrips.find(t => t.status === 'on_route');
        if (activeTrip && !selectedTrip) {
          setSelectedTrip(activeTrip);
          setIsOnline(true); // Sync online status with active trip
        }

        // Auto-select a vehicle if available and no form vehicle is selected
        if (driverBuses.length > 0 && !newTripForm.vehicle_id) {
          setNewTripForm(prev => ({ ...prev, vehicle_id: driverBuses[0].id.toString() })); // Ensure string for select
        }
      } catch (err) {
        console.error('Error fetching driver data:', err);
        // Handle error (e.g., show message)
      }
    };

    fetchData();
  }, [isLogged, user, navigate, getAuthHeader, selectedTrip, newTripForm.vehicle_id]); // Add dependencies if needed

  // Fetch passengers for the selected trip (if any)
  useEffect(() => {
    if (!selectedTrip) {
      setPassengers([]);
      return;
    }
    // Fetch bookings for this trip
    const fetchTripPassengers = async () => {
      try {
        const response = await fetch(`http://localhost:5000/bookings?trip_id=${selectedTrip.id}`, { // Adjust endpoint if needed
          headers: getAuthHeader(),
        });
        if (!response.ok) throw new Error('Failed to fetch trip passengers');
        const data = await response.json();
        setPassengers(data);
      } catch (err) {
        console.error('Error fetching trip passengers:', err);
        setPassengers([]);
      }
    };
    fetchTripPassengers();
  }, [selectedTrip, getAuthHeader]);

  // Geolocation for driver - MODIFIED to use trip location endpoint
  useEffect(() => {
    if (!locationEnabled || !isOnline || !selectedTrip) return; // Only watch if enabled, online, and trip selected

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
      if (!selectedTrip) return; // Can't update if no trip selected
      const lat = position.coords.latitude;
      const lng = position.coords.longitude;
      setUserLocation({ lat, lng });

      // Update the trip's location using the NEW endpoint
      try {
        const response = await fetch(`http://localhost:5000/trips/${selectedTrip.id}/location`, {
          method: 'POST', // Changed to POST as it's inserting a new location record
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
          // Update local trip state if needed for immediate UI feedback
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
      { enableHighAccuracy: true, maximumAge: 10000, timeout: 5000 }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, [locationEnabled, isOnline, selectedTrip, getAuthHeader, hasGeolocationError]);

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

    // Update trip status based on online toggle
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

      // Update local state
      setTrips(prev => prev.map(t => t.id === selectedTrip.id ? { ...t, status: newStatus } : t));
      if (enabled) {
        setSelectedTrip(prev => prev ? { ...prev, status: newStatus } : prev); // Update selected trip state
      }
      console.log(`Trip status updated to ${newStatus}`);
    } catch (err) {
      console.error('Error updating trip status:', err);
      setIsOnline(!enabled); // Revert toggle on error
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
        distance: 10, // You might calculate this client-side or leave it to the backend
        estimated_time: 30 // You might calculate this client-side or leave it to the backend
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
      // Refresh routes list
      const routesResponse = await fetch('http://localhost:5000/routes', { headers: getAuthHeader() });
      if (routesResponse.ok) {
        const routesData = await routesResponse.json();
        setAllRoutes(routesData.filter(r => r.proposed_by_driver_id == user.id));
        setApprovedRoutes(routesData.filter(r => r.proposed_by_driver_id == user.id && r.approved));
      }
      handleResetRoute(); // Reset after successful submission
    } catch (err) {
      console.error('Error proposing route:', err);
      alert('Failed to propose route: ' + err.message);
    }
  };

  const handleMapClickForRoute = (location) => {
    // Toggle logic: 1st click = start, 2nd click = end, 3rd click = reset start to new location
    let newRoute = { ...proposedRoute };
    let newStep = routeSelectionStep;

    if (newStep === 0) {
      // First click: set start
      newRoute.start = { ...location, name: `Start (${location.lat.toFixed(4)}, ${location.lng.toFixed(4)})` };
      newStep = 1;
    } else if (newStep === 1) {
      // Second click: set end
      newRoute.end = { ...location, name: `End (${location.lat.toFixed(4)}, ${location.lng.toFixed(4)})` };
      newStep = 2;
    } else if (newStep === 2) {
      // Third click: reset start to new location, clear end
      newRoute.start = { ...location, name: `Start (${location.lat.toFixed(4)}, ${location.lng.toFixed(4)})` };
      newRoute.end = null;
      newStep = 1; // Now waiting for the new end point
    }

    setProposedRoute(newRoute);
    setRouteSelectionStep(newStep);
  };

  const handleResetRoute = () => {
    setProposedRoute({ start: null, end: null });
    setRouteSelectionStep(0); // Reset step counter
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
        // driver_id is implicitly set by the backend to req.user.id
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
      // Refresh trips list
      const tripsResponse = await fetch('http://localhost:5000/trips', { headers: getAuthHeader() });
      if (tripsResponse.ok) {
        const tripsData = await tripsResponse.json();
        setTrips(tripsData.filter(t => t.driver_id == user.id));
      }
      // Reset form and selection
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

  if (loading || !isLogged || (user && user.role !== 'driver')) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-950 via-blue-950 to-slate-950">
        <p className="text-slate-300">Loading dashboard...</p>
      </div>
    );
  }

  const handleAddVehicle = async () => {
    if (!newVehicleForm.plate_number || !newVehicleForm.make || !newVehicleForm.model || !newVehicleForm.year || !newVehicleForm.capacity) {
      alert('Please fill in all vehicle details.');
      return;
    }

    setVehicleAddLoading(true);
    try {
      const vehicleData = {
        ...newVehicleForm,
        year: parseInt(newVehicleForm.year, 10), // Ensure year is a number
        capacity: parseInt(newVehicleForm.capacity, 10) // Ensure capacity is a number
      };

      // Use the new endpoint for requesting a vehicle
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
      alert(result.message); // Shows "Vehicle request submitted successfully. Awaiting approval."
      console.log('Vehicle request submitted:', result);

      // Optionally, clear the form after successful request
      setNewVehicleForm({
        plate_number: '',
        make: '',
        model: '',
        year: '',
        capacity: ''
      });

      // Note: Do NOT refresh the vehicle list here as the requested vehicle won't appear until approved.

    } catch (err) {
      console.error('Error requesting vehicle:', err);
      alert('Failed to request vehicle: ' + err.message);
    } finally {
      setVehicleAddLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-blue-950 to-slate-950 text-white p-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-white">Bus Driver Dashboard</h1>
              <p className="text-slate-400">Manage your routes and trips</p>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${isOnline ? 'bg-green-500/20 text-green-400' : 'bg-slate-700 text-slate-400'}`}>
                  {isOnline ? 'On Route' : 'Offline'}
                </span>
                <button
                  onClick={() => handleOnlineToggle(!isOnline)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${isOnline ? 'bg-cyan-500' : 'bg-slate-600'}`}
                  disabled={!selectedTrip} // Disable if no trip selected
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
                <p className="text-slate-400">Approved Routes</p>
                <h3 className="text-2xl font-bold text-white">{approvedRoutes.length}</h3>
              </div>
              <Route className="w-8 h-8 text-purple-500" />
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Panel - Controls */}
          <div className="space-y-6">

            <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl p-6 border border-slate-700">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <BusFront className="w-5 h-5" />
                Request Vehicle Addition
              </h3>
              <p className="text-sm text-slate-400 mb-3">Your request will be reviewed by an admin.</p>
              <div className="space-y-3">
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Plate Number *</label>
                  <input
                    type="text"
                    value={newVehicleForm.plate_number}
                    onChange={(e) => setNewVehicleForm(prev => ({ ...prev, plate_number: e.target.value }))}
                    className="w-full px-3 py-2 bg-slate-900/70 border border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500 text-white"
                    placeholder="e.g., BUTWAL-01-001"
                  />
                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Make *</label>
                  <input
                    type="text"
                    value={newVehicleForm.make}
                    onChange={(e) => setNewVehicleForm(prev => ({ ...prev, make: e.target.value }))}
                    className="w-full px-3 py-2 bg-slate-900/70 border border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500 text-white"
                    placeholder="e.g., Tata"
                  />
                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Model *</label>
                  <input
                    type="text"
                    value={newVehicleForm.model}
                    onChange={(e) => setNewVehicleForm(prev => ({ ...prev, model: e.target.value }))}
                    className="w-full px-3 py-2 bg-slate-900/70 border border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500 text-white"
                    placeholder="e.g., Safari"
                  />
                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Year *</label>
                  <input
                    type="number"
                    value={newVehicleForm.year}
                    onChange={(e) => setNewVehicleForm(prev => ({ ...prev, year: e.target.value }))}
                    className="w-full px-3 py-2 bg-slate-900/70 border border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500 text-white"
                    placeholder="e.g., 2020"
                  />
                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Capacity (Seats) *</label>
                  <input
                    type="number"
                    value={newVehicleForm.capacity}
                    onChange={(e) => setNewVehicleForm(prev => ({ ...prev, capacity: e.target.value }))}
                    className="w-full px-3 py-2 bg-slate-900/70 border border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500 text-white"
                    placeholder="e.g., 32"
                  />
                </div>
                <button
                  onClick={handleAddVehicle}
                  disabled={vehicleAddLoading}
                  className={`w-full py-2 px-4 rounded-lg transition-colors ${vehicleAddLoading
                    ? 'bg-slate-700 cursor-not-allowed'
                    : 'bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500'
                    }`}
                >
                  {vehicleAddLoading ? 'Requesting...' : 'Request Vehicle'}
                </button>
              </div>
            </div>
            {/* Route Proposal Section */}
            <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl p-6 border border-slate-700">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <Route className="w-5 h-5" />
                  Propose New Route
                </h3>
                {routeSelectionStep > 0 && (
                  <button
                    onClick={handleResetRoute}
                    className="flex items-center gap-1 text-sm text-slate-400 hover:text-slate-300 transition-colors"
                  >
                    <RotateCcw className="w-4 h-4" />
                    Reset
                  </button>
                )}
              </div>
              <div className="space-y-3">
                <p className="text-sm text-slate-400">Click on the map to select Start and End points (1st click = Start, 2nd click = End, 3rd click = New Start).</p>
                <div className="flex gap-2">
                  <div className={`flex-1 p-2 rounded ${routeSelectionStep >= 1 ? 'bg-slate-700' : 'bg-slate-900/50'
                    }`}>
                    <p className="text-xs text-slate-300">Start: {proposedRoute.start ? proposedRoute.start.name : 'Not set'}</p>
                  </div>
                  <div className={`flex-1 p-2 rounded ${routeSelectionStep === 2 ? 'bg-slate-700' : 'bg-slate-900/50'
                    }`}>
                    <p className="text-xs text-slate-300">End: {proposedRoute.end ? proposedRoute.end.name : 'Not set'}</p>
                  </div>
                </div>
                <button
                  onClick={handleProposeRoute}
                  disabled={!proposedRoute.start || !proposedRoute.end}
                  className={`w-full py-2 px-4 rounded-lg transition-colors ${!proposedRoute.start || !proposedRoute.end
                    ? 'bg-slate-700 cursor-not-allowed'
                    : 'bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500'
                    }`}
                >
                  Submit Route Proposal
                </button>
              </div>
            </div>

            {/* Create Trip Section */}
            <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl p-6 border border-slate-700">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Plus className="w-5 h-5" />
                Create New Trip
              </h3>
              <div className="space-y-3">
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Select Approved Route</label>
                  <select
                    value={selectedRouteForTrip ? selectedRouteForTrip.id : ''}
                    onChange={(e) => {
                      const route = approvedRoutes.find(r => r.id == e.target.value);
                      setSelectedRouteForTrip(route || null);
                    }}
                    className="w-full px-3 py-2 bg-slate-900/70 border border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500 text-white"
                  >
                    <option value="">Choose a route...</option>
                    {approvedRoutes.map(route => (
                      <option key={route.id} value={route.id}>
                        {route.route_name} ({route.start_location_name} to {route.end_location_name})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Vehicle</label>
                  <select
                    value={newTripForm.vehicle_id}
                    onChange={(e) => setNewTripForm(prev => ({ ...prev, vehicle_id: e.target.value }))}
                    className="w-full px-3 py-2 bg-slate-900/70 border border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500 text-white"
                  >
                    <option value="">Choose a vehicle...</option>
                    {buses.map(bus => (
                      <option key={bus.id} value={bus.id}>
                        {bus.plate_number} ({bus.make} {bus.model})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Departure Time</label>
                  <input
                    type="datetime-local"
                    value={newTripForm.departure_time}
                    onChange={(e) => setNewTripForm(prev => ({ ...prev, departure_time: e.target.value }))}
                    className="w-full px-3 py-2 bg-slate-900/70 border border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500 text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Arrival Time</label>
                  <input
                    type="datetime-local"
                    value={newTripForm.arrival_time}
                    onChange={(e) => setNewTripForm(prev => ({ ...prev, arrival_time: e.target.value }))}
                    className="w-full px-3 py-2 bg-slate-900/70 border border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500 text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Fare</label>
                  <input
                    type="number"
                    value={newTripForm.fare}
                    onChange={(e) => setNewTripForm(prev => ({ ...prev, fare: e.target.value }))}
                    className="w-full px-3 py-2 bg-slate-900/70 border border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500 text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Available Seats</label>
                  <input
                    type="number"
                    value={newTripForm.available_seats}
                    onChange={(e) => setNewTripForm(prev => ({ ...prev, available_seats: e.target.value }))}
                    className="w-full px-3 py-2 bg-slate-900/70 border border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500 text-white"
                  />
                </div>
                <button
                  onClick={handleCreateTrip}
                  disabled={!selectedRouteForTrip || !newTripForm.vehicle_id || !newTripForm.departure_time || !newTripForm.arrival_time}
                  className={`w-full py-2 px-4 rounded-lg transition-colors ${!selectedRouteForTrip || !newTripForm.vehicle_id || !newTripForm.departure_time || !newTripForm.arrival_time
                    ? 'bg-slate-700 cursor-not-allowed'
                    : 'bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500'
                    }`}
                >
                  Create Trip
                </button>
              </div>
            </div>

            {/* Driver Controls */}
            {selectedTrip && (
              <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl p-6 border border-slate-700">
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <BusFront className="w-5 h-5" />
                  Trip: {selectedTrip.route_name}
                </h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm text-slate-400 mb-1">Status</label>
                    <p className="text-white">{selectedTrip.status}</p>
                  </div>
                  <div>
                    <label className="block text-sm text-slate-400 mb-1">Bus</label>
                    <p className="text-white">{selectedTrip.plate_number}</p>
                  </div>
                  <div>
                    <label className="block text-sm text-slate-400 mb-1">Route</label>
                    <p className="text-white">{selectedTrip.route_name}</p>
                  </div>
                  <div>
                    <label className="block text-sm text-slate-400 mb-1">Departure</label>
                    <p className="text-white">{new Date(selectedTrip.departure_time).toLocaleString()}</p>
                  </div>
                  <div>
                    <label className="block text-sm text-slate-400 mb-1">Arrival</label>
                    <p className="text-white">{new Date(selectedTrip.arrival_time).toLocaleString()}</p>
                  </div>
                  <div>
                    <label className="block text-sm text-slate-400 mb-1">Available Seats</label>
                    <p className="text-white">{selectedTrip.available_seats}</p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Map Section */}
          <div className="lg:col-span-2">
            <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl p-6 border border-slate-700 h-[600px]">
              <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                <Navigation className="w-5 h-5" />
                Live Tracking Map
              </h2>
              <div className="h-[calc(100%-40px)] rounded-xl overflow-hidden">
                <MapComponent
                  role="driver"
                  buses={trips.map(t => ({ ...t, currentLocation: t.current_location }))} // Use trips with location
                  passengers={passengers}
                  selectedBus={selectedTrip} // Use selectedTrip
                  onBusSelect={setSelectedTrip} // Update selectedTrip
                  userLocation={userLocation}
                  locationEnabled={locationEnabled}
                  onLocationSelect={handleMapClickForRoute} // Use the new handler
                  showRouteSelection={true} // Indicate driver can select route points
                  proposedRoute={proposedRoute}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DriverDashboard;
