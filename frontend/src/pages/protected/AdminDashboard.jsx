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
  const [loadingApproveVehicle, setLoadingApproveVehicle] = useState(null); // ID of vehicle being approved/rejected
  const [stats, setStats] = useState({
    totalUsers: 0,
    activeTrips: 0,
    activeDrivers: 0,
    pendingRoutes: 0,
    pendingVehicles: 0,
    approvedRoutes: 0
  });
  const [statsLoading, setStatsLoading] = useState(true);

  // Fetch stats data
  useEffect(() => {
    if (!isLogged || !user || user.role !== 'admin') {
      navigate('/'); // Redirect if not logged in as admin
      return;
    }

    const fetchStats = async () => {
      setStatsLoading(true);
      try {
        // Attempt to fetch all users to get counts
        // This endpoint needs to be added to the backend server.js
        let totalUsers = 0;
        let activeDrivers = 0;
        try {
          const usersResponse = await fetch('http://localhost:5000/users', { headers: getAuthHeader() }); // Add this endpoint on the backend
          if (usersResponse.ok) {
            const usersData = await usersResponse.json();
            totalUsers = usersData.length;
            activeDrivers = usersData.filter(u => u.role === 'driver').length;
          } else {
            console.warn("Failed to fetch user list for stats, defaulting to 0:", usersResponse.status, usersResponse.statusText);
            // If the /users endpoint doesn't exist or isn't accessible, default counts to 0
            // Or handle this differently if you have another way to get counts
            // For now, we'll just log and continue, counts remain 0
          }
        } catch (userErr) {
          console.warn("Error fetching user list for stats, defaulting to 0:", userErr.message);
          // If fetching users fails, counts remain 0
        }


        // Fetch all trips to count active ones
        const tripsResponse = await fetch('http://localhost:5000/trips', { headers: getAuthHeader() });
        if (!tripsResponse.ok) throw new Error('Failed to fetch trips');
        const tripsData = await tripsResponse.json();
        const activeTrips = tripsData.filter(t => t.status === 'on_route' || t.status === 'scheduled').length;

        // Fetch all routes to get counts
        const routesResponse = await fetch('http://localhost:5000/routes', { headers: getAuthHeader() });
        if (!routesResponse.ok) throw new Error('Failed to fetch routes');
        const routesData = await routesResponse.json();
        const pendingRoutes = routesData.filter(r => r.approved === 0).length;
        const approvedRoutes = routesData.filter(r => r.approved === 1).length;

        // Fetch pending vehicles (already done separately, but can be counted here too if needed)
        const vehiclesResponse = await fetch('http://localhost:5000/vehicles?pending=true', { headers: getAuthHeader() });
        if (!vehiclesResponse.ok) throw new Error('Failed to fetch pending vehicles');
        const vehiclesData = await vehiclesResponse.json();
        const pendingVehicles = vehiclesData.length;

        setStats({
          totalUsers,
          activeTrips,
          activeDrivers,
          pendingRoutes,
          pendingVehicles,
          approvedRoutes
        });
      } catch (err) {
        console.error('Error fetching stats:', err);
        // Optionally set error state here
        // For now, just log and let the UI show 0s if fetching trips/routes/vehicles fails
      } finally {
        setStatsLoading(false);
      }
    };

    fetchStats();
  }, [isLogged, user, navigate, getAuthHeader]);

  // Fetch pending vehicles (already done for stats, but state is needed for actions)
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

  // Fetch all routes (already done for stats, but state is needed for actions)
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

  // Calculate pending and approved routes using useMemo for efficiency (redundant now, using stats state)
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
      // Update stats
      setStats(prev => ({ ...prev, pendingVehicles: prev.pendingVehicles - 1 }));

    } catch (error) {
      console.error('Error approving vehicle:', error);
      alert('Failed to approve vehicle: ' + error.message);
    } finally {
      setLoadingApproveVehicle(null);
    }
  };

  const handleRejectVehicle = async (vehicleId) => {
    if (!window.confirm("Are you sure you want to reject this vehicle request?")) {
      return;
    }
    setLoadingApproveVehicle(vehicleId); // Use same loading state for consistency
    try {
      // Assuming the backend has a DELETE endpoint for rejected vehicles
      // If not, you might need a PUT/PATCH endpoint to mark status as 'rejected'
      // For now, let's assume a DELETE endpoint exists or a PATCH to update status
      // Example with DELETE: await fetch(`http://localhost:5000/vehicles/${vehicleId}`, { method: 'DELETE', headers: getAuthHeader() });
      // Example with PATCH to update status:
      const response = await fetch(`http://localhost:5000/vehicles/${vehicleId}`, {
        method: 'PUT',
        headers: {
          ...getAuthHeader(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: 'inactive' }) // Or add a new 'rejected' status in DB if needed
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to reject vehicle');
      }

      const result = await response.json();
      console.log('Vehicle rejected:', result);
      alert('Vehicle request rejected.');

      // Update local state
      setPendingVehicles(prev => prev.filter(v => v.id !== vehicleId));
      // Update stats
      setStats(prev => ({ ...prev, pendingVehicles: prev.pendingVehicles - 1 }));

    } catch (error) {
      console.error('Error rejecting vehicle:', error);
      alert('Failed to reject vehicle: ' + error.message);
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

      // Update local state optimistically
      setAllRoutes(prev => prev.map(r => r.id === routeId ? { ...r, approved: 1, approved_at: new Date().toISOString(), approved_by_admin_id: user.id } : r));
      // Update stats
      setStats(prev => ({ ...prev, pendingRoutes: prev.pendingRoutes - 1, approvedRoutes: prev.approvedRoutes + 1 }));

      alert('Route approved successfully!');

    } catch (error) {
      console.error('Error approving route:', error);
      alert('Failed to approve route: ' + error.message);
    } finally {
      setLoadingApprove(null);
    }
  };

  const handleRejectRoute = async (routeId) => {
    if (!window.confirm("Are you sure you want to reject this route?")) {
      return;
    }
    try {
      // Assuming the backend has a DELETE endpoint for rejected routes
      // If not, implement a PATCH to update status if needed
      const response = await fetch(`http://localhost:5000/routes/${routeId}`, {
        method: 'DELETE', // Or PUT/PATCH if backend uses a different method
        headers: getAuthHeader(),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to reject route');
      }

      const result = await response.json();
      console.log('Route rejected:', result);
      alert('Route rejected and removed.');

      // Update local state
      setAllRoutes(prev => prev.filter(r => r.id !== routeId));
      // Update stats
      setStats(prev => ({ ...prev, pendingRoutes: prev.pendingRoutes - 1 }));

    } catch (error) {
      console.error('Error rejecting route:', error);
      alert('Failed to reject route: ' + error.message);
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
              <h1 className="text-2xl md:text-3xl font-bold text-white">Admin Dashboard</h1>
              <p className="text-slate-400 text-sm md:text-base">Manage routes, drivers, and passengers</p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
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
          {statsLoading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="bg-slate-800/50 backdrop-blur-sm rounded-xl p-4 md:p-6 border border-slate-700">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs md:text-sm text-slate-400">&nbsp;</p> {/* Placeholder for label */}
                    <div className="h-6 w-16 bg-slate-700 rounded mt-1"></div> {/* Skeleton for number */}
                  </div>
                  <div className="w-6 h-6 md:w-8 md:h-8 text-cyan-500"></div> {/* Placeholder for icon */}
                </div>
              </div>
            ))
          ) : (
            <>
              <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl p-4 md:p-6 border border-slate-700">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs md:text-sm text-slate-400">Total Users</p>
                    <h3 className="text-xl md:text-2xl font-bold text-white">{stats.totalUsers}</h3>
                  </div>
                  <User className="w-6 h-6 md:w-8 md:h-8 text-cyan-500" />
                </div>
              </div>
              <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl p-4 md:p-6 border border-slate-700">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs md:text-sm text-slate-400">Active Trips</p>
                    <h3 className="text-xl md:text-2xl font-bold text-white">{stats.activeTrips}</h3>
                  </div>
                  <Navigation className="w-6 h-6 md:w-8 md:h-8 text-blue-500" />
                </div>
              </div>
              <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl p-4 md:p-6 border border-slate-700">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs md:text-sm text-slate-400">Pending Routes</p>
                    <h3 className="text-xl md:text-2xl font-bold text-white">{stats.pendingRoutes}</h3>
                  </div>
                  <Clock className="w-6 h-6 md:w-8 md:h-8 text-yellow-500" />
                </div>
              </div>
              <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl p-4 md:p-6 border border-slate-700">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs md:text-sm text-slate-400">Active Drivers</p>
                    <h3 className="text-xl md:text-2xl font-bold text-white">{stats.activeDrivers}</h3>
                  </div>
                  <User className="w-6 h-6 md:w-8 md:h-8 text-green-500" />
                </div>
              </div>
            </>
          )}
        </div>

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-1 gap-4 md:gap-6">

          <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl p-4 md:p-6 border border-slate-700">
            <h2 className="text-lg md:text-xl font-semibold mb-4 flex items-center gap-2">
              <BusFront className="w-4 h-4 md:w-5 md:h-5" />
              Pending Vehicle Requests ({stats.pendingVehicles})
            </h2>
            {pendingVehicles.length === 0 ? (
              <p className="text-slate-400 text-center py-4 text-sm md:text-base">No pending vehicle requests.</p>
            ) : (
              <div className="space-y-3 max-h-[300px] overflow-y-auto">
                {pendingVehicles.map((vehicle) => (
                  <div key={vehicle.id} className="p-3 bg-slate-700/50 rounded-lg">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h3 className="font-semibold text-white text-sm">{vehicle.plate_number}</h3>
                        <div className="flex items-center gap-2 mt-1 text-xs text-slate-300">
                          <span>{vehicle.make} {vehicle.model}</span>
                          <span>Year: {vehicle.year}</span>
                          <span>Cap: {vehicle.capacity}</span>
                        </div>
                        <div className="mt-1 text-xs text-slate-500">
                          Requested by: {vehicle.proposed_by_driver_name || `Driver ID ${vehicle.proposed_by_driver_id}`}
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleApproveVehicle(vehicle.id)}
                          disabled={loadingApproveVehicle === vehicle.id}
                          className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs transition-colors ${loadingApproveVehicle === vehicle.id
                            ? 'bg-green-700 cursor-not-allowed'
                            : 'bg-green-600 hover:bg-green-500'
                            }`}
                        >
                          {loadingApproveVehicle === vehicle.id ? 'Approving...' : 'Approve'}
                          <CheckCircle className="w-3 h-3" />
                        </button>
                        <button
                          onClick={() => handleRejectVehicle(vehicle.id)}
                          disabled={loadingApproveVehicle === vehicle.id}
                          className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs transition-colors ${loadingApproveVehicle === vehicle.id
                            ? 'bg-red-700 cursor-not-allowed'
                            : 'bg-red-600 hover:bg-red-500'
                            }`}
                        >
                          {loadingApproveVehicle === vehicle.id ? 'Rejecting...' : 'Reject'}
                          <XCircle className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          {/* Pending Routes Section */}
          <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl p-4 md:p-6 border border-slate-700">
            <h2 className="text-lg md:text-xl font-semibold mb-4 flex items-center gap-2">
              <Clock className="w-4 h-4 md:w-5 md:h-5" />
              Pending Route Proposals ({stats.pendingRoutes})
            </h2>
            {pendingRoutes.length === 0 ? (
              <p className="text-slate-400 text-center py-4 text-sm md:text-base">No pending route proposals.</p>
            ) : (
              <div className="space-y-3 max-h-[300px] overflow-y-auto">
                {pendingRoutes.map((route) => (
                  <div key={route.id} className="p-3 bg-slate-700/50 rounded-lg">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h3 className="font-semibold text-white text-sm">{route.route_name}</h3>
                        <div className="flex items-center gap-2 mt-1 text-xs text-slate-300">
                          <div className="flex items-center gap-1">
                            <MapPin className="w-3 h-3" />
                            <span>{route.start_location_name}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <MapPin className="w-3 h-3" />
                            <span>{route.end_location_name}</span>
                          </div>
                        </div>
                        <div className="mt-1 text-xs text-slate-400">
                          Dist: {route.distance} km, Time: {route.estimated_time} mins
                        </div>
                        <div className="mt-1 text-xs text-slate-500">
                          Proposed by: {route.proposed_by_driver_name || `Driver ID ${route.proposed_by_driver_id}`}
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleApproveRoute(route.id)}
                          disabled={loadingApprove === route.id}
                          className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs transition-colors ${loadingApprove === route.id
                            ? 'bg-green-700 cursor-not-allowed'
                            : 'bg-green-600 hover:bg-green-500'
                            }`}
                        >
                          {loadingApprove === route.id ? 'Approving...' : 'Approve'}
                          <CheckCircle className="w-3 h-3" />
                        </button>
                        <button
                          onClick={() => handleRejectRoute(route.id)}
                          disabled={loadingApprove === route.id}
                          className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs transition-colors ${loadingApprove === route.id
                            ? 'bg-red-700 cursor-not-allowed'
                            : 'bg-red-600 hover:bg-red-500'
                            }`}
                        >
                          {loadingApprove === route.id ? 'Rejecting...' : 'Reject'}
                          <XCircle className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Approved Routes Section */}
          <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl p-4 md:p-6 border border-slate-700">
            <h2 className="text-lg md:text-xl font-semibold mb-4 flex items-center gap-2">
              <CheckCircle className="w-4 h-4 md:w-5 md:h-5" />
              Approved Routes ({stats.approvedRoutes})
            </h2>
            {approvedRoutes.length === 0 ? (
              <p className="text-slate-400 text-center py-4 text-sm md:text-base">No approved routes.</p>
            ) : (
              <div className="space-y-3 max-h-[300px] overflow-y-auto">
                {approvedRoutes.map((route) => (
                  <div key={route.id} className="p-3 bg-slate-700/50 rounded-lg">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h3 className="font-semibold text-white text-sm">{route.route_name}</h3>
                        <div className="flex items-center gap-2 mt-1 text-xs text-slate-300">
                          <div className="flex items-center gap-1">
                            <MapPin className="w-3 h-3" />
                            <span>{route.start_location_name}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <MapPin className="w-3 h-3" />
                            <span>{route.end_location_name}</span>
                          </div>
                        </div>
                        <div className="mt-1 text-xs text-slate-400">
                          Dist: {route.distance} km, Time: {route.estimated_time} mins
                        </div>
                        <div className="mt-1 text-xs text-slate-500">
                          Approved by: Admin ID {route.approved_by_admin_id} on {new Date(route.approved_at).toLocaleDateString()}
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
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
