# Use an official Node.js runtime as the base image
FROM node:18-alpine

# Set the working directory in the container
WORKDIR /app

# Copy package.json and yarn.lock files
COPY package.json yarn.lock ./

# Install dependencies
RUN npm install --force

# Copy the rest of the application code
COPY . .

# Create a data directory for CSV files
RUN mkdir -p /app/data

# Build the Next.js application
RUN npm run build --force

# Expose the port the app runs on
EXPOSE 3000

# Start the application
CMD ["yarn", "start"]