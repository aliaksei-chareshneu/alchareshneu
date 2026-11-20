FROM node:22-alpine
ENV NODE_ENV=production
WORKDIR /app
COPY server.mjs /app/server.mjs
USER node
EXPOSE 8080
CMD ["node", "/app/server.mjs"]
