pm2 kill

git stash

git pull origin main

pm2 start ./src/app.js --name http2

pm2 logs http2
