FROM node:10

# Project directory
WORKDIR /src/transaction-broadcaster
# Copy files into container
COPY . .

RUN npm i

CMD ["npm", "run", "start"]
