# Build dependencies
FROM node:18 as dependencies
WORKDIR /app
COPY package.json .
RUN npm i
COPY . . 
RUN npm run build
# Build production image
FROM dependencies as builder
EXPOSE 8080
CMD npm run start