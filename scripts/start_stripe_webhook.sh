source .secret/.env
echo "Starting local listener, forwarding to localhost:${PORT:-8000}/webhook. Don't forget to update the webhook secret!"
stripe listen --forward-to localhost:${PORT:-8000}/webhook