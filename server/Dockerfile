FROM node:22-alpine

WORKDIR /app

# Install wget for healthcheck
RUN apk add --no-cache wget

# Install production dependencies
COPY package*.json ./
RUN npm ci --omit=dev

# Copy server source
COPY server.js ./
COPY db.js ./
COPY auth.js ./
COPY middleware ./middleware/
COPY routes ./routes/
RUN mkdir -p data

EXPOSE 3456

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3456

CMD ["node", "server.js"]
