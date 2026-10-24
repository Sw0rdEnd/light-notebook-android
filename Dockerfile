FROM node:24-bookworm-slim AS web
WORKDIR /build
COPY app/src/main/assets/www ./app/src/main/assets/www
COPY scripts/build-server-web.mjs ./scripts/build-server-web.mjs
COPY web/console ./web/console
RUN node scripts/build-server-web.mjs

FROM node:24-bookworm-slim
LABEL org.light-notebook.server-schema="1"
WORKDIR /app
ENV NODE_ENV=production HOST=0.0.0.0 PORT=8080 DATA_DIR=/app/data STATIC_DIR=/app/dist NODE_OPTIONS=--max-old-space-size=512
COPY --from=web /build/dist ./dist
COPY server ./server
RUN mkdir -p /app/data && chown node:node /app/data
USER node
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 CMD node -e "fetch('http://127.0.0.1:8080/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node","server/index.mjs"]
