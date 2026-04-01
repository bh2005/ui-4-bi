# ── Stage 1: Frontend via nginx ───────────────────────────────────────────
FROM nginx:1.27-alpine AS frontend
COPY src/ /usr/share/nginx/html/
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
