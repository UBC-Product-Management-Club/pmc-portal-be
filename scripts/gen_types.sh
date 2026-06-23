set -x
source <(sed 's/ = /=/g; s/"//g' .secret/.env)
FILE="src/schema/v2/database.types.ts"
SUPABASE_PROJECT_ID="$(echo "$SUPABASE_URL" | sed -n 's|https://\([^.]*\)\.supabase\.co.*|\1|p')"
if [ -f "$FILE" ]; then
    rm "$FILE"
fi
npx supabase gen types typescript --project-id "$SUPABASE_PROJECT_ID" --schema public > src/schema/v2/database.types.ts
echo "Database types file created"
