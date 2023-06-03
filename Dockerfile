# DOCKER-VERSION 1.2.0
#FROM node:argon
#FROM node:17
#FROM public.ecr.aws/bitnami/node:20
FROM node:lts-alpine
#RUN apt-get update; apt-get upgrade
RUN apk update ; apk upgrade --available
# Bundle app source
COPY . /rtdb
WORKDIR /rtdb
# Install app dependencies
RUN npm install

EXPOSE 9001
CMD ["npm", "start"]
