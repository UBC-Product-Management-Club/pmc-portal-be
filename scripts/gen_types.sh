set -x
source .secret/.env
FILE="src/schema/v2/database.types.ts"
if [ -f "$FILE" ]; then
    rm "$FILE"
fi
npx supabase gen types typescript --project-id "$SUPABASE_PROJECT_ID" --schema public > src/schema/v2/database.types.ts
echo "Database types file created"