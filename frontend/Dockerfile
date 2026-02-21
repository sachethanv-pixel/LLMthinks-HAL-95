# Frontend Dockerfile — uses pre-built React output (build/ is committed to git)
# Build locally with: REACT_APP_API_URL=<url> npm run build
FROM nginx:alpine

# Copy pre-built React app
COPY build /usr/share/nginx/html

# Nginx config (handles React Router)
COPY nginx.conf /etc/nginx/nginx.conf

EXPOSE 8080
CMD ["nginx", "-g", "daemon off;"]
