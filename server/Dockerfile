# Build dependencies
FROM node:18 as builder
WORKDIR /app
COPY . .
RUN npm i
RUN npm run build

# Production image
# FROM node:18-alpine
# WORKDIR /app
# COPY . .
# RUN npm i --only=production
# COPY --from=builder /app/dist ./dist

CMD ["npm", "run", "start"]