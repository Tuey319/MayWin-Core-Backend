# syntax=docker/dockerfile:1

# ---------- build stage ----------
FROM node:20-alpine AS build
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# ---------- runtime stage ----------
FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production

# install only production deps
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

# copy compiled output
COPY --from=build /app/dist ./dist

# if you have any runtime assets (views, templates, etc.), copy them too:
# COPY --from=build /app/public ./public

EXPOSE 3000
CMD ["node", "dist/main.js"]
