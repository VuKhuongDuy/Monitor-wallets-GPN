# Use Node.js LTS image
FROM node:18

# Create app directory
WORKDIR /usr/src/app

# Copy package.json and install dependencies
# COPY package*.json ./
# RUN npm i

# Copy the app source code
COPY . .

# Expose port and run the app
EXPOSE 8080
CMD ["npx", "ts-node", "src/server.ts"]