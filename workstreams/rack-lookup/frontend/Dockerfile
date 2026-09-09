# Multi-stage build: compile the Vite app, then serve the static output
# with nginx. The React/Vite toolchain never needs to exist in the final
# image — just the built HTML/JS/CSS.

FROM node:20-alpine AS build
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install
COPY . .
# VITE_API_BASE_URL must be set at BUILD time (not runtime) since Vite
# inlines env vars into the static bundle. Pass it as a Docker build
# arg pointing at wherever the backend will actually be reachable.
ARG VITE_API_BASE_URL=http://localhost:3001
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
