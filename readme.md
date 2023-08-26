# Command to create self signed private key and certicate

# openssl req -x509 -newkey rsa:4096 -nodes -sha256 -subj '/CN=15.206.73.91' -keyout prod-private.pem -out prod-cert.pem