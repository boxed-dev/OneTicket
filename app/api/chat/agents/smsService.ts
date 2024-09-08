import { Twilio } from "twilio";

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const fromNumber = process.env.TWILIO_PHONE_NUMBER;

const client = new Twilio(accountSid, authToken);

export async function sendSMS(phone_number: string, message: string) {
  return client.messages.create({
    body: message,
    from: fromNumber,
    to: phone_number,
  });
}
