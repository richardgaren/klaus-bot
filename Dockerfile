FROM node:20-alpine
WORKDIR /app
COPY package.json .
RUN npm install
COPY bot.js .
COPY klaus-core.js .
RUN mkdir -p /app/data
CMD ["node", "bot.js"]
