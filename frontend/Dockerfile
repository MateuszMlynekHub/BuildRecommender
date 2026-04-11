# syntax=docker/dockerfile:1.7
#
# Multi-stage build for the Angular frontend.
#
# Stage 1 (build):    node:20-alpine compiles the Angular app with `ng build
#                     --configuration production`, producing hashed bundles in
#                     dist/lol-build-recommender/browser/.
# Stage 2 (runtime):  nginx:alpine serves the static output and reverse-proxies
#                     /api/* to the backend container over the docker bridge
#                     network.
#
# Build from the repo root:
#   docker build -f frontend/Dockerfile -t lolbuild-web:latest frontend/
#
# ---------- Stage 1: build ----------
FROM node:20-alpine AS build
WORKDIR /src

# Copy only the manifest files first so `npm ci` can cache node_modules
# independently of source changes. Same trick as dotnet restore in the backend.
COPY lol-build-recommender/package.json lol-build-recommender/package-lock.json ./lol-build-recommender/
WORKDIR /src/lol-build-recommender
RUN npm ci --no-audit --no-fund

# Copy the rest of the source and run the production build.
# @angular/build's default config already enables the fileReplacements we set up
# in angular.json so environment.ts → environment.prod.ts happens automatically.
COPY lol-build-recommender/ ./
RUN npx ng build --configuration production

# ---------- Stage 2: runtime ----------
FROM nginx:1.27-alpine AS runtime

# Remove the default placeholder site so our config is the only vhost.
RUN rm /etc/nginx/conf.d/default.conf

# Custom nginx config — serves the Angular bundle + reverse-proxies /api to the
# backend container. See frontend/nginx.conf for the full explanation.
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy only the Angular browser output. Source maps and prerendered-routes.json
# aren't needed for SPA hosting.
COPY --from=build /src/lol-build-recommender/dist/lol-build-recommender/browser /usr/share/nginx/html

# Alpine nginx image already exposes 80 but we name it explicitly for clarity.
EXPOSE 80

# Simple healthcheck — fetching / should always return 200 because of the SPA
# fallback, even when /api is down.
#
# Explicit 127.0.0.1 instead of `localhost`: busybox wget on alpine resolves
# `localhost` to IPv6 ::1 first, but nginx.conf only has `listen 80;` (IPv4),
# so the probe was getting "connection refused" on ::1 and never falling
# back to 127.0.0.1. Hardcoding IPv4 sidesteps the resolver entirely.
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD wget -qO- http://127.0.0.1/ >/dev/null 2>&1 || exit 1

# nginx:alpine's default CMD is already ["nginx", "-g", "daemon off;"] so we
# don't override it.
