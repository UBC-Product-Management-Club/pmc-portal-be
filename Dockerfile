# Stage 1: Build
FROM node:20-alpine AS build

# Set the working directory
WORKDIR /app

# Install dependencies
COPY package.json package-lock.json ./
RUN npm install

# Copy the rest of the application code
COPY . .

# Build the TypeScript code
RUN npm run build

# Stage 2: Copy Node.js from Alpine
FROM node:20-alpine AS execute

# Copy the built code from the build stage
COPY --from=build /app/build ./build

# Copy the templates directory
COPY --from=build /app/src/templates ./build/src/templates

# Copy package.json and package-lock.json
COPY --from=build /app/package.json ./
COPY --from=build /app/package-lock.json ./

# Copy any other necessary files (e.g., .env)
COPY --from=build /app/.env ./
COPY --from=build /app/.secret ./

# Install only production dependencies
COPY --from=build /app/node_modules ./node_modules

# Set the command to run the application
CMD ["node", "build/src/index.js"]

# Expose the application port
EXPOSE 8000