FROM node:22-alpine

# Apply security updates
RUN apk update && apk upgrade --available

# Create app directory
WORKDIR /rtdb

# Install dependencies first to leverage Docker layer caching
COPY package*.json ./
RUN npm ci --omit=dev

# Bundle app source
COPY . .

# Set node environment
ENV NODE_ENV=production

EXPOSE 9001
CMD ["npm", "start"]
