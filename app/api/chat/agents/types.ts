export interface User {
  user_id: string;
  name: string;
  email: string;
  phone: string;
  address: string;
}

export interface Event {
  id: string;
  title: string;
  type: string;
  history: string;
  poster: string;
  ticket_price: string;
  event_start: string; // Added event start time
  event_end: string; // Added event end time
}

export interface Booking {
  booking_id: string;
  user_id: string;
  event_id: string;
  event_date: string;
  event_time: string;
  total_price: string;
}
