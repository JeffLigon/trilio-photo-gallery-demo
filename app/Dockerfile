
FROM node:20-alpine
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install --omit=dev
COPY . .

# OpenShift-friendly permissions: allow random, non-root UID to write
ENV MEDIA_DIR=/data/media
RUN mkdir -p /data/media \
 && chown -R 0:0 /app /data \
 && chmod -R g=u /app /data

EXPOSE 8080
CMD ["npm","start"]
