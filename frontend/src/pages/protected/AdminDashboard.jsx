// src/pages/AdminDashboard.jsx
import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { CheckCircle, XCircle, Clock, User, MapPin, Navigation, BusFront } from 'lucide-react';

const AdminDashboard = () => {
  const navigate = useNavigate();
  const { user, isLogged, loading, logout, getAuthHeader } = useAuth();
  const [allRoutes, setAllRoutes] = useState([]);
  const [loadingApprove, setLoadingApprove] = useState(null); // ID of route being approved/rejected

  const [pendingVehicles, setPendingVehicles] = useState([]);
  const [loadingApproveVehicle, setLoadingApproveVehicle] = useState(null); // ID of vehicle being approved

  // Fetch pending vehicles
  useEffect(() => {
    if (!isLogged || !user || user.role !== 'admin') {
      navigate('/'); // Redirect if not logged in as admin
      return;
    }

    const fetchPendingVehicles = async () => {
      try {
        // Fetch vehicles where approved = 0
        const response = await fetch('http://localhost:5000/vehicles?pending=true', { // Use the query param added to the backend endpoint
          headers: getAuthHeader(),
        });
        if (!response.ok) throw new Error('Failed to fetch pending vehicles');
        const data = await response.json();
        setPendingVehicles(data);
      } catch (err) {
        console.error('Error fetching pending vehicles:', err);
        setPendingVehicles([]); // Reset on error
      }
    };

    fetchPendingVehicles();
  }, [isLogged, user, navigate, getAuthHeader]);

  // Fetch all routes
  useEffect(() => {
    if (!isLogged || !user || user.role !== 'admin') {
      navigate('/'); // Redirect if not logged in as admin
      return;
    }
    const fetchAllRoutes = async () => {
      try {
        // Fetch all routes, backend will handle permissions
        const response = await fetch('http://localhost:5000/routes', {
          headers: getAuthHeader(),
        });
        if (!response.ok) throw new Error('Failed to fetch routes');
        const data = await response.json();
        setAllRoutes(data);
      } catch (err) {
        console.error('Error fetching all routes:', err);
        setAllRoutes([]); // Reset on error
      }
    };

    fetchAllRoutes();
  }, [isLogged, user, navigate, getAuthHeader]);

  // Calculate pending and approved routes using useMemo for efficiency
  const { pendingRoutes, approvedRoutes } = useMemo(() => {
    const pending = allRoutes.filter(r => r.approved === 0);
    const approved = allRoutes.filter(r => r.approved === 1);
    return { pendingRoutes: pending, approvedRoutes: approved };
  }, [allRoutes]);

  const handleApproveVehicle = async (vehicleId) => {
    setLoadingApproveVehicle(vehicleId);
    try {
      const response = await fetch(`http://localhost:5000/vehicles/${vehicleId}/approve`, {
        method: 'PUT',
        headers: getAuthHeader(),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to approve vehicle');
      }

      const result = await response.json();
      console.log('Vehicle approved:', result);
      alert('Vehicle approved successfully!');

      // Update local state
      setPendingVehicles(prev => prev.filter(v => v.id !== vehicleId));

    } catch (error) {
      console.error('Error approving vehicle:', error);
      alert('Failed to approve vehicle: ' + error.message);
    } finally {
      setLoadingApproveVehicle(null);
    }
  };

  const handleApproveRoute = async (routeId) => {
    setLoadingApprove(routeId);
    try {
      const response = await fetch(`http://localhost:5000/routes/${routeId}/approve`, {
        method: 'PUT',
        headers: getAuthHeader(),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to approve route');
      }

      const result = await response.json();
      console.log('Route approved:', result);

      // Update local state optimistically or refetch
      // Optimistically update: remove the approved route from the pending list
      setAllRoutes(prev => prev.map(r => r.id === routeId ? { ...r, approved: 1, approved_at: new Date().toISOString(), approved_by_admin_id: user.id } : r));

      // Or, refetch the list (less efficient but ensures consistency)
      // fetchAllRoutes(); // Assuming fetchAllRoutes is defined in scope or passed down

      alert('Route approved successfully!');

    } catch (error) {
      console.error('Error approving route:', error);
      alert('Failed to approve route: ' + error.message);
    } finally {
      setLoadingApprove(null);
    }
  };

  const handleRejectRoute = async (routeId) => {
    // Implement rejection logic here if needed
    // For now, just remove from pending list (or maybe mark as rejected in DB)
    // This is a simplified version, you might want a DELETE endpoint or a PATCH endpoint to update status
    if (window.confirm("Are you sure you want to reject this route?")) {
      try {
        // For this example, we'll just optimistically update the local state to mark it as rejected (-1 or similar)
        // You'd need a backend endpoint for proper rejection handling
        // Example: await fetch(`http://localhost:5000/routes/${routeId}/reject`, { method: 'PUT', headers: getAuthHeader() });
        setAllRoutes(prev => prev.filter(r => r.id !== routeId)); // Remove from all lists
        alert('Route rejected and removed.');
      } catch (error) {
        console.error('Error rejecting route:', error);
        alert('Failed to reject route: ' + error.message);
      }
    }
  };

  if (loading || !isLogged || (user && user.role !== 'admin')) {
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
              <h1 className="text-3xl font-bold text-white">Admin Dashboard</h1>
              <p className="text-slate-400">Manage routes, drivers, and passengers</p>
            </div>
            <div className="flex items-center gap-4">
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
                <p className="text-slate-400">Total Users</p>
                <h3 className="text-2xl font-bold text-white">100</h3> {/* Fetch from backend */}
              </div>
              <User className="w-8 h-8 text-cyan-500" />
            </div>
          </div>
          <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl p-6 border border-slate-700">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-400">Active Trips</p>
                <h3 className="text-2xl font-bold text-white">25</h3> {/* Fetch from backend */}
              </div>
              <Navigation className="w-8 h-8 text-blue-500" />
            </div>
          </div>
          <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl p-6 border border-slate-700">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-400">Pending Routes</p>
                <h3 className="text-2xl font-bold text-white">{pendingRoutes.length}</h3>
              </div>
              <Clock className="w-8 h-8 text-yellow-500" />
            </div>
          </div>
          <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl p-6 border border-slate-700">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-400">Active Drivers</p>
                <h3 className="text-2xl font-bold text-white">15</h3> {/* Fetch from backend */}
              </div>
              <User className="w-8 h-8 text-green-500" />
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-1 gap-6">

          <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl p-6 border border-slate-700">
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
              <BusFront className="w-5 h-5" />
              Pending Vehicle Requests ({pendingVehicles.length})
            </h2>
            {pendingVehicles.length === 0 ? (
              <p className="text-slate-400 text-center py-4">No pending vehicle requests.</p>
            ) : (
              <div className="space-y-4 max-h-[300px] overflow-y-auto">
                {pendingVehicles.map((vehicle) => (
                  <div key={vehicle.id} className="p-4 bg-slate-700/50 rounded-lg">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h3 className="font-semibold text-white">{vehicle.plate_number}</h3>
                        <div className="flex items-center gap-4 mt-2 text-sm text-slate-300">
                          <span>{vehicle.make} {vehicle.model}</span>
                          <span>Year: {vehicle.year}</span>
                          <span>Capacity: {vehicle.capacity}</span>
                        </div>
                        <div className="mt-1 text-xs text-slate-500">
                          Requested by: Driver ID {vehicle.proposed_by_driver_id} ({vehicle.proposed_by_driver_name || 'N/A'})
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleApproveVehicle(vehicle.id)}
                          disabled={loadingApproveVehicle === vehicle.id}
                          className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm transition-colors ${loadingApproveVehicle === vehicle.id
                            ? 'bg-green-700 cursor-not-allowed'
                            : 'bg-green-600 hover:bg-green-500'
                            }`}
                        >
                          {loadingApproveVehicle === vehicle.id ? 'Approving...' : 'Approve'}
                          <CheckCircle className="w-4 h-4" />
                        </button>
                        {/* Optionally add a Reject button here too */}
                        {/* <button
                          onClick={() => handleRejectVehicle(vehicle.id)} // Implement handleRejectVehicle
                          className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 text-sm transition-colors"
                        >
                          Reject
                          <XCircle className="w-4 h-4" />
                        </button> */}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          {/* Pending Routes Section */}
          <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl p-6 border border-slate-700">
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
              <Clock className="w-5 h-5" />
              Pending Route Proposals ({pendingRoutes.length})
            </h2>
            {pendingRoutes.length === 0 ? (
              <p className="text-slate-400 text-center py-4">No pending route proposals.</p>
            ) : (
              <div className="space-y-4 max-h-[300px] overflow-y-auto">
                {pendingRoutes.map((route) => (
                  <div key={route.id} className="p-4 bg-slate-700/50 rounded-lg">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h3 className="font-semibold text-white">{route.route_name}</h3>
                        <div className="flex items-center gap-4 mt-2 text-sm text-slate-300">
                          <div className="flex items-center gap-1">
                            <MapPin className="w-4 h-4" />
                            <span>{route.start_location_name}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <MapPin className="w-4 h-4" />
                            <span>{route.end_location_name}</span>
                          </div>
                        </div>
                        <div className="mt-2 text-xs text-slate-400">
                          Distance: {route.distance} km, Time: {route.estimated_time} mins
                        </div>
                        <div className="mt-1 text-xs text-slate-500">
                          Proposed by: Driver ID {route.proposed_by_driver_id} {/* Assuming backend adds this */}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleApproveRoute(route.id)}
                          disabled={loadingApprove === route.id}
                          className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm transition-colors ${loadingApprove === route.id
                            ? 'bg-green-700 cursor-not-allowed'
                            : 'bg-green-600 hover:bg-green-500'
                            }`}
                        >
                          {loadingApprove === route.id ? 'Approving...' : 'Approve'}
                          <CheckCircle className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleRejectRoute(route.id)}
                          className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 text-sm transition-colors"
                        >
                          Reject
                          <XCircle className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Approved Routes Section */}
          <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl p-6 border border-slate-700">
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
              <CheckCircle className="w-5 h-5" />
              Approved Routes ({approvedRoutes.length})
            </h2>
            {approvedRoutes.length === 0 ? (
              <p className="text-slate-400 text-center py-4">No approved routes.</p>
            ) : (
              <div className="space-y-4 max-h-[300px] overflow-y-auto">
                {approvedRoutes.map((route) => (
                  <div key={route.id} className="p-4 bg-slate-700/50 rounded-lg">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h3 className="font-semibold text-white">{route.route_name}</h3>
                        <div className="flex items-center gap-4 mt-2 text-sm text-slate-300">
                          <div className="flex items-center gap-1">
                            <MapPin className="w-4 h-4" />
                            <span>{route.start_location_name}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <MapPin className="w-4 h-4" />
                            <span>{route.end_location_name}</span>
                          </div>
                        </div>
                        <div className="mt-2 text-xs text-slate-400">
                          Distance: {route.distance} km, Time: {route.estimated_time} mins
                        </div>
                        <div className="mt-1 text-xs text-slate-500">
                          Approved by: Admin ID {route.approved_by_admin_id} on {new Date(route.approved_at).toLocaleString()}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-1 rounded-full text-xs font-medium bg-green-500/20 text-green-400">
                          Approved
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
