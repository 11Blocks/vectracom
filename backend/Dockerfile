# VECTRACOM backend
FROM node:20-alpine AS build
WORKDIR /app
COPY package.json ./
# Need @types/* (devDependencies) for tsc
RUN npm install
COPY . .
RUN npx tsc -p tsconfig.json

FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY package.json ./
RUN npm install --omit=dev
COPY --from=build /app/dist ./dist
EXPOSE 3000
CMD ["node", "dist/src/main.js"]
