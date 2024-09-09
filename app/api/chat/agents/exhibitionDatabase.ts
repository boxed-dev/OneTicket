import {
  readUsers,
  readEvents,
  readBookings,
  appendUser,
  appendBooking,
  writeUsers,
  writeBookings,
} from "./dataAccess";
import { User, Event, Booking } from "./types";

export async function searchUsers(name: string): Promise<User[]> {
  const users = await readUsers();
  return users.filter((user) =>
    user.name.toLowerCase().includes(name.toLowerCase())
  );
}

export async function createUser(
  userDetails: Omit<User, "user_id">
): Promise<User> {
  const newUser: User = {
    user_id: Math.random().toString(36).substr(2, 9),
    ...userDetails,
  };
  await appendUser(newUser);
  return newUser;
}

export async function getUserBookings(userId: string): Promise<Booking[]> {
  const bookings = await readBookings();
  return bookings.filter((booking) => booking.user_id === userId);
}

export async function searchEvents(params: {
  eventDate: string;
  eventTime?: string;
}): Promise<Event[]> {
  const events = await readEvents();
  const bookings = await readBookings();

  // Check event availability based on the event date and time
  const bookedEventIds = bookings
    .filter(
      (booking) =>
        booking.event_date === params.eventDate &&
        (!params.eventTime || booking.event_time === params.eventTime)
    )
    .map((booking) => booking.event_id);

  return events.filter((event) => !bookedEventIds.includes(event.id));
}

export async function bookEvent(
  bookingDetails: Omit<Booking, "booking_id">
): Promise<Booking> {
  const newBooking: Booking = {
    booking_id: Math.random().toString(36).substr(2, 9),
    ...bookingDetails,
  };
  await appendBooking(newBooking);
  return newBooking;
}

export async function cancelBooking(bookingId: string): Promise<boolean> {
  const bookings = await readBookings();
  const updatedBookings = bookings.filter(
    (booking) => booking.booking_id !== bookingId
  );
  await writeBookings(updatedBookings);
  return true;
}

export async function getEventTypes(): Promise<string[]> {
  const events = await readEvents();
  return Array.from(new Set(events.map((event) => event.type)));
}

export function interpretDate(dateString: string): string {
  // Simplified date interpreter
  const date = new Date(dateString);
  return date.toISOString().split("T")[0];
}

export async function getUserDetails(userId: string): Promise<User | null> {
  const users = await readUsers();
  return users.find((user) => user.user_id === userId) || null;
}

export async function updateUserInfo(
  userId: string,
  updates: Partial<User>
): Promise<User> {
  const users = await readUsers();
  const userIndex = users.findIndex((user) => user.user_id === userId);
  if (userIndex === -1) throw new Error("User not found");

  const updatedUser = { ...users[userIndex], ...updates };
  users[userIndex] = updatedUser;
  await writeUsers(users);
  return updatedUser;
}

export async function getBookingDetails(
  bookingId: string
): Promise<Booking | null> {
  const bookings = await readBookings();
  return bookings.find((booking) => booking.booking_id === bookingId) || null;
}

export async function getEventDetails(eventId: string): Promise<Event | null> {
  const events = await readEvents();
  return events.find((event) => event.id === eventId) || null;
}

export function getTodaysDate(): string {
  const today = new Date();
  return today.toISOString().split("T")[0];
}
