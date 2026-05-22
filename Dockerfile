FROM nginx:alpine
# Copia os arquivos estáticos para a pasta servida pelo nginx
COPY index.html /usr/share/nginx/html/index.html
COPY app_krv.js /usr/share/nginx/html/app_krv.js
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
