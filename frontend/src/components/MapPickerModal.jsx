import { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import { X, MapPin, Navigation, CheckCircle } from 'lucide-react';

// Fix default leaflet marker icon (webpack/vite issue)
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

// Custom green pin for selected location
const greenIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

// Inner component to handle map clicks
function LocationSelector({ position, onSelect }) {
  useMapEvents({
    click(e) {
      onSelect({ lat: e.latlng.lat, lng: e.latlng.lng });
    },
  });
  return position ? <Marker position={[position.lat, position.lng]} icon={greenIcon} /> : null;
}

export default function MapPickerModal({ onClose, onConfirm, initialLat, initialLng }) {
  const [position, setPosition] = useState(
    initialLat && initialLng ? { lat: initialLat, lng: initialLng } : null
  );
  const [loadingGPS, setLoadingGPS] = useState(false);
  const [center, setCenter] = useState(
    initialLat && initialLng
      ? [initialLat, initialLng]
      : [11.0168, 76.9558] // Default: Coimbatore
  );

  const useMyLocation = () => {
    setLoadingGPS(true);
    if (!navigator.geolocation) {
      alert('GPS not supported on this browser.');
      setLoadingGPS(false);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setPosition(loc);
        setCenter([loc.lat, loc.lng]);
        setLoadingGPS(false);
      },
      () => {
        alert('GPS access denied. Please allow location permission.');
        setLoadingGPS(false);
      },
      { timeout: 10000, enableHighAccuracy: true }
    );
  };

  return (
    <div className="modal-overlay" style={{ zIndex: 1200 }} onClick={onClose}>
      <div
        className="modal animate-in"
        style={{ maxWidth: 520, width: '96vw', padding: 0, overflow: 'hidden' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="modal-header" style={{ padding: '14px 16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <MapPin size={18} style={{ color: 'var(--primary-400)' }} />
            <div>
              <div style={{ fontWeight: 700, fontSize: 15 }}>Pin Customer Location</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Map-ல் click செய்து location pin பண்ணுங்கள்</div>
            </div>
          </div>
          <button className="modal-close" onClick={onClose}><X size={18} /></button>
        </div>

        {/* GPS button */}
        <div style={{ padding: '10px 16px', borderBottom: '1px solid var(--border-subtle)' }}>
          <button
            type="button"
            className="btn btn-ghost"
            style={{ width: '100%', justifyContent: 'center', gap: 8, fontSize: 13 }}
            onClick={useMyLocation}
            disabled={loadingGPS}
          >
            <Navigation size={15} style={{ color: 'var(--primary-400)' }} />
            {loadingGPS ? 'Getting location...' : '📍 Use My Current GPS Location'}
          </button>
        </div>

        {/* Map */}
        <div style={{ height: 340, position: 'relative' }}>
          <MapContainer
            center={center}
            zoom={15}
            style={{ height: '100%', width: '100%', borderRadius: 0 }}
            key={center.join(',')}
          >
            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <LocationSelector position={position} onSelect={setPosition} />
          </MapContainer>
          {!position && (
            <div style={{
              position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
              background: 'rgba(255,255,255,0.85)', backdropFilter: 'blur(6px)',
              borderRadius: 10, padding: '8px 16px', fontSize: 12, color: 'var(--text-muted)',
              pointerEvents: 'none', zIndex: 999, textAlign: 'center',
            }}>
              👆 Map-ல் tap செய்து pin போடுங்கள்
            </div>
          )}
        </div>

        {/* Selected coords */}
        {position && (
          <div style={{
            padding: '10px 16px', background: 'rgba(16,185,129,0.06)',
            borderTop: '1px solid rgba(16,185,129,0.15)', display: 'flex', alignItems: 'center', gap: 8
          }}>
            <CheckCircle size={15} style={{ color: '#059669', flexShrink: 0 }} />
            <div style={{ fontSize: 12, color: '#059669', fontWeight: 600 }}>
              Location pinned: {position.lat.toFixed(6)}, {position.lng.toFixed(6)}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="modal-footer">
          <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button
            type="button"
            className="btn btn-primary"
            disabled={!position}
            onClick={() => { onConfirm(position); onClose(); }}
          >
            <MapPin size={15} /> Confirm Location
          </button>
        </div>
      </div>
    </div>
  );
}
