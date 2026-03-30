# Usar una imagen oficial de Node.js ligera para producción
FROM node:18-alpine

# Establecer el directorio de trabajo dentro del contenedor
WORKDIR /usr/src/app

# Copiar los archivos de dependencias primero (Aprovechar el caché de Docker)
COPY package*.json ./

# Instalar las dependencias de producción
RUN npm ci --only=production

# Copiar el resto del código del servidor
COPY . .

# Exponer el puerto en el que corre la API (Express)
EXPOSE 3000

# Comando para iniciar el servidor
CMD [ "npm", "start" ]
