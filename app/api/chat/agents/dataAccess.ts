import fs from "fs";
import csv from "csv-parser";
import { User, Event, Booking } from "./types";

// Helper function to read CSV files
function readCSV<T>(filePath: string): Promise<T[]> {
  return new Promise((resolve, reject) => {
    const results: T[] = [];
    fs.createReadStream(filePath)
      .pipe(csv())
      .on("data", (data) => results.push(data as T))
      .on("end", () => resolve(results))
      .on("error", (error) => reject(error));
  });
}

// Helper function to write data to CSV files
function writeCSV<T extends Record<string, unknown>>(
  filePath: string,
  data: T[]
): Promise<void> {
  return new Promise((resolve, reject) => {
    const headers = Object.keys(data[0]).join(",") + "\n";
    const csvData =
      data.map((item) => Object.values(item).join(",")).join("\n") + "\n";
    fs.writeFile(filePath, headers + csvData, (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

// Helper function to append data to CSV files
function appendToCSV(
  filePath: string,
  data: Record<string, unknown>
): Promise<void> {
  return new Promise((resolve, reject) => {
    const csvLine = Object.values(data).join(",") + "\n";
    fs.appendFile(filePath, csvLine, (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

// Helper function to convert an object to a record
function convertToRecord<T>(obj: T): Record<string, unknown> {
  return { ...obj } as Record<string, unknown>;
}

// Read users from users.csv
export const readUsers = () => readCSV<User>("data/users.csv");

// Read events from events.csv
export const readEvents = () => readCSV<Event>("data/events.csv");

// Read bookings from bookings.csv
export const readBookings = () => readCSV<Booking>("data/bookings.csv");

// Append a new user to users.csv
export const appendUser = (user: User) =>
  appendToCSV("data/users.csv", convertToRecord(user));

// Append a new booking to bookings.csv
export const appendBooking = (booking: Booking) =>
  appendToCSV("data/bookings.csv", convertToRecord(booking));

// Write the entire users list to users.csv
export const writeUsers = (users: User[]) =>
  writeCSV("data/users.csv", users.map(convertToRecord));

// Write the entire bookings list to bookings.csv
export const writeBookings = (bookings: Booking[]) =>
  writeCSV("data/bookings.csv", bookings.map(convertToRecord));
