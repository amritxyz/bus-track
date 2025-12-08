// src/components/MapComponent.jsx
import React, { useEffect, useRef, useState, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { MapContainer, TileLayer, Marker, Popup, useMapEvents, Polyline, Circle } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css'; // Import Leaflet CSS
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

// Fix for default marker icons in Vite
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl: icon,
  iconRetinaUrl: icon,
  shadowUrl: iconShadow,
});

// Helper function to get proximity circle color (you might have this elsewhere)
const getProximityCircleColor = (level) => {
  if (!level) return '#3B82F6'; // Default blue
  switch (level) {
    case 'arrived': return '#10B981'; // Green
    case 'nearby': return '#F59E0B'; // Amber
    case 'approaching': return '#EF4444'; // Red
    default: return '#3B82F6'; // Blue
  }
};

// Helper function to get proximity circle radius
const getProximityCircleRadius = (level) => {
  if (!level) return 50; // Default radius
  switch (level) {
    case 'arrived': return 25;
    case 'nearby': return 100;
    case 'approaching': return 200;
    default: return 50;
  }
};

const MapComponent = ({
  role,
  buses = [],
  passengers = [],
  selectedBus = null,
  onBusSelect,
  onLocationSelect,
  pickupLocation = null,
  dropoffLocation = null,
  userLocation = null,
  locationEnabled = true,
  proximityLevel = null,
  showRouteSelection = false,
  proposedRoute = null,
  showLocationSelection = false,
  showRouteForSelectedBus = false,
  showAllRoutes = false,
  routes = [],
  onBookTrip
}) => {
  const [mapCenter, setMapCenter] = useState([28.0441, 81.0291]); // Default
  const [mapZoom, setMapZoom] = useState(13);
  const [routePolyline, setRoutePolyline] = useState(null);
  const mapRef = useRef();

  // Fetch route details when selectedBus changes and showRouteForSelectedBus is true
  useEffect(() => {
    // Only react when the selectedBus identity or route selection flag changes
    if (!showRouteForSelectedBus || !selectedBus) {
      setRoutePolyline(null);
      return;
    }

    // If selectedBus already contains start/end coords, use them directly
    if (selectedBus.start_location_lat != null && selectedBus.start_location_lng != null &&
      selectedBus.end_location_lat != null && selectedBus.end_location_lng != null) {
      setRoutePolyline([
        [selectedBus.start_location_lat, selectedBus.start_location_lng],
        [selectedBus.end_location_lat, selectedBus.end_location_lng]
      ]);
      return;
    }

    // Otherwise, fetch route details once using route_id (only when route_id or bus id changes)
    let cancelled = false;
    const fetchRoute = async () => {
      if (!selectedBus.route_id) {
        setRoutePolyline(null);
        return;
      }
      try {
        const { data: routeData, error } = await supabase
          .from('routes')
          .select('*')
          .eq('id', selectedBus.route_id)
          .single();

        if (error) throw error;
        if (cancelled) return;

        if (routeData && routeData.start_location_lat != null) {
          setRoutePolyline([
            [routeData.start_location_lat, routeData.start_location_lng],
            [routeData.end_location_lat, routeData.end_location_lng]
          ]);
        } else {
          setRoutePolyline(null);
        }
      } catch (err) {
        if (!cancelled) {
          console.error('Error fetching route for map:', err);
          setRoutePolyline(null);
        }
      }
    };

    fetchRoute();

    return () => { cancelled = true; };
  }, [selectedBus?.id, selectedBus?.route_id, showRouteForSelectedBus]);

  const allRoutePolylines = useMemo(() => {
    // Prefer explicit `routes` prop (from /routes endpoint) because that contains start/end coords
    if (routes && routes.length > 0) {
      return routes.reduce((acc, r) => {
        if (r.start_location_lat != null && r.start_location_lng != null && r.end_location_lat != null && r.end_location_lng != null) {
          // attach trips that use this route (from buses/trips data)
          const matchingTrips = (buses || []).filter(b => b.route_id == r.id).map(b => ({
            id: b.id,
            tripId: b.id,
            departure_time: b.departure_time,
            arrival_time: b.arrival_time,
            fare: b.fare,
            available_seats: b.available_seats,
            plate_number: b.plate_number,
            driver_name: b.driver_name,
            currentLocation: b.currentLocation || b.current_location || null
          }));

          acc.push({ points: [[r.start_location_lat, r.start_location_lng], [r.end_location_lat, r.end_location_lng]], id: r.id, name: r.route_name, trips: matchingTrips });
        }
        return acc;
      }, []);
    }

    // Fallback to trying to derive from `buses` when `routes` is not provided
    if (!buses || buses.length === 0) return [];

    return buses.reduce((acc, bus) => {
      const sLat = bus.start_location_lat ?? bus.start_lat ?? bus.start_location?.lat;
      const sLng = bus.start_location_lng ?? bus.start_lng ?? bus.start_location?.lng;
      const eLat = bus.end_location_lat ?? bus.end_lat ?? bus.end_location?.lat;
      const eLng = bus.end_location_lng ?? bus.end_lng ?? bus.end_location?.lng;

      if (sLat != null && sLng != null && eLat != null && eLng != null) {
        const tripInfo = {
          id: bus.id,
          tripId: bus.id,
          departure_time: bus.departure_time,
          arrival_time: bus.arrival_time,
          fare: bus.fare,
          available_seats: bus.available_seats,
          plate_number: bus.plate_number,
          driver_name: bus.driver_name,
          currentLocation: bus.currentLocation || bus.current_location || null
        };
        acc.push({ points: [[sLat, sLng], [eLat, eLng]], id: bus.id, trips: [tripInfo], name: bus.route_name || null });
      }
      return acc;
    }, []);
  }, [routes, buses]);

  // Effect to handle initial centering and updates based on userLocation
  useEffect(() => {
    if (mapRef.current && role === 'driver' && userLocation && locationEnabled) {
      const map = mapRef.current;
      // Optionally, only center if the map isn't already centered on a trip
      // Check if the current map center is significantly different from the user location
      const currentCenter = map.getCenter();
      const distance = map.distance(currentCenter, userLocation);
      // Only re-center if the distance is large (e.g., > 1000 meters)
      if (distance > 1000) {
        map.setView([userLocation.lat, userLocation.lng], 15);
      }
    }
  }, [userLocation, locationEnabled, role]); // Depend on userLocation, locationEnabled, and role

  // Effect to handle centering based on selected bus/trip (for drivers and passengers)
  useEffect(() => {
    if (!mapRef.current) return;

    // Do NOT update center if driver role and user location is available and enabled (handled above)
    if (role === 'driver' && userLocation && locationEnabled) {
      return;
    }

    let newCenter = null;
    let newZoom = 13;

    if (selectedBus) {
      if (selectedBus.currentLocation) {
        newCenter = [selectedBus.currentLocation.lat, selectedBus.currentLocation.lng];
      } else if (selectedBus.start_location_lat && selectedBus.start_location_lng) {
        newCenter = [selectedBus.start_location_lat, selectedBus.start_location_lng];
      }
      newZoom = 15;
    } else if (buses.length > 0) {
      const firstBus = buses[0];
      if (firstBus.currentLocation) {
        newCenter = [firstBus.currentLocation.lat, firstBus.currentLocation.lng];
      } else if (firstBus.start_location_lat && firstBus.start_location_lng) {
        newCenter = [firstBus.start_location_lat, firstBus.start_location_lng];
      }
      newZoom = 13;
    } else if (role === 'passenger' && showLocationSelection && (pickupLocation || dropoffLocation)) {
      const points = [];
      if (pickupLocation) points.push([pickupLocation.lat, pickupLocation.lng]);
      if (dropoffLocation) points.push([dropoffLocation.lat, dropoffLocation.lng]);
      if (points.length > 0) {
        const avgLat = points.reduce((sum, p) => sum + p[0], 0) / points.length;
        const avgLng = points.reduce((sum, p) => sum + p[1], 0) / points.length;
        newCenter = [avgLat, avgLng];
        newZoom = 14;
      }
    } else if (showRouteSelection && proposedRoute && (proposedRoute.start || proposedRoute.end)) {
      const points = [];
      if (proposedRoute.start) points.push([proposedRoute.start.lat, proposedRoute.start.lng]);
      if (proposedRoute.end) points.push([proposedRoute.end.lat, proposedRoute.end.lng]);
      if (points.length > 0) {
        const avgLat = points.reduce((sum, p) => sum + p[0], 0) / points.length;
        const avgLng = points.reduce((sum, p) => sum + p[1], 0) / points.length;
        newCenter = [avgLat, avgLng];
        newZoom = 14;
      }
    }

    if (newCenter) {
      mapRef.current.setView(newCenter, newZoom);
    }
  }, [userLocation, locationEnabled, role, selectedBus, showLocationSelection, pickupLocation, dropoffLocation, showRouteSelection, proposedRoute, buses]);

  // Map Events Component to handle clicks (only if onLocationSelect is provided, e.g., for driver route selection or passenger location selection)
  const MapClickHandler = () => {
    useMapEvents({
      click: (e) => {
        if (onLocationSelect) { // Only handle clicks if onLocationSelect is provided
          onLocationSelect({ lat: e.latlng.lat, lng: e.latlng.lng });
        }
      },
    });
    return null; // This component doesn't render anything itself
  };

  // Determine proximity circle color
  const getProxCircleColor = (level) => getProximityCircleColor(level);
  // Determine proximity circle radius
  const getProxCircleColorRadius = (level) => getProximityCircleRadius(level);

  return (
    <MapContainer
      ref={mapRef}
      center={mapCenter}
      zoom={mapZoom}
      style={{ height: '100%', width: '100%' }}
      zoomControl={true}
      attributionControl={true}
    >
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright  ">OpenStreetMap</a> contributors'
      />
      {onLocationSelect && <MapClickHandler />} {/* Add the click handler only if onLocationSelect is provided */}

      {/* User's Current Location Marker (Passenger) */}
      {role === 'passenger' && userLocation && locationEnabled && (
        <Marker position={[userLocation.lat, userLocation.lng]}>
          <Popup>You are here</Popup>
        </Marker>
      )}

      {/* Pickup/Dropoff Markers (Passenger - if still needed for booking confirmation) */}
      {role === 'passenger' && pickupLocation && (
        <Marker position={[pickupLocation.lat, pickupLocation.lng]}>
          <Popup>Pickup Location</Popup>
        </Marker>
      )}
      {role === 'passenger' && dropoffLocation && (
        <Marker position={[dropoffLocation.lat, dropoffLocation.lng]}>
          <Popup>Dropoff Location</Popup>
        </Marker>
      )}

      {/* Pickup/Dropoff Line (Passenger - when selecting locations) */}
      {role === 'passenger' && showLocationSelection && pickupLocation && dropoffLocation && (
        <Polyline
          positions={[
            [pickupLocation.lat, pickupLocation.lng],
            [dropoffLocation.lat, dropoffLocation.lng]
          ]}
          color="green"
          dashArray="5, 5" // Dashed line for pickup/dropoff route
          weight={4}
        />
      )}

      {/* Proximity Circle (Passenger) - Only if pickup location and proximity exist */}
      {role === 'passenger' && pickupLocation && proximityLevel && (
        <Circle
          center={[pickupLocation.lat, pickupLocation.lng]}
          radius={getProxCircleColorRadius(proximityLevel)}
          color={getProxCircleColor(proximityLevel)}
          fillOpacity={0.1}
        />
      )}

      {/* Route for Selected Bus (Passenger) */}
      {showRouteForSelectedBus && routePolyline && (
        <Polyline
          positions={routePolyline}
          color="blue"
          dashArray="10, 5" // Dashed line for the route
          weight={4}
        />
      )}

      {/* All Bus Routes (Passenger) */}
      {showAllRoutes && allRoutePolylines.map((r, idx) => {
        const start = r.points[0];
        const end = r.points[1];
        const mid = [(start[0] + end[0]) / 2, (start[1] + end[1]) / 2];
        return (
          <Polyline
            key={r.id || idx}
            positions={r.points}
            color="#3B82F6"
            dashArray="6,4"
            weight={3}
            opacity={0.9}
          >
            <Popup>
              <div className="text-sm">
                <div className="font-semibold">{r.name || 'Route'}</div>
                {r.trips && r.trips.length > 0 ? (
                  <div className="space-y-2 mt-1">
                    {r.trips.map((t) => (
                      <div key={t.tripId} className="text-xs">
                        <div><strong>Trip ID:</strong> {t.tripId}</div>
                        <div><strong>Bus:</strong> {t.plate_number || 'N/A'}</div>
                        <div><strong>Driver:</strong> {t.driver_name || 'N/A'}</div>
                        <div><strong>Departs:</strong> {t.departure_time ? new Date(t.departure_time).toLocaleString() : 'N/A'}</div>
                        <div><strong>Arrives:</strong> {t.arrival_time ? new Date(t.arrival_time).toLocaleString() : 'N/A'}</div>
                        <div><strong>Seats:</strong> {t.available_seats ?? 'N/A'} | <strong>Fare:</strong> {t.fare ?? 'N/A'}</div>
                        <div className="mt-1">
                          <button
                            onClick={() => onBookTrip && onBookTrip(t)}
                            className="w-full text-xs py-1 px-2 rounded bg-cyan-500 text-white"
                          >
                            Book this trip
                          </button>
                        </div>
                        <hr className="my-1" />
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-xs mt-1">No active trips for this route.</div>
                )}
              </div>
            </Popup>
          </Polyline>
        );
      })}

      {/* Route Selection Markers and Line (Driver) */}
      {showRouteSelection && (
        <>
          {proposedRoute.start && (
            <Marker position={[proposedRoute.start.lat, proposedRoute.start.lng]}>
              <Popup>Proposed Start</Popup>
            </Marker>
          )}
          {proposedRoute.end && (
            <Marker position={[proposedRoute.end.lat, proposedRoute.end.lng]}>
              <Popup>Proposed End</Popup>
            </Marker>
          )}
          {proposedRoute.start && proposedRoute.end && (
            <Polyline
              positions={[
                [proposedRoute.start.lat, proposedRoute.start.lng],
                [proposedRoute.end.lat, proposedRoute.end.lng]
              ]}
              color="red"
              dashArray="5, 5" // Dashed line for proposed route
            />
          )}
        </>
      )}

      {/* Buses Markers */}
      {buses.map((bus) => {
        // Display bus at current location if available, otherwise at route start location
        let busLocation = null;

        if (bus.currentLocation) {
          busLocation = bus.currentLocation;
        } else if (bus.start_location_lat && bus.start_location_lng) {
          // Fallback to route start location if no real-time location
          busLocation = { lat: bus.start_location_lat, lng: bus.start_location_lng };
        } else {
          return null; // Skip if no location available at all
        }

        const busIcon = L.divIcon({
          className: 'custom-bus-marker',
          html: `<div class="bg-cyan-500 text-white rounded-full w-8 h-8 flex items-center justify-center font-bold border-2 border-white shadow-lg">
                    ${bus.plate_number ? bus.plate_number.charAt(0) : 'B'}
                 </div>`,
          iconSize: [32, 32],
          iconAnchor: [16, 16],
        });

        return (
          <Marker
            key={bus.id}
            position={[busLocation.lat, busLocation.lng]}
            icon={busIcon}
            eventHandlers={{
              click: () => {
                if (role === 'passenger') {
                  onBusSelect(bus); // Select bus for booking
                } else if (role === 'driver' && bus.driver_id == selectedBus?.id) { // Use == for potential string/number comparison
                  // For driver, maybe highlight own bus differently, or just select it again
                  onBusSelect(bus);
                }
              },
            }}
          >
            <Popup>
              <div className="font-semibold">Bus: {bus.plate_number}</div>
              <div>Route: {bus.route_name}</div>
              <div>Driver: {bus.driver_name || 'N/A'}</div>
              <div>Status: {bus.status}</div>
              <div>Departure: {new Date(bus.departure_time).toLocaleTimeString()}</div>
              <div>Available Seats: {bus.available_seats}</div>
              {!bus.currentLocation && <div className="text-sm text-gray-500">(Location: Route Start)</div>}
            </Popup>
          </Marker>
        );
      })}

      {role === 'driver' && userLocation && locationEnabled && (
        <Marker position={[userLocation.lat, userLocation.lng]}>
          <Popup>You are here (Driver)</Popup>
        </Marker>
      )}

      {/* Passenger Markers (Driver View) */}
      {role === 'driver' && passengers.map((passenger) => {
        // For simplicity, assuming passenger has a pickup location object with lat/lng
        // You might need to adjust based on your actual passenger object structure
        if (!passenger.pickup_location) return null;
        const { lat, lng } = passenger.pickup_location;
        const passengerIcon = L.divIcon({
          className: 'custom-passenger-marker',
          html: `<div class="bg-green-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold border-2 border-white shadow-lg">
                    P
                 </div>`,
          iconSize: [24, 24],
          iconAnchor: [12, 12],
        });

        return (
          <Marker
            key={passenger.id}
            position={[lat, lng]}
            icon={passengerIcon}
          >
            <Popup>
              <div className="font-semibold text-sm mb-2">{passenger.passenger_name || `Passenger #${passenger.passenger_id}`}</div>
              <div className="text-xs space-y-1">
                <div><strong>Booking ID:</strong> {passenger.id}</div>
                <div><strong>Seat:</strong> {passenger.seat_number}</div>
                <div><strong>Pickup:</strong> {passenger.pickup_location?.name || `(${passenger.pickup_location?.lat?.toFixed(4)}, ${passenger.pickup_location?.lng?.toFixed(4)})`}</div>
                <div><strong>Dropoff:</strong> {passenger.dropoff_location?.name || `(${passenger.dropoff_location?.lat?.toFixed(4)}, ${passenger.dropoff_location?.lng?.toFixed(4)})`}</div>
              </div>
            </Popup>
          </Marker>
        );
      })}
    </MapContainer>
  );
};

export default MapComponent;
