// src/components/MapComponent.jsx
import React, { useEffect, useRef, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMapEvents, Circle } from 'react-leaflet';
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

const MapComponent = ({
  role,
  buses = [],
  passengers = [], // Only relevant for driver
  selectedBus = null,
  onBusSelect,
  onLocationSelect, // Only relevant for passenger
  pickupLocation = null,
  dropoffLocation = null,
  userLocation = null, // For current location marker
  locationEnabled = true, // For current location marker visibility
  proximityLevel = null // For passenger proximity highlighting
}) => {
  const [mapCenter, setMapCenter] = useState([28.0441, 81.0291]); // Default to Butwal, Nepal
  const [mapZoom, setMapZoom] = useState(13);

  // Map Events Component to handle clicks
  const MapClickHandler = () => {
    useMapEvents({
      click: (e) => {
        if (role === 'passenger' && onLocationSelect) {
          onLocationSelect({ lat: e.latlng.lat, lng: e.latlng.lng });
        }
      },
    });
    return null; // This component doesn't render anything itself
  };

  // Update map center based on user location or selected bus
  useEffect(() => {
    if (userLocation && locationEnabled) {
      setMapCenter([userLocation.lat, userLocation.lng]);
      setMapZoom(15); // Zoom in when showing user location
    } else if (selectedBus && selectedBus.currentLocation) {
      setMapCenter([selectedBus.currentLocation.lat, selectedBus.currentLocation.lng]);
      setMapZoom(15);
    }
  }, [userLocation, locationEnabled, selectedBus]);

  // Determine proximity circle color
  const getProximityCircleColor = (level) => {
    if (!level) return '#3B82F6'; // Default blue
    switch (level) {
      case 'arrived': return '#10B981'; // Green
      case 'nearby': return '#F59E0B'; // Amber
      case 'approaching': return '#EF4444'; // Red
      default: return '#3B82F6'; // Blue
    }
  };

  // Determine proximity circle radius
  const getProximityCircleRadius = (level) => {
    if (!level) return 50; // Default radius
    switch (level) {
      case 'arrived': return 25;
      case 'nearby': return 100;
      case 'approaching': return 200;
      default: return 50;
    }
  };

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
      <MapClickHandler /> {/* Add the click handler */}

      {/* User's Current Location Marker (Passenger) */}
      {role === 'passenger' && userLocation && locationEnabled && (
        <Marker position={[userLocation.lat, userLocation.lng]}>
          <Popup>You are here</Popup>
        </Marker>
      )}

      {/* Pickup/Dropoff Markers (Passenger) */}
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
          radius={getProximityCircleRadius(proximityLevel)}
          color={getProximityCircleColor(proximityLevel)}
          fillOpacity={0.1}
        />
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
                } else if (role === 'driver' && bus.driver_id === selectedBus?.id) {
                  // For driver, maybe highlight own bus differently, or just select it again
                  onBusSelect(bus);
                }
              },
            }}
          >
            <Popup>
              <div className="font-semibold">Bus: {bus.plate_number}</div>
              <div>Driver: {bus.driver_name || 'N/A'}</div>
              <div>Status: {bus.status}</div>
              <div>Capacity: {bus.capacity}</div>
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
