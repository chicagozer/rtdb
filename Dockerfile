# DOCKER-VERSION 1.2.0
FROM    centos:latest

# Enable EPEL for Node.js
RUN     yum install -y epel-release
# Install Node.js and npm
RUN     yum install -y npm

# Bundle app source
COPY . /rtdb
WORKDIR /rtdb
# Install app dependencies
RUN npm install

EXPOSE 9001
CMD ["npm", "start"]
