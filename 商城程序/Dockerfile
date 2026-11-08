FROM node:24-bookworm-slim

WORKDIR /app
COPY --chown=node:node . .
RUN mkdir -p /home/data && chown -R node:node /home/data

ENV NODE_ENV=production \
    YUEXUAN_HOST=0.0.0.0 \
    YUEXUAN_PORT=8787 \
    YUEXUAN_DB_PATH=/home/data/yuexuan.db

USER node
EXPOSE 8787
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 CMD node -e "fetch('http://127.0.0.1:8787/api/health').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"
CMD ["node", "server.js"]
