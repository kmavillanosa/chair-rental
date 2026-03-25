FROM node:18-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
ARG VITE_VENDOR_DOMAIN=rentalbasic.com
ARG VITE_API_URL=
ARG VITE_VENDOR_LOGIN_URL=
ARG VITE_STAFF_APP_URL=
ENV VITE_VENDOR_DOMAIN=$VITE_VENDOR_DOMAIN
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_VENDOR_LOGIN_URL=$VITE_VENDOR_LOGIN_URL
ENV VITE_STAFF_APP_URL=$VITE_STAFF_APP_URL
RUN npm run build

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
