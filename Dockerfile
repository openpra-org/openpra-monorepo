FROM node:gallium-alpine as BUILDER

ENV NODE_ENV=dev
ENV JWT_SECRET_KEY=change-me
ENV MONGO_URL=mongodb://localhost:27017

EXPOSE 8000

WORKDIR /usr/app
COPY package.json .
RUN pnpm install

COPY . .

RUN pnpm run build --verbose

ENTRYPOINT ["pnpm"]
