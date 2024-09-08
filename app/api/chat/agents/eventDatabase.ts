import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

export async function getAvailableEvents() {
  return prisma.eventAndShow.findMany({
    where: {
      start_date: { lte: new Date() },
      end_date: { gte: new Date() },
    },
    orderBy: {
      start_date: "asc",
    },
  });
}

export async function checkEventAvailability(event_id: number) {
  const event = await prisma.eventAndShow.findUnique({
    where: { event_id },
  });

  if (!event) {
    throw new Error("Event not found");
  }

  const totalTickets = await prisma.ticket.count({
    where: { event_id },
  });

  const availableTickets = event.capacity - totalTickets;
  return {
    available: availableTickets > 0,
    message:
      availableTickets > 0
        ? `${availableTickets} tickets are available.`
        : "No tickets available.",
    availableTickets,
  };
}

export async function bookTickets(data: {
  user_id: number;
  event_id: number;
  visit_date: string;
  quantity: number;
  ticket_type: string;
}) {
  const { user_id, event_id, visit_date, quantity, ticket_type } = data;

  const event = await prisma.eventAndShow.findUnique({ where: { event_id } });
  if (!event) throw new Error("Event not found");

  const totalTickets = await prisma.ticket.count({ where: { event_id } });

  if (totalTickets + quantity > event.capacity) {
    throw new Error("Not enough capacity available");
  }

  const tickets = await prisma.ticket.createMany({
    data: Array(quantity).fill({
      user_id,
      event_id,
      visit_date: new Date(visit_date),
      ticket_type,
    }),
  });

  return tickets;
}

export async function cancelBooking(ticket_id: number) {
  const ticket = await prisma.ticket.delete({
    where: { ticket_id },
  });

  return ticket;
}

export async function getUserBookings(user_id: number) {
  return prisma.ticket.findMany({
    where: { user_id },
    include: {
      event: true,
    },
  });
}

export async function registerUser(data: {
  name: string;
  email: string;
  phone_number: string;
}) {
  const user = await prisma.user.create({
    data,
  });

  return user;
}

export async function getEventDetails(event_id: number) {
  const event = await prisma.eventAndShow.findUnique({
    where: { event_id },
  });

  if (!event) {
    throw new Error("Event not found");
  }

  return event;
}
