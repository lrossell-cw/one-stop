FROM node:20-alpine

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install --omit=dev

COPY server.js ./

# JIRA_BASE_URL, JIRA_EMAIL, JIRA_API_TOKEN, and field name/id vars are
# intentionally NOT set here — inject them as Kubernetes Secrets / your
# platform's equivalent at deploy time. Never bake credentials into the
# image. See .env.example for the full list of variables.

EXPOSE 3001
CMD ["node", "server.js"]
