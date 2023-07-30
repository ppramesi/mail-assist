# Load environment variables from .env file
source .env

version=${1:-0.0.1}
mode=${2:-development}

if [ "$mode" != "development" ] && [ "$mode" != "staging" ] && [ "$mode" != "production" ]; then
    echo "Error: Invalid mode. Allowed values: development, staging, production"
    exit 1
fi

if [[ $version =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
    docker build -t $DOCKER_REPO:$version .
    docker push $DOCKER_REPO:$version

    gcloud run jobs create $SERVICE_ID \
        --max-instances 10 \
        --image $DOCKER_REPO:$version \
        --tasks 50 \
        --max-retries 5 \
        --update-env-vars "GOOGLE_CLOUD_PROJECT=$PROJECT_ID,MODE=$mode,USE_CACHE=true,MAIL_GPT_SERVER_URL=$MAIL_GPT_SERVER_URL,USE_AUTH=$USE_AUTH" \
        --update-secrets=TOKEN_KEY=TOKEN_KEY:1 \
        --service-account "$SERVICE_ACCOUNT" \
        --region $REGION \
        --project "$PROJECT_ID"

    echo $version >> .versions
else
    echo "Invalid version string"
fi