# Imagen para ejecutar la coleccion de Postman con Newman.
#
# La imagen oficial ya trae newman; solo se agrega el reporter HTML
# (htmlextra), que es el que produce el reporte legible para la entrega.
FROM postman/newman:alpine

RUN npm install -g newman-reporter-htmlextra

WORKDIR /etc/newman
