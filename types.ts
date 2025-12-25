
export type MotorcycleType = 'Scooter' | 'Sport' | 'Cruiser' | 'Commuter';

export interface LocationPoint {
  lat: number;
  lng: number;
  timestamp: number;
  speed: number | null;
}

export interface Ride {
  id: string;
  startTime: number;
  endTime: number;
  durationMs: number;
  distanceKm: number;
  avgSpeedKmh: number;
  path: LocationPoint[];
  motorcycleType: MotorcycleType;
  estimatedFuelCost: number;
  estimatedMaintenanceCost: number;
  placesVisited: string[];
  notes?: string;
}

export interface MaintenanceRecord {
  id: string;
  date: number;
  type: 'Oil Change' | 'Tires' | 'Brakes' | 'Service' | 'Other';
  cost: number;
  description: string;
}

export interface ExpenseSummary {
  totalDistance: number;
  totalFuelCost: number;
  totalMaintenanceCost: number;
  averageSpeed: number;
}
