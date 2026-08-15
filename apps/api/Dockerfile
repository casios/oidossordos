FROM node:20-slim
WORKDIR /app
# node:20-slim (Debian bookworm) no trae el paquete openssl; sin él Prisma no
# detecta la versión y cae al engine openssl-1.1.x (libssl.so.1.1 inexistente).
RUN apt-get update -y && apt-get install -y openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*
COPY package*.json ./
RUN npm ci
COPY . .
RUN npx prisma generate
RUN npm run build
CMD ["npm", "run", "start"]
