# syntax=docker.io/docker/dockerfile:1.14-labs

FROM node:22-bullseye AS builder

# Set working directory
WORKDIR /src

# NOTE: You need a directory called ssh-keys with the correct ssh keys: id_rsa and known_hosts" && exit 1; fi

# Set up SSH for private repo access (if needed)
RUN mkdir -p /root/.ssh/
COPY ssh-keys/id_rsa /root/.ssh/id_rsa
RUN chmod 600 /root/.ssh/id_rsa

# Copy package.json and package-lock.json (if any)
COPY package*.json ./

# Install dependencies
RUN yarn install

# Copy the rest of the app code
COPY . .

# Expose the app port
EXPOSE 8008

# Start the app
CMD ["yarn", "start"]