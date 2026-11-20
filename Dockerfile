# Imagen única para web (Next standalone) y worker (tsx). ffmpeg = capa de voz.
FROM node:22-slim AS base
WORKDIR /app
# ca-certificates: TLS salientes (Supabase/DeepSeek/Groq). ffmpeg: transcodificar
# las notas de voz a OGG/Opus para WhatsApp (worker/voz/audio.ts).
RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates ffmpeg \
    && rm -rf /var/lib/apt/lists/*

FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci

FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# NEXT_PUBLIC_* se hornean en build → llegan como build args desde el compose.
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL
ENV NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY
RUN npm run build

FROM base AS runtime
ENV NODE_ENV=production
# Repo completo + node_modules: la web corre standalone y el worker corre con tsx.
COPY --from=build /app ./
EXPOSE 3000 3001
# Cada servicio del compose define su comando real (web: start, worker: worker).
CMD ["npm","run","start"]
