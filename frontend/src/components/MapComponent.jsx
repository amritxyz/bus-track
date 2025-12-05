// src/components/MapComponent.jsx
import React, { useEffect, useRef, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMapEvents, Polyline } from 'react-leaflet';
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
  passengers = [], // Only relevant for driver
  selectedBus = null,
  onBusSelect,
  onLocationSelect, // Only relevant for passenger/driver route selection (now removed from passenger flow)
  pickupLocation = null,
  dropoffLocation = null,
  userLocation = null,
  locationEnabled = true,
  proximityLevel = null,
  showRouteSelection = false, // New prop for driver
  proposedRoute = null, // New prop for driver
  showRouteForSelectedBus = false // New prop for passenger
}) => {
  const [mapCenter, setMapCenter] = useState([28.0441, 81.0291]); // Default to Butwal, Nepal
  const [mapZoom, setMapZoom] = useState(13);
  const [routePolyline, setRoutePolyline] = useState(null); // Store route polyline data

  // Fetch route details when selectedBus changes and showRouteForSelectedBus is true
  useEffect(() => {
    if (showRouteForSelectedBus && selectedBus && selectedBus.route_id) {
      const fetchRoute = async () => {
        try {
          // Assuming you have an endpoint to get route details by ID
          const response = await fetch(`http://localhost:5000/routes/${selectedBus.route_id}`);
          if (!response.ok) throw new Error('Failed to fetch route details');
          const routeData = await response.json();

          // Format route points for Polyline (assuming start/end lat/lng exist)
          const points = [
            [routeData.start_location_lat, routeData.start_location_lng],
            [routeData.end_location_lat, routeData.end_location_lng]
          ];
          setRoutePolyline(points);

        } catch (err) {
          console.error('Error fetching route for map:', err);
          setRoutePolyline(null); // Clear if error
        }
      };

      fetchRoute();
    } else {
      setRoutePolyline(null); // Clear route if no bus selected or flag is false
    }
  }, [selectedBus, showRouteForSelectedBus]);

  // Update map center based on user location or selected bus
  useEffect(() => {
    if (userLocation && locationEnabled) {
      setMapCenter([userLocation.lat, userLocation.lng]);
      setMapZoom(15);
    } else if (selectedBus && selectedBus.currentLocation) {
      setMapCenter([selectedBus.currentLocation.lat, selectedBus.currentLocation.lng]);
      setMapZoom(15);
    } else if (showRouteSelection && proposedRoute && (proposedRoute.start || proposedRoute.end)) {
      // Center on the midpoint of proposed route if available
      const points = [];
      if (proposedRoute.start) points.push([proposedRoute.start.lat, proposedRoute.start.lng]);
      if (proposedRoute.end) points.push([proposedRoute.end.lat, proposedRoute.end.lng]);
      if (points.length > 0) {
        const avgLat = points.reduce((sum, p) => sum + p[0], 0) / points.length;
        const avgLng = points.reduce((sum, p) => sum + p[1], 0) / points.length;
        setMapCenter([avgLat, avgLng]);
        setMapZoom(14); // Slightly zoomed out for route view
      }
    }
  }, [userLocation, locationEnabled, selectedBus, showRouteSelection, proposedRoute]);

  // Map Events Component to handle clicks (only if onLocationSelect is provided, e.g., for driver route selection)
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
  const getProxCircleRadius = (level) => getProximityCircleRadius(level);

  return (
    <MapContainer
      center={mapCenter}
      zoom={mapZoom}
      style={{ height: '100%', width: '100%' }}
      zoomControl={true}
      attributionControl={true}
    >
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
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

      {/* Proximity Circle (Passenger) - Only if pickup location and proximity exist */}
      {role === 'passenger' && pickupLocation && proximityLevel && (
        <Circle
          center={[pickupLocation.lat, pickupLocation.lng]}
          radius={getProxCircleRadius(proximityLevel)}
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
        if (!bus.currentLocation) return null; // Skip buses without location

        const busIcon = L.divIcon({
          className: 'custom-bus-marker',
          html: `<div class="bg-cyan-500 text-white rounded-full w-8 h-8 flex items-center justify-center font-bold border-2 border-white shadow-lg">
                    ${bus.plate_number || 'BUS'}
                 </div>`,
          iconSize: [32, 32],
          iconAnchor: [16, 16],
        });

        return (
          <Marker
            key={bus.id}
            position={[bus.currentLocation.lat, bus.currentLocation.lng]}
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
              <div>Available Seats: {bus.available_seats}</div>
            </Popup>
          </Marker>
        );
      })}

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
              <div className="font-semibold">{passenger.name}</div>
              <div>Status: {passenger.status}</div>
              {/* Add other passenger details */}
            </Popup>
          </Marker>
        );
      })}
    </MapContainer>
  );
};

export default MapComponent;
