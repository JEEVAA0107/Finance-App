import { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import { repaymentsAPI } from '../services/api';
import { Navigation, MapPin, Phone, HandCoins, AlertTriangle, Route } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';

// Fix leaflet icons
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

const blueIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41],
});

const getNumberedIcon = (num, color = 'red') => new L.DivIcon({
  html: `<div style="background:${color};color:#fff;width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:13px;border:2.5px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,0.3)">${num}</div>`,
  className: '',
  iconSize: [28, 28],
  iconAnchor: [14, 14],
});

// Calculate Haversine distance (km) between two lat/lng points
function haversineKm(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function MapRecenter({ center }) {
  const map = useMap();
  useEffect(() => { if (center) map.setView(center, 14); }, [center]);
  return null;
}

const fmt = (val) => {
  if (!val && val !== 0) return '₹0';
  return `₹${Number(val).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
};

export default function CollectionRoutePage() {
  const navigate = useNavigate();
  const [repayments, setRepayments] = useState([]);
  const [agentPos, setAgentPos] = useState(null);
  const [loadingGPS, setLoadingGPS] = useState(false);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('map');

  useEffect(() => {
    repaymentsAPI.today().then(data => {
      setRepayments(data);
      setLoading(false);
    }).catch(() => { toast.error('Failed to load'); setLoading(false); });
  }, []);

  const getAgentLocation = () => {
    setLoadingGPS(true);
    if (!navigator.geolocation) {
      toast.error('GPS not supported');
      setLoadingGPS(false);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setAgentPos({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setLoadingGPS(false);
        toast.success('📍 உங்கள் location found!');
      },
      () => { toast.error('GPS denied. Please allow location.'); setLoadingGPS(false); },
      { timeout: 10000, enableHighAccuracy: true }
    );
  };

  // Filter customers who have location pinned
  const withLocation = repayments.filter(r =>
    r.loan?.customer?.latitude && r.loan?.customer?.longitude && r.status !== 'PAID'
  );
  const withoutLocation = repayments.filter(r =>
    (!r.loan?.customer?.latitude || !r.loan?.customer?.longitude) && r.status !== 'PAID'
  );

  // Sort by nearest distance from agent
  const sortedByDistance = agentPos
    ? [...withLocation].sort((a, b) => {
        const da = haversineKm(agentPos.lat, agentPos.lng, a.loan.customer.latitude, a.loan.customer.longitude);
        const db = haversineKm(agentPos.lat, agentPos.lng, b.loan.customer.latitude, b.loan.customer.longitude);
        return da - db;
      })
    : withLocation;

  const mapCenter = agentPos
    ? [agentPos.lat, agentPos.lng]
    : sortedByDistance.length > 0
      ? [sortedByDistance[0].loan.customer.latitude, sortedByDistance[0].loan.customer.longitude]
      : [11.0168, 76.9558];

  // Route polyline points: agent → customer 1 → customer 2 → ...
  const routePoints = agentPos
    ? [[agentPos.lat, agentPos.lng], ...sortedByDistance.map(r => [r.loan.customer.latitude, r.loan.customer.longitude])]
    : sortedByDistance.map(r => [r.loan.customer.latitude, r.loan.customer.longitude]);

  const totalDue = repayments.filter(r => r.status !== 'PAID').reduce((s, r) => s + (r.dueAmount - r.paidAmount), 0);

  const openGoogleMaps = (lat, lng, name) => {
    window.open(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&destination_place_id=${encodeURIComponent(name)}`, '_blank');
  };

  if (loading) return <div style={{ display: 'flex', justifyContent: 'center', padding: '40px 0' }}><div className="spinner" /></div>;

  return (
    <div className="animate-in" style={{ paddingBottom: 40 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
        <button className="btn btn-ghost btn-sm" style={{ padding: '6px 10px' }} onClick={() => navigate('/collections')}>
          ← Back
        </button>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 18, fontWeight: 800, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Route size={18} style={{ color: 'var(--primary-400)' }} /> Collection Route Map
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            {sortedByDistance.length} customers with location · Total due: {fmt(totalDue)}
          </div>
        </div>
      </div>

      {/* GPS Button */}
      <div style={{ marginBottom: 12 }}>
        <button
          className="btn btn-primary"
          style={{ width: '100%', justifyContent: 'center', gap: 8 }}
          onClick={getAgentLocation}
          disabled={loadingGPS}
        >
          <Navigation size={16} />
          {loadingGPS ? 'Getting GPS...' : agentPos ? '✅ Location Set — Tap to Update' : '📍 Set My Current Location'}
        </button>
      </div>

      {/* Tabs */}
      <div className="tabs" style={{ marginBottom: 14 }}>
        <button className={`tab ${tab === 'map' ? 'active' : ''}`} onClick={() => setTab('map')}>🗺️ Map View</button>
        <button className={`tab ${tab === 'list' ? 'active' : ''}`} onClick={() => setTab('list')}>📋 Route List</button>
      </div>

      {tab === 'map' ? (
        <div style={{ height: 420, borderRadius: 14, overflow: 'hidden', border: '1.5px solid var(--border-subtle)', marginBottom: 16 }}>
          <MapContainer center={mapCenter} zoom={13} style={{ height: '100%', width: '100%' }}>
            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
            <MapRecenter center={mapCenter} />

            {/* Agent location marker */}
            {agentPos && (
              <Marker position={[agentPos.lat, agentPos.lng]} icon={blueIcon}>
                <Popup>
                  <strong>📍 You are here</strong><br />Starting point
                </Popup>
              </Marker>
            )}

            {/* Customer markers — numbered by distance order */}
            {sortedByDistance.map((r, i) => (
              <Marker
                key={r.id}
                position={[r.loan.customer.latitude, r.loan.customer.longitude]}
                icon={getNumberedIcon(i + 1, r.status === 'OVERDUE' ? '#e11d48' : '#059669')}
              >
                <Popup>
                  <div style={{ minWidth: 160 }}>
                    <strong style={{ fontSize: 13 }}>#{i + 1} {r.loan?.customer?.name}</strong><br />
                    <span style={{ fontSize: 12 }}>Due: {fmt(r.dueAmount - r.paidAmount)}</span><br />
                    <span style={{ fontSize: 11, color: '#666' }}>📞 {r.loan?.customer?.phone}</span><br />
                    <button
                      style={{ marginTop: 6, padding: '4px 10px', background: '#059669', color: '#fff', border: 'none', borderRadius: 6, fontSize: 11, cursor: 'pointer', width: '100%' }}
                      onClick={() => openGoogleMaps(r.loan.customer.latitude, r.loan.customer.longitude, r.loan.customer.name)}
                    >
                      🧭 Navigate
                    </button>
                  </div>
                </Popup>
              </Marker>
            ))}

            {/* Route polyline */}
            {routePoints.length > 1 && (
              <Polyline positions={routePoints} color="#6366f1" weight={3} dashArray="6,8" opacity={0.7} />
            )}
          </MapContainer>
        </div>
      ) : (
        /* Route List View */
        <div>
          {agentPos && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: 'rgba(99,102,241,0.08)', border: '1.5px solid rgba(99,102,241,0.2)', borderRadius: 12, marginBottom: 10 }}>
              <div style={{ width: 30, height: 30, borderRadius: '50%', background: '#6366f1', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 14 }}>📍</div>
              <div>
                <div style={{ fontWeight: 700, fontSize: 13 }}>Start — Your Location</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{agentPos.lat.toFixed(4)}, {agentPos.lng.toFixed(4)}</div>
              </div>
            </div>
          )}

          {sortedByDistance.map((r, i) => {
            const dist = agentPos
              ? i === 0
                ? haversineKm(agentPos.lat, agentPos.lng, r.loan.customer.latitude, r.loan.customer.longitude)
                : haversineKm(sortedByDistance[i-1].loan.customer.latitude, sortedByDistance[i-1].loan.customer.longitude, r.loan.customer.latitude, r.loan.customer.longitude)
              : null;
            return (
              <div key={r.id}>
                {dist !== null && (
                  <div style={{ textAlign: 'center', fontSize: 11, color: 'var(--text-muted)', padding: '4px 0' }}>
                    ↓ {dist.toFixed(1)} km
                  </div>
                )}
                <div className="collection-card" style={{ marginBottom: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 32, height: 32, borderRadius: '50%', background: r.status === 'OVERDUE' ? 'rgba(225,29,72,0.12)' : 'rgba(5,150,105,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 14, color: r.status === 'OVERDUE' ? '#e11d48' : '#059669', flexShrink: 0 }}>
                      {i + 1}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: 13 }}>{r.loan?.customer?.name}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{r.loan?.loanNumber} · {fmt(r.dueAmount - r.paidAmount)}</div>
                    </div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button
                        className="btn btn-ghost btn-sm"
                        style={{ padding: '6px 8px' }}
                        onClick={() => openGoogleMaps(r.loan.customer.latitude, r.loan.customer.longitude, r.loan.customer.name)}
                        title="Navigate"
                      >
                        <Navigation size={14} />
                      </button>
                      <a href={`tel:${r.loan?.customer?.phone}`} className="btn btn-ghost btn-sm" style={{ padding: '6px 8px' }}>
                        <Phone size={14} />
                      </a>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}

          {/* Customers without location */}
          {withoutLocation.length > 0 && (
            <div style={{ marginTop: 16 }}>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                <AlertTriangle size={13} style={{ color: '#d97706' }} />
                {withoutLocation.length} customers without pinned location
              </div>
              {withoutLocation.map(r => (
                <div key={r.id} className="collection-card" style={{ marginBottom: 8, opacity: 0.65 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'rgba(217,119,6,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <MapPin size={14} style={{ color: '#d97706' }} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 700, fontSize: 13 }}>{r.loan?.customer?.name}</div>
                      <div style={{ fontSize: 11, color: '#d97706' }}>📍 No location pinned — Customers page-ல் pin பண்ணுங்கள்</div>
                    </div>
                    <div style={{ fontWeight: 700, fontSize: 13 }}>{fmt(r.dueAmount - r.paidAmount)}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
