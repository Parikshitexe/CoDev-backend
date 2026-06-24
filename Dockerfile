# Start with a lightweight Linux base that has Node.js installed
FROM node:18-alpine

# Install Python3, G++ (for C++), and OpenJDK (for Java)
RUN apk add --no-cache \
    python3 \
    g++ \
    openjdk11 \
    bash

# Set the working directory inside the container
WORKDIR /usr/src/app

# The container doesn't need to start a server, it just needs to sit ready to execute commands.
# We will pass the execution commands dynamically when we spin it up.
CMD ["sh"]
