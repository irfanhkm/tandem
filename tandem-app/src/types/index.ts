// User types
export interface User {
  id: string;
  email: string;
  name: string;
  avatar_url?: string;
  role: 'USER' | 'ADMIN';
  created_at: string;
  last_login?: string;
}

// Resource types
export interface Resource {
  id: string;
  name: string;
  labels?: string;
  created_at: string;
  updated_at: string;
  current_booking?: Booking;
  status: 'FREE' | 'LOCKED';
}

// Booking types
export interface Booking {
  id: string;
  resource_id: string;
  user_id: string;
  branch: string;
  notes?: string;
  build_link?: string;
  expires_at: string;
  created_at: string;
  released_at?: string;
  user?: User;
  resource?: Resource;
}

// Booking History types
export type BookingAction = 'BOOK' | 'EXTEND' | 'RELEASE' | 'EXPIRED' | 'EDIT';

export interface BookingHistory {
  id: string;
  booking_id?: string;
  action: BookingAction;
  resource_id: string;
  user_id: string;
  branch: string;
  notes?: string;
  build_link?: string;
  expires_at: string;
  released_at?: string;
  timestamp: string;
}

// Form types
export interface BookingFormData {
  resource_id: string;
  branch: string;
  notes?: string;
  build_link?: string;
  expires_at: Date;
}

export interface ResourceFormData {
  name: string;
  labels?: string;
}
