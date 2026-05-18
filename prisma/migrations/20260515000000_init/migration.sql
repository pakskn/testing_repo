-- ─── NextAuth User Management ──────────────────────────────────────────────

CREATE TABLE "User" (
    "id"            TEXT NOT NULL,
    "name"          TEXT,
    "email"         TEXT NOT NULL,
    "emailVerified" TIMESTAMP(3),
    "image"         TEXT,
    "role"          TEXT NOT NULL DEFAULT 'user',
    "status"        TEXT NOT NULL DEFAULT 'pending',
    "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

CREATE TABLE "Account" (
    "id"                TEXT NOT NULL,
    "userId"            TEXT NOT NULL,
    "type"              TEXT NOT NULL,
    "provider"          TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token"     TEXT,
    "access_token"      TEXT,
    "expires_at"        INTEGER,
    "token_type"        TEXT,
    "scope"             TEXT,
    "id_token"          TEXT,
    "session_state"     TEXT,
    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Account_provider_providerAccountId_key" ON "Account"("provider","providerAccountId");
ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE;

CREATE TABLE "Session" (
    "id"           TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "userId"       TEXT NOT NULL,
    "expires"      TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Session_sessionToken_key" ON "Session"("sessionToken");
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE;

CREATE TABLE "VerificationToken" (
    "identifier" TEXT NOT NULL,
    "token"      TEXT NOT NULL,
    "expires"    TIMESTAMP(3) NOT NULL
);
CREATE UNIQUE INDEX "VerificationToken_token_key" ON "VerificationToken"("token");
CREATE UNIQUE INDEX "VerificationToken_identifier_token_key" ON "VerificationToken"("identifier","token");

CREATE TABLE "SignInLog" (
    "id"         TEXT NOT NULL,
    "userId"     TEXT NOT NULL,
    "signedInAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SignInLog_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "SignInLog" ADD CONSTRAINT "SignInLog_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE;

-- ─── YouTube Channel Research ───────────────────────────────────────────────

CREATE TABLE "Channel" (
    "id"               TEXT NOT NULL,
    "channelId"        TEXT NOT NULL,
    "channelName"      TEXT NOT NULL,
    "channelHandle"    TEXT,
    "thumbnailUrl"     TEXT,
    "subscribers"      INTEGER NOT NULL DEFAULT 0,
    "totalVideos"      INTEGER NOT NULL DEFAULT 0,
    "totalViews"       BIGINT NOT NULL DEFAULT 0,
    "channelType"      TEXT NOT NULL,
    "niche"            TEXT,
    "daysSinceStart"   INTEGER NOT NULL DEFAULT 0,
    "avgViewsPerVideo" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "outlierScore"     DOUBLE PRECISION NOT NULL DEFAULT 0,
    "isMonetized"      BOOLEAN NOT NULL DEFAULT false,
    "isActive"         BOOLEAN NOT NULL DEFAULT true,
    "sortOrder"        INTEGER NOT NULL DEFAULT 0,
    "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Channel_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Channel_channelId_key" ON "Channel"("channelId");

CREATE TABLE "Video" (
    "id"           TEXT NOT NULL,
    "videoId"      TEXT NOT NULL,
    "channelId"    TEXT NOT NULL,
    "title"        TEXT NOT NULL,
    "thumbnailUrl" TEXT,
    "views"        BIGINT NOT NULL DEFAULT 0,
    "duration"     TEXT,
    "publishedAt"  TIMESTAMP(3),
    CONSTRAINT "Video_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Video_videoId_key" ON "Video"("videoId");
ALTER TABLE "Video" ADD CONSTRAINT "Video_channelId_fkey"
    FOREIGN KEY ("channelId") REFERENCES "Channel"("channelId") ON DELETE RESTRICT;
