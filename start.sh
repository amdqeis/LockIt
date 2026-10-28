#!/usr/bin/env bash
# ==============================================================================
# EduQuas Platform — Dev Server Launcher (Frontend: 3000 | Backend: 3001)
# ==============================================================================

set -eo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Warna Output
CYAN='\033[0;36m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
BOLD='\033[1m'
NC='\033[0m' # No Color

echo -e "${CYAN}${BOLD}"
echo "=========================================================="
echo "   🔒 EduQuas — Online Exam & Browser Proctoring Platform   "
echo "=========================================================="
echo -e "${NC}"

# Fungsi pembersihan saat script dihentikan (Ctrl+C / SIGTERM / EXIT)
cleanup() {
  echo -e "\n${YELLOW}Menghentikan semua service EduQuas...${NC}"
  if [ -n "$BE_PID" ] && kill -0 "$BE_PID" 2>/dev/null; then
    kill "$BE_PID" 2>/dev/null || true
  fi
  if [ -n "$FE_PID" ] && kill -0 "$FE_PID" 2>/dev/null; then
    kill "$FE_PID" 2>/dev/null || true
  fi
  pkill -P $$ 2>/dev/null || true
  echo -e "${GREEN}Semua service berhasil dihentikan.${NC}"
}
trap cleanup SIGINT SIGTERM EXIT

# 1. Cek .env backend
if [ ! -f "backend/.env" ]; then
  if [ -f "backend/.env.example" ]; then
    echo -e "${YELLOW}⚠️  File backend/.env tidak ditemukan. Menyalin dari backend/.env.example...${NC}"
    cp backend/.env.example backend/.env
  else
    echo -e "${RED}❌ File backend/.env tidak ditemukan! Harap buat file backend/.env terlebih dahulu.${NC}"
    exit 1
  fi
fi

# 2. Cek dependensi jika diperlukan
if [ ! -d "node_modules" ] && [ ! -d "backend/node_modules" ]; then
  echo -e "${YELLOW}📦 Menginstal dependensi monorepo...${NC}"
  npm install
fi

# 3. Cek apakah port sudah digunakan
check_port() {
  local port=$1
  if command -v lsof >/dev/null 2>&1; then
    lsof -i ":$port" >/dev/null 2>&1
  elif command -v ss >/dev/null 2>&1; then
    ss -tuln | grep -q ":$port "
  else
    return 1
  fi
}

if check_port 3000; then
  echo -e "${YELLOW}⚠️  Port 3000 (Frontend) sedang aktif / digunakan oleh proses lain.${NC}"
fi

if check_port 3001; then
  echo -e "${YELLOW}⚠️  Port 3001 (Backend) sedang aktif / digunakan oleh proses lain.${NC}"
fi

echo -e "${BLUE}▶ Menjalankan Backend API & Socket.IO di port 3001...${NC}"
(
  cd backend
  npm run dev
) 2>&1 | sed "s/^/$(echo -e "${BLUE}[BE-3001]${NC} ")/" &
BE_PID=$!

echo -e "${CYAN}▶ Menjalankan Frontend Next.js di port 3000...${NC}"
(
  cd frontend
  npm run dev
) 2>&1 | sed "s/^/$(echo -e "${CYAN}[FE-3000]${NC} ")/" &
FE_PID=$!

echo -e "${GREEN}${BOLD}"
echo "=========================================================="
echo "   ✅ EduQuas Services Berjalan:"
echo "   🌐 Frontend Web: http://localhost:3000"
echo "   🔌 Backend API : http://localhost:3001"
echo "   Tekan [Ctrl+C] untuk menghentikan kedua server."
echo "=========================================================="
echo -e "${NC}"

# Menunggu child processes
wait $BE_PID $FE_PID
