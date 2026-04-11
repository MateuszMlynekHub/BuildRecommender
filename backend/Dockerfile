# syntax=docker/dockerfile:1.7
#
# Multi-stage build for LoLBuildRecommender.Api
#
# Stage 1 (build):    .NET 9 SDK compiles and publishes the app. Fat image but we
#                     throw it away in the final layer.
# Stage 2 (runtime):  aspnet:9.0-alpine (≈90 MB) runs the published output. Non-root
#                     user, readonly app dir, writable /app/data for the SQLite
#                     build-stats database (mounted as a volume in docker-compose).
#
# Build from the repo root so the .csproj ProjectReference paths resolve:
#   docker build -f backend/Dockerfile -t lolbuild-api:latest backend/
#
# ---------- Stage 1: build ----------
FROM mcr.microsoft.com/dotnet/sdk:9.0 AS build
WORKDIR /src

# Copy only .csproj files first so `dotnet restore` can cache NuGet packages
# independently of source changes. This is the standard .NET layer-caching trick
# — editing C# code won't bust the restore layer unless a .csproj changes.
COPY LoLBuildRecommender/LoLBuildRecommender.sln ./LoLBuildRecommender/
COPY LoLBuildRecommender/LoLBuildRecommender.Api/LoLBuildRecommender.Api.csproj ./LoLBuildRecommender/LoLBuildRecommender.Api/
COPY LoLBuildRecommender/LoLBuildRecommender.Core/LoLBuildRecommender.Core.csproj ./LoLBuildRecommender/LoLBuildRecommender.Core/
COPY LoLBuildRecommender/LoLBuildRecommender.Infrastructure/LoLBuildRecommender.Infrastructure.csproj ./LoLBuildRecommender/LoLBuildRecommender.Infrastructure/

RUN dotnet restore LoLBuildRecommender/LoLBuildRecommender.Api/LoLBuildRecommender.Api.csproj

# Now copy the rest of the source and publish. Restore layer is already cached
# from above so this step only compiles + emits, it doesn't re-download packages.
COPY LoLBuildRecommender/ ./LoLBuildRecommender/

RUN dotnet publish LoLBuildRecommender/LoLBuildRecommender.Api/LoLBuildRecommender.Api.csproj \
    -c Release \
    -o /app/publish \
    --no-restore \
    /p:UseAppHost=false

# ---------- Stage 2: runtime ----------
#
# Using the Debian-based aspnet:9.0 image (≈225 MB) rather than aspnet:9.0-alpine.
# The Alpine image omits ICU (libicu) to save ~40 MB, which breaks .NET whenever
# the app opts into real globalization — we need proper culture-aware string
# handling for Polish, Russian, Ukrainian, German, and Spanish locales, so
# invariant mode is not an option. Debian bookworm-slim ships with libicu and is
# the standard Microsoft-recommended base for .NET in production.
FROM mcr.microsoft.com/dotnet/aspnet:9.0 AS runtime

# Install curl for the HEALTHCHECK. Tiny layer (~2 MB) — apt list is wiped right
# after to keep the final image clean.
RUN apt-get update \
    && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy published output from the build stage.
COPY --from=build /app/publish ./

# Data directory — mounted as a volume in docker-compose. Pre-created here so the
# SQLite EnsureCreated path at startup doesn't hit a "directory not found" error
# on the first boot before the volume is populated. The aspnet:9.0 image defines
# APP_UID=1654 as its non-root runtime user; we chown to match so the volume is
# writable under USER 1654 below.
RUN mkdir -p /app/data && chown -R 1654:1654 /app

USER 1654

# Environment baseline. The production host overrides these via docker-compose env:
#   RiotApi__ApiKey, Cors__AllowedOrigins__0, etc.
# DOTNET_SYSTEM_GLOBALIZATION_INVARIANT is NOT set — the Debian image has ICU
# installed, so the .NET runtime's default culture-aware behavior Just Works.
ENV ASPNETCORE_ENVIRONMENT=Production \
    ASPNETCORE_URLS=http://+:8080 \
    DOTNET_RUNNING_IN_CONTAINER=true

EXPOSE 8080

# Liveness probe hits /health which is a no-dependency check (see Program.cs).
# --start-period gives the app 40 s to warm the Data Dragon + Meraki caches before
# failing counts against us.
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
    CMD curl -fsS http://localhost:8080/health || exit 1

ENTRYPOINT ["dotnet", "LoLBuildRecommender.Api.dll"]
