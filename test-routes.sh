#!/bin/bash

BASE_URL="${1:-http://localhost:3000}"
PASS=0
FAIL=0
SKIP=0

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m'

check() {
  local method=$1
  local route=$2
  local expected=$3

  status=$(curl -s -o /dev/null -w "%{http_code}" -X "$method" \
    -H "Content-Type: application/json" \
    "${BASE_URL}${route}")

  if [ "$status" -eq "$expected" ]; then
    echo -e "${GREEN}✓${NC} ${method} ${route} → $status"
    PASS=$((PASS + 1))
  elif [ "$status" -eq 000 ]; then
    echo -e "${YELLOW}⚠${NC} ${method} ${route} → server not reachable"
    SKIP=$((SKIP + 1))
  else
    echo -e "${RED}✗${NC} ${method} ${route} → got $status (expected $expected)"
    FAIL=$((FAIL + 1))
  fi
}

section() {
  echo ""
  echo -e "${BLUE}== $1 ==${NC}"
}

# ─────────────────────────────────────────
section "Auth"
check POST   /auth/login                        503
check POST   /auth/logout                       503
check GET    /auth/oauth/google                 503
check GET    "/auth/oauth/google/callback?code=test&state=test" 503
check POST   /auth/register                     503
check POST   /auth/password-forgot              503
check POST   /auth/password-reset               503

# ─────────────────────────────────────────
section "Me"
check PATCH  /me                                503
check DELETE /me                                503
check POST   /me/avatar                         503

# ─────────────────────────────────────────
section "Notifications"
check GET    /notifications                     503

# ─────────────────────────────────────────
section "Settings"
check PATCH  /me/settings                       503
check PUT    /me/settings/security              503

# ─────────────────────────────────────────
# NOTE: GET /users/{id} is frontend → gateway only, no backend route
section "Users"
check POST   /users/1/report                    503
check POST   /users/1/block                     503
check POST   /users/1/friendship                503
check PATCH  /users/1/friendship                503
check DELETE /users/1/friendship                503
check POST   /users/1/ban                       503
check PATCH  /users/1/ban                       503
check PATCH  /users/1                           503
check DELETE /users/1                           503

# ─────────────────────────────────────────
# NOTE: GET /feed is frontend only, no backend route
section "Polls"
check POST   /polls/new                         503
check PATCH  /polls/1                           503
check DELETE /polls/1                           503
check POST   /polls/1/report                    503
check POST   /polls/1/options/1/report          503
check DELETE /polls/1/options/1                 503
check POST   /polls/1/vote                      503
check PATCH  /polls/1/vote                      503
check DELETE /polls/1/vote                      503
check POST   /polls/1/vote/report               503

# ─────────────────────────────────────────
section "Rooms"
check POST   /rooms/new                         503
check PATCH  /rooms/1                           503
check DELETE /rooms/1                           503
check POST   /rooms/1/participants/2            503
check DELETE /rooms/1/participants/2            503
check GET    /rooms/1/messages                  503
check POST   /rooms/1/messages                  503
check DELETE /rooms/1/messages/1                503

# ─────────────────────────────────────────
section "Search"
check GET    /search                            503

# ─────────────────────────────────────────
section "Contact"
check POST   /contact                           503

# ─────────────────────────────────────────
# NOTE: all /admin/* are frontend only, no backend routes
# ─────────────────────────────────────────

section "API v1 — Register & Keys"
check POST   /api/v1/register                   503
check DELETE /api/v1/keys/1                     503

# ─────────────────────────────────────────
section "API v1 — Public endpoints"
check GET    /api/v1/users                      503
check GET    /api/v1/users/1                    503
check GET    /api/v1/polls                      503
check GET    /api/v1/polls/1                    503
check GET    /api/v1/polls/1/results            503
check GET    /api/v1/rooms                      503
check GET    /api/v1/rooms/1                    503
check GET    /api/v1/hashtags                   503
check GET    /api/v1/hashtags/1                 503

# ─────────────────────────────────────────
echo ""
echo "────────────────────────────────"
echo -e "${GREEN}✓ Passed: $PASS${NC}"
echo -e "${RED}✗ Failed: $FAIL${NC}"
echo -e "${YELLOW}⚠ Skipped: $SKIP${NC}"
echo "────────────────────────────────"