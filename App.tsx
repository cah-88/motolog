
import React, { useState, useEffect, useRef } from 'react';
import { 
  Navigation, 
  MapPin, 
  History, 
  Settings, 
  Plus, 
  Play, 
  Square, 
  Fuel, 
  Wrench, 
  Download,
  Trash2,
  ChevronRight,
  TrendingUp,
  LayoutDashboard,
  Coins,
  Globe,
  FileText,
  X,
  Calendar,
  PlusCircle,
  Droplets,
  CircleStop,
  Layers,
  Ellipsis,
  Clock
} from 'lucide-react';
import { Ride, LocationPoint, MotorcycleType, MaintenanceRecord } from './types';
import { getTotalDistance } from './services/geoUtils';
import { analyzeRide } from './services/geminiService';
import { exportRidesToExcel } from './services/exportService';
import { CURRENCIES, DEFAULT_FUEL_PRICE } from './constants';
import Button from './components/Button';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'history' | 'garage' | 'settings'>('dashboard');
  
  // Persistent State
  const [rides, setRides] = useState<Ride[]>(() => {
    const saved = localStorage.getItem('motolog_rides');
    return saved ? JSON.parse(saved) : [];
  });
  const [maintenanceRecords, setMaintenanceRecords] = useState<MaintenanceRecord[]>(() => {
    const saved = localStorage.getItem('motolog_maintenance');
    return saved ? JSON.parse(saved) : [];
  });
  const [currencyCode, setCurrencyCode] = useState<string>(() => {
    return localStorage.getItem('motolog_currency') || 'USD';
  });
  const [fuelPrice, setFuelPrice] = useState<number>(() => {
    const saved = localStorage.getItem('motolog_fuel_price');
    return saved ? parseFloat(saved) : DEFAULT_FUEL_PRICE;
  });
  const [motorcycleType, setMotorcycleType] = useState<MotorcycleType>(() => {
    return (localStorage.getItem('motolog_bike') as MotorcycleType) || 'Commuter';
  });

  // Tracking & Form States
  const [isTracking, setIsTracking] = useState(false);
  const [currentPath, setCurrentPath] = useState<LocationPoint[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [pendingRide, setPendingRide] = useState<Ride | null>(null);
  const [noteInput, setNoteInput] = useState('');
  const [showAddMaintenance, setShowAddMaintenance] = useState(false);
  
  // Maintenance Form State
  const [maintForm, setMaintForm] = useState<Omit<MaintenanceRecord, 'id'>>({
    date: Date.now(),
    type: 'Oil Change',
    cost: 0,
    description: ''
  });
  
  const watchIdRef = useRef<number | null>(null);

  useEffect(() => {
    localStorage.setItem('motolog_rides', JSON.stringify(rides));
  }, [rides]);

  useEffect(() => {
    localStorage.setItem('motolog_maintenance', JSON.stringify(maintenanceRecords));
  }, [maintenanceRecords]);

  useEffect(() => {
    localStorage.setItem('motolog_currency', currencyCode);
  }, [currencyCode]);

  useEffect(() => {
    localStorage.setItem('motolog_fuel_price', fuelPrice.toString());
  }, [fuelPrice]);

  useEffect(() => {
    localStorage.setItem('motolog_bike', motorcycleType);
  }, [motorcycleType]);

  const currency = CURRENCIES.find(c => c.code === currencyCode) || CURRENCIES[0];

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: currency.code,
      minimumFractionDigits: 2
    }).format(amount);
  };

  const formatNumber = (num: number, fractionDigits: number = 2) => {
    return num.toLocaleString(undefined, {
      minimumFractionDigits: fractionDigits,
      maximumFractionDigits: fractionDigits
    });
  };

  const formatDuration = (ms: number) => {
    const mins = Math.floor(ms / (1000 * 60));
    if (mins < 60) return `${mins}m`;
    const hrs = Math.floor(mins / 60);
    const remainingMins = mins % 60;
    return remainingMins > 0 ? `${hrs}h ${remainingMins}m` : `${hrs}h`;
  };

  const startTracking = () => {
    if (!navigator.geolocation) {
      alert("Geolocation is not supported by your browser");
      return;
    }

    setIsTracking(true);
    setCurrentPath([]);
    
    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const newPoint: LocationPoint = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          timestamp: pos.timestamp,
          speed: pos.coords.speed
        };
        setCurrentPath(prev => [...prev, newPoint]);
      },
      (err) => {
        console.error(err);
        stopTracking();
      },
      { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
    );
  };

  const stopTracking = async () => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    
    setIsTracking(false);

    if (currentPath.length < 2) {
      setCurrentPath([]);
      return;
    }

    setIsAnalyzing(true);
    const distance = getTotalDistance(currentPath);
    const durationMs = currentPath[currentPath.length - 1].timestamp - currentPath[0].timestamp;
    const durationHrs = durationMs / (1000 * 60 * 60);
    const avgSpeed = durationHrs > 0 ? distance / durationHrs : 0;

    try {
      const analysis = await analyzeRide(motorcycleType, distance, avgSpeed, currentPath, fuelPrice);

      const rideDraft: Ride = {
        id: crypto.randomUUID(),
        startTime: currentPath[0].timestamp,
        endTime: currentPath[currentPath.length - 1].timestamp,
        durationMs,
        distanceKm: distance,
        avgSpeedKmh: avgSpeed,
        path: currentPath,
        motorcycleType,
        estimatedFuelCost: analysis.estimatedFuelCost,
        estimatedMaintenanceCost: analysis.estimatedMaintenanceCost,
        placesVisited: analysis.placesVisited,
      };

      setPendingRide(rideDraft);
      setNoteInput('');
    } catch (e) {
      console.error(e);
    } finally {
      setIsAnalyzing(false);
      setCurrentPath([]);
    }
  };

  const savePendingRide = () => {
    if (pendingRide) {
      const finalizedRide = { ...pendingRide, notes: noteInput.trim() || undefined };
      setRides(prev => [finalizedRide, ...prev]);
      setPendingRide(null);
      setActiveTab('history');
    }
  };

  const addMaintenanceRecord = () => {
    const newRecord: MaintenanceRecord = {
      ...maintForm,
      id: crypto.randomUUID()
    };
    setMaintenanceRecords(prev => [newRecord, ...prev]);
    setShowAddMaintenance(false);
    setMaintForm({
      date: Date.now(),
      type: 'Oil Change',
      cost: 0,
      description: ''
    });
  };

  const deleteMaintenance = (id: string) => {
    if (confirm("Delete this maintenance record?")) {
      setMaintenanceRecords(prev => prev.filter(m => m.id !== id));
    }
  };

  const deleteRide = (id: string) => {
    if (confirm("Delete this ride record?")) {
      setRides(prev => prev.filter(r => r.id !== id));
    }
  };

  const totalDistance = rides.reduce((acc, r) => acc + r.distanceKm, 0);
  const totalFuel = rides.reduce((acc, r) => acc + r.estimatedFuelCost, 0);
  const totalMaintEstimated = rides.reduce((acc, r) => acc + r.estimatedMaintenanceCost, 0);
  const totalMaintLogged = maintenanceRecords.reduce((acc, m) => acc + m.cost, 0);
  const totalCost = totalFuel + totalMaintEstimated + totalMaintLogged;

  const getMaintIcon = (type: MaintenanceRecord['type']) => {
    switch (type) {
      case 'Oil Change': return <Droplets size={20} className="text-amber-500" />;
      case 'Tires': return <Layers size={20} className="text-slate-600" />;
      case 'Brakes': return <CircleStop size={20} className="text-rose-500" />;
      case 'Service': return <Wrench size={20} className="text-indigo-500" />;
      default: return <Ellipsis size={20} className="text-slate-400" />;
    }
  };

  return (
    <div className="min-h-screen pb-24 flex flex-col bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30 px-4 py-4 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white">
            <Navigation size={24} />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-slate-900 leading-none mb-1">MotoLog</h1>
            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Intelligent Expenses</p>
          </div>
        </div>
        <Button 
          variant="secondary" 
          size="sm" 
          onClick={() => exportRidesToExcel(rides, currency.symbol)}
          disabled={rides.length === 0}
        >
          <Download size={18} className="mr-2" />
          Export
        </Button>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-4xl mx-auto w-full p-4 space-y-6">
        {activeTab === 'dashboard' && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
            {/* Stats Overview */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-tighter mb-1">Distance</p>
                <p className="text-2xl font-black text-slate-900">{formatNumber(totalDistance, 1)} <span className="text-sm font-normal text-slate-400">km</span></p>
                <div className="flex items-center text-emerald-600 text-[10px] mt-1 font-bold uppercase">
                  <TrendingUp size={10} className="mr-1" /> Lifetime
                </div>
              </div>
              <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-tighter mb-1">Total Expenses</p>
                <p className="text-2xl font-black text-slate-900">{formatCurrency(totalCost)}</p>
                <p className="text-[10px] text-slate-400 font-medium uppercase mt-1">Full Ownership Cost</p>
              </div>
              <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
                <div className="flex items-center gap-1 text-indigo-600 mb-1">
                  <Fuel size={12} />
                  <p className="text-xs font-bold uppercase tracking-tighter">Fuel Total</p>
                </div>
                <p className="text-xl font-black text-slate-900">{formatCurrency(totalFuel)}</p>
              </div>
              <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
                <div className="flex items-center gap-1 text-amber-500 mb-1">
                  <Wrench size={12} />
                  <p className="text-xs font-bold uppercase tracking-tighter">Service Total</p>
                </div>
                <p className="text-xl font-black text-slate-900">{formatCurrency(totalMaintLogged + totalMaintEstimated)}</p>
              </div>
            </div>

            {/* Active Ride Card */}
            <div className={`relative overflow-hidden rounded-3xl p-6 transition-all duration-300 ${isTracking ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-200' : 'bg-slate-900 text-white shadow-xl shadow-slate-200'}`}>
              <div className="relative z-10">
                <h3 className="text-lg font-bold mb-2 flex items-center gap-2">
                  {isTracking ? <span className="flex h-2 w-2 rounded-full bg-rose-400 animate-ping"></span> : null}
                  {isTracking ? 'Tracking Active...' : 'New Trip'}
                </h3>
                {isTracking ? (
                  <div className="space-y-4">
                    <div className="flex items-baseline gap-2">
                      <span className="text-6xl font-black tracking-tighter">
                        {formatNumber(getTotalDistance(currentPath), 2)}
                      </span>
                      <span className="text-xl opacity-75 font-bold uppercase tracking-widest">KM</span>
                    </div>
                    <div className="flex gap-4">
                       <div className="bg-white/20 px-3 py-1.5 rounded-xl text-xs font-bold backdrop-blur-md uppercase tracking-wide">
                        {currentPath.length.toLocaleString()} Logs
                       </div>
                       <div className="bg-white/20 px-3 py-1.5 rounded-xl text-xs font-bold backdrop-blur-md uppercase tracking-wide">
                        {formatNumber(currentPath[currentPath.length-1]?.speed || 0, 1)} km/h
                       </div>
                    </div>
                    <Button 
                      variant="danger" 
                      className="w-full mt-4 !bg-white !text-rose-600 font-black py-4 rounded-2xl shadow-lg active:scale-95" 
                      onClick={stopTracking}
                      isLoading={isAnalyzing}
                    >
                      <Square size={20} className="mr-2 fill-current" /> Finish Trip
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-6">
                    <p className="text-slate-400 text-sm leading-relaxed">Let MotoLog calculate your expenses automatically based on your riding style and distance.</p>
                    <div className="grid grid-cols-1 gap-3">
                       <div className="space-y-1.5">
                          <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Vehicle Type</label>
                          <select 
                            className="w-full bg-slate-800 border-none rounded-xl p-3.5 text-white font-medium focus:ring-2 focus:ring-indigo-500 appearance-none"
                            value={motorcycleType}
                            onChange={(e) => setMotorcycleType(e.target.value as MotorcycleType)}
                          >
                            <option value="Commuter">Commuter (Daily)</option>
                            <option value="Scooter">Scooter / Automatic</option>
                            <option value="Sport">Sport / High Performance</option>
                            <option value="Cruiser">Cruiser / Touring</option>
                          </select>
                       </div>
                    </div>
                    <Button 
                      className="w-full py-4 rounded-2xl !bg-indigo-600 font-black shadow-lg shadow-indigo-500/20 active:scale-95 transition-all" 
                      onClick={startTracking}
                    >
                      <Play size={20} className="mr-2 fill-current" /> Start Tracking
                    </Button>
                  </div>
                )}
              </div>
              {/* Decorative elements */}
              <div className="absolute top-0 right-0 w-64 h-64 -mr-12 -mt-12 bg-white/5 rounded-full blur-3xl pointer-events-none"></div>
            </div>

            {/* Sub-dash for Maintenance */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-white rounded-3xl border border-slate-200 p-5 shadow-sm">
                <h4 className="font-bold text-slate-900 mb-4 flex items-center gap-2">
                  <Wrench size={18} className="text-indigo-600" />
                  Garage Status
                </h4>
                <div className="space-y-4">
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-slate-500 font-medium">Logged Maintenance</span>
                    <span className="font-black text-slate-900">{formatCurrency(totalMaintLogged)}</span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-slate-500 font-medium">Estimated Wear</span>
                    <span className="font-black text-slate-900">{formatCurrency(totalMaintEstimated)}</span>
                  </div>
                  <Button variant="secondary" size="sm" className="w-full rounded-xl" onClick={() => setActiveTab('garage')}>
                    Go to Garage
                  </Button>
                </div>
              </div>

              <div className="bg-white rounded-3xl border border-slate-200 p-5 shadow-sm flex flex-col justify-between">
                <div>
                  <h4 className="font-bold text-slate-900 mb-1 flex items-center gap-2">
                    <History size={18} className="text-emerald-500" />
                    Last Trip
                  </h4>
                  {rides.length > 0 ? (
                    <p className="text-xs text-slate-500 font-medium mb-4">
                      {rides[0].distanceKm.toFixed(1)} km to {rides[0].placesVisited[0] || 'Unknown'}
                    </p>
                  ) : (
                    <p className="text-xs text-slate-500 font-medium mb-4">No trips yet</p>
                  )}
                </div>
                <Button variant="secondary" size="sm" className="w-full rounded-xl" onClick={() => setActiveTab('history')}>
                  Full History
                </Button>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'history' && (
          <div className="space-y-4 animate-in fade-in slide-in-from-right-2 duration-300">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-2xl font-black text-slate-900 tracking-tight">Trip History</h2>
              <p className="text-xs font-bold text-slate-400 uppercase">{rides.length.toLocaleString()} Recorded</p>
            </div>
            {rides.length === 0 ? (
              <div className="text-center py-20 bg-white rounded-3xl border border-dashed border-slate-300 shadow-inner">
                <History size={48} className="mx-auto mb-4 text-slate-200" />
                <p className="text-slate-500 font-medium">Your journey starts here.</p>
                <Button variant="secondary" className="mt-6 rounded-2xl font-bold" onClick={() => setActiveTab('dashboard')}>Begin First Ride</Button>
              </div>
            ) : (
              <div className="space-y-4">
                {rides.map(ride => (
                  <div key={ride.id} className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm hover:shadow-md transition-all duration-300 group">
                    <div className="p-6">
                      <div className="flex justify-between items-start mb-5">
                        <div className="flex items-center gap-3">
                           <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-600">
                              <CalendarIcon date={ride.startTime} />
                           </div>
                           <div>
                              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">
                                {new Date(ride.startTime).toLocaleDateString(undefined, { weekday: 'long' })}
                              </p>
                              <div className="flex items-center gap-2">
                                <h3 className="text-xl font-black text-slate-900 tracking-tighter">{formatNumber(ride.distanceKm, 2)} km</h3>
                                <span className="text-slate-300 text-lg">|</span>
                                <div className="flex items-center gap-1 text-slate-500 bg-slate-100 px-2 py-0.5 rounded-lg">
                                  <Clock size={12} className="text-slate-400" />
                                  <span className="text-[11px] font-bold">{formatDuration(ride.durationMs)}</span>
                                </div>
                              </div>
                           </div>
                        </div>
                        <button onClick={(e) => { e.stopPropagation(); deleteRide(ride.id); }} className="p-2.5 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-all">
                          <Trash2 size={18} />
                        </button>
                      </div>

                      <div className="grid grid-cols-2 gap-4 mb-5">
                         <div className="bg-slate-50/80 p-4 rounded-2xl border border-slate-100">
                            <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mb-1">Average Speed</p>
                            <p className="font-black text-slate-700">{formatNumber(ride.avgSpeedKmh, 1)} <span className="text-xs font-normal">km/h</span></p>
                         </div>
                         <div className="bg-emerald-50/50 p-4 rounded-2xl border border-emerald-100">
                            <p className="text-[10px] text-emerald-600/60 font-black uppercase tracking-widest mb-1">Cost Estimate</p>
                            <p className="font-black text-emerald-700">{formatCurrency(ride.estimatedFuelCost + ride.estimatedMaintenanceCost)}</p>
                         </div>
                      </div>

                      {ride.placesVisited.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mb-4">
                          {ride.placesVisited.map((p, idx) => (
                            <span key={idx} className="bg-indigo-50 text-indigo-700 text-[9px] font-black px-2.5 py-1.5 rounded-lg uppercase tracking-wider border border-indigo-100">
                              {p}
                            </span>
                          ))}
                        </div>
                      )}

                      {ride.notes && (
                        <div className="bg-amber-50/50 p-3 rounded-xl border border-amber-100 mb-5 flex gap-2">
                          <FileText size={14} className="text-amber-600 shrink-0 mt-0.5" />
                          <p className="text-xs text-amber-900 italic leading-relaxed">{ride.notes}</p>
                        </div>
                      )}

                      <div className="flex items-center gap-6 pt-5 border-t border-slate-100">
                        <div className="flex items-center gap-2 group-hover:translate-x-1 transition-transform">
                          <Fuel size={16} className="text-indigo-500" />
                          <div className="leading-none">
                            <p className="text-[8px] text-slate-400 font-black uppercase tracking-widest mb-0.5">Fuel</p>
                            <p className="text-sm font-bold text-slate-600">{formatCurrency(ride.estimatedFuelCost)}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 group-hover:translate-x-1 transition-transform delay-75">
                          <Wrench size={16} className="text-amber-500" />
                          <div className="leading-none">
                            <p className="text-[8px] text-slate-400 font-black uppercase tracking-widest mb-0.5">Service</p>
                            <p className="text-sm font-bold text-slate-600">{formatCurrency(ride.estimatedMaintenanceCost)}</p>
                          </div>
                        </div>
                        <div className="ml-auto text-right">
                            <p className="text-[8px] text-slate-400 font-black uppercase tracking-widest mb-0.5">Logged</p>
                            <p className="text-xs font-bold text-slate-500">{new Date(ride.startTime).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'garage' && (
          <div className="space-y-6 animate-in fade-in slide-in-from-right-2 duration-300">
            <div className="flex items-center justify-between px-1">
              <div>
                <h2 className="text-2xl font-black text-slate-900 tracking-tight">The Garage</h2>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Scheduled Maintenance Logs</p>
              </div>
              <Button onClick={() => setShowAddMaintenance(true)} className="rounded-2xl !p-3 bg-indigo-600 text-white shadow-lg shadow-indigo-200">
                <Plus size={24} />
              </Button>
            </div>

            <div className="bg-indigo-600 rounded-3xl p-6 text-white shadow-xl shadow-indigo-100">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-70 mb-1">Total Service Spend</p>
              <h3 className="text-4xl font-black tracking-tighter">{formatCurrency(totalMaintLogged)}</h3>
              <div className="mt-4 flex gap-3 overflow-x-auto pb-1 no-scrollbar">
                {['Oil Change', 'Tires', 'Brakes', 'Service'].map(type => {
                  const typeTotal = maintenanceRecords.filter(m => m.type === type).reduce((acc, m) => acc + m.cost, 0);
                  if (typeTotal === 0) return null;
                  return (
                    <div key={type} className="bg-white/10 backdrop-blur-md px-3 py-2 rounded-xl shrink-0">
                      <p className="text-[8px] font-black uppercase tracking-widest opacity-60">{type}</p>
                      <p className="text-xs font-bold">{formatCurrency(typeTotal)}</p>
                    </div>
                  );
                })}
              </div>
            </div>

            {maintenanceRecords.length === 0 ? (
              <div className="text-center py-20 bg-white rounded-3xl border border-dashed border-slate-300">
                <Wrench size={48} className="mx-auto mb-4 text-slate-200" />
                <p className="text-slate-500 font-medium">No service records found.</p>
                <Button variant="secondary" className="mt-6 rounded-2xl font-bold" onClick={() => setShowAddMaintenance(true)}>Log Your First Service</Button>
              </div>
            ) : (
              <div className="space-y-4">
                {maintenanceRecords.map(record => (
                  <div key={record.id} className="bg-white rounded-3xl border border-slate-200 p-5 flex items-start gap-4 shadow-sm group">
                    <div className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center shrink-0 border border-slate-100">
                      {getMaintIcon(record.type)}
                    </div>
                    <div className="flex-1">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{record.type}</p>
                          <h4 className="font-black text-slate-900 tracking-tight">{formatCurrency(record.cost)}</h4>
                        </div>
                        <button onClick={() => deleteMaintenance(record.id)} className="p-2 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-all">
                          <Trash2 size={16} />
                        </button>
                      </div>
                      <div className="mt-3 space-y-2">
                        <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
                          <Calendar size={12} />
                          {new Date(record.date).toLocaleDateString(undefined, { dateStyle: 'long' })}
                        </div>
                        {record.description && (
                          <p className="text-xs text-slate-600 leading-relaxed bg-slate-50 p-2.5 rounded-xl">
                            {record.description}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="space-y-6 animate-in fade-in slide-in-from-left-2 duration-300">
             <h2 className="text-2xl font-black text-slate-900 tracking-tight px-1">Settings</h2>
             
             {/* Regional Settings */}
             <section className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm">
                <div className="p-5 border-b border-slate-100 bg-slate-50/50 flex items-center gap-2">
                  <Globe size={18} className="text-indigo-600" />
                  <h3 className="font-bold text-slate-900">Localization</h3>
                </div>
                <div className="p-6 space-y-6">
                  <div className="space-y-2">
                    <label className="text-xs font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                      <Coins size={14} /> Currency Preference
                    </label>
                    <div className="grid grid-cols-1 gap-2">
                       <select 
                        className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 text-slate-900 font-bold focus:ring-2 focus:ring-indigo-500 appearance-none shadow-sm"
                        value={currencyCode}
                        onChange={(e) => setCurrencyCode(e.target.value)}
                      >
                        {CURRENCIES.map(c => (
                          <option key={c.code} value={c.code}>{c.name} ({c.symbol})</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                      <Fuel size={14} /> Fuel Price (Per Liter)
                    </label>
                    <div className="relative">
                      <div className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-slate-400">{currency.symbol}</div>
                      <input 
                        type="number"
                        step="0.01"
                        className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 pl-10 text-slate-900 font-black focus:ring-2 focus:ring-indigo-500 shadow-sm"
                        value={fuelPrice}
                        onChange={(e) => setFuelPrice(parseFloat(e.target.value) || 0)}
                      />
                    </div>
                    <p className="text-[10px] text-slate-400 font-medium">Used to automatically calculate expenses based on your region's fuel costs.</p>
                  </div>
                </div>
             </section>

             <section className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm">
                <div className="p-5 border-b border-slate-100 bg-slate-50/50 flex items-center gap-2">
                  <Navigation size={18} className="text-indigo-600" />
                  <h3 className="font-bold text-slate-900">Vehicle Profile</h3>
                </div>
                <div className="p-6 space-y-4">
                  <div className="space-y-2">
                    <label className="text-xs font-black text-slate-500 uppercase tracking-widest">Motorcycle Class</label>
                    <select 
                      className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 text-slate-900 font-bold focus:ring-2 focus:ring-indigo-500 appearance-none shadow-sm"
                      value={motorcycleType}
                      onChange={(e) => setMotorcycleType(e.target.value as MotorcycleType)}
                    >
                      <option value="Commuter">Commuter (110cc-150cc)</option>
                      <option value="Scooter">Scooter / Automatic</option>
                      <option value="Sport">Sport / Superbike (250cc+)</option>
                      <option value="Cruiser">Cruiser / Touring</option>
                    </select>
                  </div>
                </div>
             </section>

             <section className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm">
                <div className="p-5 border-b border-slate-100 bg-slate-50/50 flex items-center gap-2">
                  <Trash2 size={18} className="text-rose-500" />
                  <h3 className="font-bold text-slate-900">Data & Privacy</h3>
                </div>
                <div className="p-6">
                   <div className="flex items-center justify-between bg-rose-50/50 p-4 rounded-2xl border border-rose-100">
                     <div>
                       <p className="font-black text-rose-900 uppercase text-xs tracking-wider">Danger Zone</p>
                       <p className="text-[10px] text-rose-700 font-bold">{rides.length.toLocaleString()} trips saved locally</p>
                     </div>
                     <Button 
                       variant="danger" 
                       size="sm" 
                       className="rounded-xl px-4 py-2 font-black text-[10px] uppercase tracking-widest"
                       onClick={() => {
                         if(confirm("Permanently wipe all ride history? This cannot be undone.")) {
                           setRides([]);
                           setMaintenanceRecords([]);
                           localStorage.removeItem('motolog_rides');
                           localStorage.removeItem('motolog_maintenance');
                         }
                       }}
                      >
                       Erase All
                     </Button>
                   </div>
                </div>
             </section>
          </div>
        )}
      </main>

      {/* Modals */}

      {/* Add Maintenance Modal */}
      {showAddMaintenance && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden animate-in slide-in-from-bottom-8 duration-500">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
               <h2 className="text-xl font-black text-slate-900">Log Service</h2>
               <button onClick={() => setShowAddMaintenance(false)} className="p-2 text-slate-400 hover:text-slate-600">
                 <X size={24} />
               </button>
            </div>
            
            <div className="p-6 space-y-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Service Type</label>
                <select 
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 text-slate-900 font-bold"
                  value={maintForm.type}
                  onChange={(e) => setMaintForm(prev => ({ ...prev, type: e.target.value as any }))}
                >
                  <option>Oil Change</option>
                  <option>Tires</option>
                  <option>Brakes</option>
                  <option>Service</option>
                  <option>Other</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Cost ({currency.symbol})</label>
                  <input 
                    type="number"
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 text-slate-900 font-bold"
                    value={maintForm.cost}
                    onChange={(e) => setMaintForm(prev => ({ ...prev, cost: parseFloat(e.target.value) || 0 }))}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Date</label>
                  <input 
                    type="date"
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 text-slate-900 font-bold"
                    value={new Date(maintForm.date).toISOString().split('T')[0]}
                    onChange={(e) => setMaintForm(prev => ({ ...prev, date: new Date(e.target.value).getTime() }))}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Description</label>
                <textarea 
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 text-slate-900 font-medium min-h-[80px]"
                  placeholder="Details of the work done..."
                  value={maintForm.description}
                  onChange={(e) => setMaintForm(prev => ({ ...prev, description: e.target.value }))}
                />
              </div>

              <Button variant="primary" className="w-full py-4 font-black rounded-2xl" onClick={addMaintenanceRecord}>
                Save to Garage
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Post-Ride Note Modal */}
      {pendingRide && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden animate-in slide-in-from-bottom-8 duration-500">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
               <div>
                 <h2 className="text-xl font-black text-slate-900">Ride Summary</h2>
                 <p className="text-xs font-bold text-indigo-600 uppercase tracking-widest">{formatNumber(pendingRide.distanceKm, 2)} KM Trip</p>
               </div>
               <button onClick={() => setPendingRide(null)} className="p-2 text-slate-400 hover:text-slate-600 transition-colors">
                 <X size={24} />
               </button>
            </div>
            
            <div className="p-6 space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1 text-center bg-slate-50 p-4 rounded-2xl">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Total Cost</p>
                  <p className="text-xl font-black text-emerald-600">{formatCurrency(pendingRide.estimatedFuelCost + pendingRide.estimatedMaintenanceCost)}</p>
                </div>
                <div className="space-y-1 text-center bg-slate-50 p-4 rounded-2xl">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Duration</p>
                  <p className="text-xl font-black text-slate-900">{formatDuration(pendingRide.durationMs)}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1 text-center bg-slate-50 p-3 rounded-2xl">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Avg Speed</p>
                  <p className="text-lg font-black text-slate-700">{formatNumber(pendingRide.avgSpeedKmh, 1)} <span className="text-xs">km/h</span></p>
                </div>
                <div className="space-y-1 text-center bg-slate-50 p-3 rounded-2xl">
                   <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Distance</p>
                   <p className="text-lg font-black text-slate-700">{formatNumber(pendingRide.distanceKm, 1)} <span className="text-xs">km</span></p>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                  <FileText size={14} /> Add Ride Notes
                </label>
                <textarea 
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 text-slate-900 font-medium focus:ring-2 focus:ring-indigo-500 shadow-sm min-h-[100px] outline-none"
                  placeholder="Where did you go? Any specific events? (Optional)"
                  value={noteInput}
                  onChange={(e) => setNoteInput(e.target.value)}
                />
              </div>

              <div className="flex gap-3 pt-2">
                <Button variant="secondary" className="flex-1 py-4 font-bold rounded-2xl" onClick={() => setPendingRide(null)}>
                  Discard
                </Button>
                <Button variant="primary" className="flex-[2] py-4 font-black rounded-2xl shadow-lg shadow-indigo-500/20" onClick={savePendingRide}>
                  Save Ride Log
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-xl border-t border-slate-200 px-6 py-4 pb-8 z-40 shadow-[0_-8px_30px_rgba(0,0,0,0.08)]">
        <div className="max-w-md mx-auto flex items-center justify-between">
          <button 
            onClick={() => setActiveTab('dashboard')}
            className={`flex flex-col items-center gap-1.5 transition-all active:scale-90 ${activeTab === 'dashboard' ? 'text-indigo-600' : 'text-slate-300 hover:text-slate-500'}`}
          >
            <LayoutDashboard size={24} strokeWidth={activeTab === 'dashboard' ? 2.5 : 2} />
            <span className="text-[8px] font-black uppercase tracking-widest leading-none">Home</span>
          </button>

          <button 
            onClick={() => setActiveTab('garage')}
            className={`flex flex-col items-center gap-1.5 transition-all active:scale-90 ${activeTab === 'garage' ? 'text-indigo-600' : 'text-slate-300 hover:text-slate-500'}`}
          >
            <Wrench size={24} strokeWidth={activeTab === 'garage' ? 2.5 : 2} />
            <span className="text-[8px] font-black uppercase tracking-widest leading-none">Garage</span>
          </button>
          
          <div className="relative -top-10">
            <button 
              onClick={() => {
                if(isTracking) stopTracking(); else startTracking();
              }}
              className={`w-14 h-14 rounded-[22px] flex items-center justify-center shadow-xl shadow-indigo-600/30 transition-all active:scale-95 hover:shadow-2xl ${isTracking ? 'bg-rose-500 text-white animate-pulse' : 'bg-indigo-600 text-white'}`}
            >
              {isTracking ? <Square size={24} className="fill-current" /> : <Plus size={28} strokeWidth={2.5} />}
            </button>
          </div>

          <button 
            onClick={() => setActiveTab('history')}
            className={`flex flex-col items-center gap-1.5 transition-all active:scale-90 ${activeTab === 'history' ? 'text-indigo-600' : 'text-slate-300 hover:text-slate-500'}`}
          >
            <History size={24} strokeWidth={activeTab === 'history' ? 2.5 : 2} />
            <span className="text-[8px] font-black uppercase tracking-widest leading-none">Trips</span>
          </button>

          <button 
            onClick={() => setActiveTab('settings')}
            className={`flex flex-col items-center gap-1.5 transition-all active:scale-90 ${activeTab === 'settings' ? 'text-indigo-600' : 'text-slate-300 hover:text-slate-500'}`}
          >
            <Settings size={24} strokeWidth={activeTab === 'settings' ? 2.5 : 2} />
            <span className="text-[8px] font-black uppercase tracking-widest leading-none">Config</span>
          </button>
        </div>
      </nav>
    </div>
  );
};

// Helper component for the date icon in list
const CalendarIcon: React.FC<{ date: number }> = ({ date }) => {
  const d = new Date(date);
  const month = d.toLocaleDateString(undefined, { month: 'short' });
  const day = d.getDate();
  return (
    <div className="flex flex-col items-center justify-center leading-none">
      <span className="text-[8px] font-black uppercase tracking-tighter mb-0.5 text-slate-400">{month}</span>
      <span className="text-base font-black tracking-tighter text-indigo-600">{day.toLocaleString()}</span>
    </div>
  );
};

export default App;
