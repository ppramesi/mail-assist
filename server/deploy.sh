# Load environment variables from .env file
source .env

version=${1:-0.0.1}
mode=${2:-development}

if [ "$mode" != "development" ] && ["$mode" != "staging" ] && [ "$mode" != "production" ]; then
    echo "Error: Invalid mode. Allowed values: development, staging, production"
    exit 1
fi

if [[ $version =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
    docker build -t $DOCKER_REPO:$version .
    docker push $DOCKER_REPO:$version

    gcloud run deploy "$SERVICE_ID" \
        --max-instances 10 \
        --image $DOCKER_REPO:$version \
        --update-env-vars "GOOGLE_CLOUD_PROJECT=$PROJECT_ID,MODE=$mode,USE_CACHE=true,POSTGRES_USER=$POSTGRES_USER,POSTGRES_DB=$POSTGRES_DB,POSTGRES_PORT=$POSTGRES_PORT,POSTGRES_HOST=$POSTGRES_HOST,LANGCHAIN_TRACING_V2=$LANGCHAIN_TRACING_V2,LANGCHAIN_ENDPOINT=$LANGCHAIN_ENDPOINT,GMAIL_USER=$GMAIL_USER" \
        --update-secrets=POSTGRES_PASSWORD=POSTGRES_PASSWORD:1,TOKEN_KEY=TOKEN_KEY:1,LANGCHAIN_API_KEY=LANGCHAIN_API_KEY:1,OPENAI_API_KEY=OPENAI_API_KEY:1,GMAIL_PASSWORD=GMAIL_PASSWORD:1 \
        --port 8080 \
        --concurrency 80 \
        --service-account "$SERVICE_ACCOUNT" \
        --allow-unauthenticated \
        --region $REGION \
        --project "$PROJECT_ID"

    echo $version >> .versions
else
    echo "Invalid version string"
fi