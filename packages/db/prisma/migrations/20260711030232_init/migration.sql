-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "vector";

-- CreateEnum
CREATE TYPE "MembershipRole" AS ENUM ('OWNER', 'ADMIN', 'SELLER');

-- CreateEnum
CREATE TYPE "CredentialProvider" AS ENUM ('ANTHROPIC', 'VOYAGE', 'EVOLUTION', 'RESEND', 'S3', 'META_PIXEL', 'GOOGLE_TAG', 'HOTMART', 'KIWIFY', 'EDUZZ', 'STRIPE', 'EXPLORIUM', 'HIGGSFIELD');

-- CreateEnum
CREATE TYPE "CredentialStatus" AS ENUM ('PENDING', 'OK', 'ERROR');

-- CreateEnum
CREATE TYPE "ContextFileType" AS ENUM ('PDF', 'TEXT', 'FAQ', 'PRICING', 'OBJECTIONS', 'TONE', 'ICP', 'SCRIPTS', 'DESIGN_SYSTEM');

-- CreateEnum
CREATE TYPE "ContextFileStatus" AS ENUM ('PENDING', 'PROCESSING', 'INDEXED', 'ERROR');

-- CreateEnum
CREATE TYPE "ConfigSource" AS ENUM ('PLATFORM', 'MARKDOWN');

-- CreateEnum
CREATE TYPE "CampaignType" AS ENUM ('STANDARD', 'LAUNCH_LIVE');

-- CreateEnum
CREATE TYPE "CampaignStatus" AS ENUM ('DRAFT', 'ACTIVE', 'PAUSED', 'FINISHED');

-- CreateEnum
CREATE TYPE "AdStatus" AS ENUM ('DRAFT', 'ACTIVE', 'PAUSED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "LandingGoal" AS ENUM ('WHATSAPP', 'BUY', 'LIVE_SIGNUP');

-- CreateEnum
CREATE TYPE "LandingKind" AS ENUM ('BUILDER', 'EXTERNAL_URL', 'UPLOADED');

-- CreateEnum
CREATE TYPE "LandingStatus" AS ENUM ('DRAFT', 'PUBLISHED');

-- CreateEnum
CREATE TYPE "DeviceTarget" AS ENUM ('ANY', 'MOBILE', 'TABLET', 'DESKTOP');

-- CreateEnum
CREATE TYPE "LandingEventType" AS ENUM ('VIEW', 'CTA_WHATSAPP', 'CTA_BUY', 'SIGNUP');

-- CreateEnum
CREATE TYPE "TemplateKind" AS ENUM ('LANDING', 'EMAIL');

-- CreateEnum
CREATE TYPE "TemplateSource" AS ENUM ('BUILTIN', 'UPLOADED', 'LINK');

-- CreateEnum
CREATE TYPE "StageSystemKey" AS ENUM ('NEW', 'WON', 'LOST', 'POST_SALE', 'NO_REPLY', 'REACTIVATE');

-- CreateEnum
CREATE TYPE "Autonomy" AS ENUM ('DRAFT', 'SEMI', 'AUTO');

-- CreateEnum
CREATE TYPE "Temperature" AS ENUM ('COLD', 'WARM', 'HOT');

-- CreateEnum
CREATE TYPE "AiStatus" AS ENUM ('RUNNING', 'WAITING_HUMAN', 'PAUSED');

-- CreateEnum
CREATE TYPE "DealStatus" AS ENUM ('OPEN', 'WON', 'LOST');

-- CreateEnum
CREATE TYPE "Channel" AS ENUM ('WHATSAPP', 'INSTAGRAM', 'EMAIL');

-- CreateEnum
CREATE TYPE "ConversationState" AS ENUM ('BOT', 'HUMAN');

-- CreateEnum
CREATE TYPE "MessageDirection" AS ENUM ('IN', 'OUT');

-- CreateEnum
CREATE TYPE "AuthorType" AS ENUM ('LEAD', 'AI', 'HUMAN', 'SYSTEM');

-- CreateEnum
CREATE TYPE "MessageKind" AS ENUM ('TEXT', 'IMAGE', 'FILE', 'LINK', 'BUTTONS', 'TEMPLATE');

-- CreateEnum
CREATE TYPE "MessageStatus" AS ENUM ('QUEUED', 'SENT', 'DELIVERED', 'READ', 'FAILED');

-- CreateEnum
CREATE TYPE "RunState" AS ENUM ('RUNNING', 'PAUSED', 'DONE', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ApprovalKind" AS ENUM ('SEND_PAYMENT_LINK', 'DISCOUNT', 'BULK_OUTREACH', 'MESSAGE_DRAFT');

-- CreateEnum
CREATE TYPE "ApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "OrderSource" AS ENUM ('MANUAL', 'PIPELINE', 'WEBHOOK');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('PAID', 'REFUNDED', 'CHARGEBACK');

-- CreateEnum
CREATE TYPE "AccessStatus" AS ENUM ('NEVER', 'ACCESSED', 'ACTIVE', 'IDLE');

-- CreateEnum
CREATE TYPE "UsageEventType" AS ENUM ('LINK_OPENED', 'HEARTBEAT', 'MANUAL_MARK');

-- CreateEnum
CREATE TYPE "ExpenseCategory" AS ENUM ('PAID_TRAFFIC', 'SOFTWARE', 'TOOLS', 'TEAM', 'CREATIVE', 'OTHER');

-- CreateEnum
CREATE TYPE "EmailPurpose" AS ENUM ('PURCHASE_CONFIRM', 'ACCESS', 'WELCOME', 'NPS', 'UPSELL', 'REACTIVATION', 'PASSWORD', 'LIVE_REMINDER', 'CUSTOM');

-- CreateEnum
CREATE TYPE "EmailBodySource" AS ENUM ('AI', 'MANUAL');

-- CreateEnum
CREATE TYPE "EmailTemplateStatus" AS ENUM ('DRAFT', 'ACTIVE');

-- CreateEnum
CREATE TYPE "ProspectSource" AS ENUM ('VIBE', 'LINKEDIN', 'IMPORT', 'MANUAL', 'INERT_CONTACTS', 'GHOSTED');

-- CreateEnum
CREATE TYPE "OutreachStatus" AS ENUM ('DRAFT', 'APPROVED', 'SENT', 'CONVERTED');

-- CreateEnum
CREATE TYPE "ActorType" AS ENUM ('USER', 'AI', 'SYSTEM', 'WEBHOOK');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Workspace" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "settings" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Workspace_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Membership" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "role" "MembershipRole" NOT NULL DEFAULT 'SELLER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Membership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Credential" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "provider" "CredentialProvider" NOT NULL,
    "dataEncrypted" TEXT NOT NULL,
    "status" "CredentialStatus" NOT NULL DEFAULT 'PENDING',
    "lastCheckAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Credential_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SetupState" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "checklist" JSONB NOT NULL DEFAULT '{}',
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SetupState_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductOffer" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "priceCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'BRL',
    "bonuses" JSONB NOT NULL DEFAULT '[]',
    "guarantee" TEXT,
    "promises" JSONB NOT NULL DEFAULT '[]',
    "restrictions" JSONB NOT NULL DEFAULT '[]',
    "accessLinks" JSONB NOT NULL DEFAULT '[]',
    "upsellWindowDays" INTEGER NOT NULL DEFAULT 7,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductOffer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContextFile" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "type" "ContextFileType" NOT NULL,
    "name" TEXT NOT NULL,
    "storageKey" TEXT,
    "rawText" TEXT,
    "status" "ContextFileStatus" NOT NULL DEFAULT 'PENDING',
    "error" TEXT,
    "productOfferId" TEXT,
    "campaignId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContextFile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContextChunk" (
    "id" TEXT NOT NULL,
    "contextFileId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "embedding" vector(1024),
    "tokenCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContextChunk_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentPersona" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "speaksAs" TEXT NOT NULL,
    "tone" TEXT NOT NULL,
    "emojis" BOOLEAN NOT NULL DEFAULT true,
    "msgLength" TEXT NOT NULL DEFAULT 'short',
    "activeHours" JSONB NOT NULL DEFAULT '{"start":"08:00","end":"21:00","days":[1,2,3,4,5,6]}',
    "icpText" TEXT,
    "commercialRules" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AgentPersona_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentMode" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "slot" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "source" "ConfigSource" NOT NULL DEFAULT 'PLATFORM',
    "configJson" JSONB,
    "markdownKey" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AgentMode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Campaign" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "CampaignType" NOT NULL DEFAULT 'STANDARD',
    "objective" TEXT,
    "channel" TEXT,
    "audience" TEXT,
    "budgetCents" INTEGER,
    "cplTargetCents" INTEGER,
    "status" "CampaignStatus" NOT NULL DEFAULT 'DRAFT',
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "liveAt" TIMESTAMP(3),
    "productOfferId" TEXT,
    "landingPageId" TEXT,
    "warmupEnabled" BOOLEAN NOT NULL DEFAULT false,
    "remindersEnabled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Campaign_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Ad" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "campaignId" TEXT,
    "angle" TEXT,
    "hook" TEXT,
    "headline" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "cta" TEXT,
    "framework" TEXT,
    "channel" TEXT,
    "status" "AdStatus" NOT NULL DEFAULT 'DRAFT',
    "savedToLibrary" BOOLEAN NOT NULL DEFAULT false,
    "visualHint" TEXT,
    "metrics" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Ad_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LandingPage" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "goal" "LandingGoal" NOT NULL DEFAULT 'WHATSAPP',
    "kind" "LandingKind" NOT NULL DEFAULT 'BUILDER',
    "externalUrl" TEXT,
    "storageKey" TEXT,
    "productOfferId" TEXT,
    "status" "LandingStatus" NOT NULL DEFAULT 'DRAFT',
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LandingPage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LandingVariant" (
    "id" TEXT NOT NULL,
    "landingPageId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "deviceTarget" "DeviceTarget" NOT NULL DEFAULT 'ANY',
    "weight" INTEGER NOT NULL DEFAULT 50,
    "blocks" JSONB NOT NULL DEFAULT '[]',
    "metrics" JSONB NOT NULL DEFAULT '{}',
    "isWinner" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LandingVariant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LandingEvent" (
    "id" TEXT NOT NULL,
    "landingPageId" TEXT NOT NULL,
    "variantId" TEXT,
    "type" "LandingEventType" NOT NULL,
    "visitorId" TEXT NOT NULL,
    "leadId" TEXT,
    "meta" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LandingEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Template" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "kind" "TemplateKind" NOT NULL,
    "name" TEXT NOT NULL,
    "source" "TemplateSource" NOT NULL DEFAULT 'BUILTIN',
    "data" JSONB NOT NULL DEFAULT '{}',
    "storageKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Template_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PipelineStage" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#8B5CF6',
    "isFixed" BOOLEAN NOT NULL DEFAULT false,
    "systemKey" "StageSystemKey",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PipelineStage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StagePlaybook" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "stageId" TEXT NOT NULL,
    "source" "ConfigSource" NOT NULL DEFAULT 'PLATFORM',
    "objective" TEXT NOT NULL,
    "instructions" TEXT NOT NULL DEFAULT '',
    "allowedActions" JSONB NOT NULL DEFAULT '[]',
    "advanceWhen" TEXT NOT NULL DEFAULT '',
    "regressWhen" TEXT NOT NULL DEFAULT '',
    "cadence" JSONB NOT NULL DEFAULT '{"intervals":[],"maxTouches":0}',
    "handoffTriggers" JSONB NOT NULL DEFAULT '[]',
    "autonomy" "Autonomy" NOT NULL DEFAULT 'SEMI',
    "markdownKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StagePlaybook_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Lead" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT,
    "source" TEXT NOT NULL DEFAULT 'manual',
    "campaignId" TEXT,
    "landingPageId" TEXT,
    "stageId" TEXT NOT NULL,
    "temperature" "Temperature" NOT NULL DEFAULT 'COLD',
    "score" INTEGER NOT NULL DEFAULT 0,
    "valueCents" INTEGER,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "ownerId" TEXT,
    "lastInteractionAt" TIMESTAMP(3),
    "nextActionText" TEXT,
    "aiStatus" "AiStatus" NOT NULL DEFAULT 'RUNNING',
    "lostReason" TEXT,
    "prospectOrigin" TEXT,
    "optedOut" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Lead_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Note" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "authorId" TEXT,
    "text" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Note_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Task" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "leadId" TEXT,
    "title" TEXT NOT NULL,
    "dueAt" TIMESTAMP(3) NOT NULL,
    "doneAt" TIMESTAMP(3),
    "assigneeId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Task_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Deal" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "productOfferId" TEXT NOT NULL,
    "valueCents" INTEGER NOT NULL,
    "status" "DealStatus" NOT NULL DEFAULT 'OPEN',
    "wonAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Deal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Conversation" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "channel" "Channel" NOT NULL DEFAULT 'WHATSAPP',
    "externalId" TEXT,
    "state" "ConversationState" NOT NULL DEFAULT 'BOT',
    "lastMessageAt" TIMESTAMP(3),
    "unreadCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Conversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Message" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "direction" "MessageDirection" NOT NULL,
    "authorType" "AuthorType" NOT NULL,
    "kind" "MessageKind" NOT NULL DEFAULT 'TEXT',
    "content" JSONB NOT NULL,
    "externalId" TEXT,
    "status" "MessageStatus" NOT NULL DEFAULT 'QUEUED',
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Message_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AutomationFlow" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "trigger" JSONB NOT NULL,
    "steps" JSONB NOT NULL DEFAULT '[]',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AutomationFlow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AutomationRun" (
    "id" TEXT NOT NULL,
    "flowId" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "cursor" INTEGER NOT NULL DEFAULT 0,
    "state" "RunState" NOT NULL DEFAULT 'RUNNING',
    "nextRunAt" TIMESTAMP(3),
    "pausedReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AutomationRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Approval" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "kind" "ApprovalKind" NOT NULL,
    "leadId" TEXT,
    "payload" JSONB NOT NULL,
    "status" "ApprovalStatus" NOT NULL DEFAULT 'PENDING',
    "decidedById" TEXT,
    "decidedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Approval_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Order" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "leadId" TEXT,
    "productOfferId" TEXT NOT NULL,
    "valueCents" INTEGER NOT NULL,
    "qty" INTEGER NOT NULL DEFAULT 1,
    "channel" TEXT,
    "source" "OrderSource" NOT NULL DEFAULT 'MANUAL',
    "provider" TEXT,
    "externalId" TEXT,
    "status" "OrderStatus" NOT NULL DEFAULT 'PAID',
    "paidAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Order_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccessGrant" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "trackedToken" TEXT NOT NULL,
    "firstAccessAt" TIMESTAMP(3),
    "lastActivityAt" TIMESTAMP(3),
    "totalActiveSeconds" INTEGER NOT NULL DEFAULT 0,
    "status" "AccessStatus" NOT NULL DEFAULT 'NEVER',
    "idleThresholdDays" INTEGER NOT NULL DEFAULT 5,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AccessGrant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UsageEvent" (
    "id" TEXT NOT NULL,
    "accessGrantId" TEXT NOT NULL,
    "type" "UsageEventType" NOT NULL,
    "meta" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UsageEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Expense" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "category" "ExpenseCategory" NOT NULL,
    "valueCents" INTEGER NOT NULL,
    "description" TEXT NOT NULL,
    "paidBy" TEXT,
    "date" TIMESTAMP(3) NOT NULL,
    "campaignId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Expense_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailTemplate" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "purpose" "EmailPurpose" NOT NULL DEFAULT 'CUSTOM',
    "structure" JSONB NOT NULL DEFAULT '{}',
    "bodySource" "EmailBodySource" NOT NULL DEFAULT 'MANUAL',
    "bodyText" TEXT NOT NULL DEFAULT '',
    "status" "EmailTemplateStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmailTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProspectList" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "source" "ProspectSource" NOT NULL DEFAULT 'MANUAL',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProspectList_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Prospect" (
    "id" TEXT NOT NULL,
    "listId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "company" TEXT,
    "role" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "contacted" BOOLEAN NOT NULL DEFAULT false,
    "leadId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Prospect_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Outreach" (
    "id" TEXT NOT NULL,
    "prospectId" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "status" "OutreachStatus" NOT NULL DEFAULT 'DRAFT',
    "approvedById" TEXT,
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Outreach_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventLog" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "actorType" "ActorType" NOT NULL,
    "actorId" TEXT,
    "type" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "data" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EventLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WebhookEndpoint" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "secret" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WebhookEndpoint_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiUsage" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "feature" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "inputTokens" INTEGER NOT NULL DEFAULT 0,
    "outputTokens" INTEGER NOT NULL DEFAULT 0,
    "costMicros" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiUsage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Workspace_slug_key" ON "Workspace"("slug");

-- CreateIndex
CREATE INDEX "Membership_workspaceId_idx" ON "Membership"("workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "Membership_userId_workspaceId_key" ON "Membership"("userId", "workspaceId");

-- CreateIndex
CREATE INDEX "Credential_workspaceId_idx" ON "Credential"("workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "Credential_workspaceId_provider_key" ON "Credential"("workspaceId", "provider");

-- CreateIndex
CREATE UNIQUE INDEX "SetupState_workspaceId_key" ON "SetupState"("workspaceId");

-- CreateIndex
CREATE INDEX "ProductOffer_workspaceId_idx" ON "ProductOffer"("workspaceId");

-- CreateIndex
CREATE INDEX "ContextFile_workspaceId_status_idx" ON "ContextFile"("workspaceId", "status");

-- CreateIndex
CREATE INDEX "ContextFile_productOfferId_idx" ON "ContextFile"("productOfferId");

-- CreateIndex
CREATE INDEX "ContextChunk_contextFileId_idx" ON "ContextChunk"("contextFileId");

-- CreateIndex
CREATE INDEX "AgentPersona_workspaceId_idx" ON "AgentPersona"("workspaceId");

-- CreateIndex
CREATE INDEX "AgentMode_workspaceId_idx" ON "AgentMode"("workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "AgentMode_workspaceId_slot_key" ON "AgentMode"("workspaceId", "slot");

-- CreateIndex
CREATE INDEX "Campaign_workspaceId_status_idx" ON "Campaign"("workspaceId", "status");

-- CreateIndex
CREATE INDEX "Ad_workspaceId_status_idx" ON "Ad"("workspaceId", "status");

-- CreateIndex
CREATE INDEX "LandingPage_workspaceId_status_idx" ON "LandingPage"("workspaceId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "LandingPage_workspaceId_slug_key" ON "LandingPage"("workspaceId", "slug");

-- CreateIndex
CREATE INDEX "LandingVariant_landingPageId_idx" ON "LandingVariant"("landingPageId");

-- CreateIndex
CREATE INDEX "LandingEvent_landingPageId_type_idx" ON "LandingEvent"("landingPageId", "type");

-- CreateIndex
CREATE INDEX "LandingEvent_landingPageId_variantId_idx" ON "LandingEvent"("landingPageId", "variantId");

-- CreateIndex
CREATE INDEX "Template_workspaceId_kind_idx" ON "Template"("workspaceId", "kind");

-- CreateIndex
CREATE INDEX "PipelineStage_workspaceId_order_idx" ON "PipelineStage"("workspaceId", "order");

-- CreateIndex
CREATE UNIQUE INDEX "StagePlaybook_stageId_key" ON "StagePlaybook"("stageId");

-- CreateIndex
CREATE INDEX "StagePlaybook_workspaceId_idx" ON "StagePlaybook"("workspaceId");

-- CreateIndex
CREATE INDEX "Lead_workspaceId_stageId_idx" ON "Lead"("workspaceId", "stageId");

-- CreateIndex
CREATE INDEX "Lead_workspaceId_phone_idx" ON "Lead"("workspaceId", "phone");

-- CreateIndex
CREATE INDEX "Lead_workspaceId_aiStatus_idx" ON "Lead"("workspaceId", "aiStatus");

-- CreateIndex
CREATE INDEX "Note_leadId_idx" ON "Note"("leadId");

-- CreateIndex
CREATE INDEX "Task_workspaceId_dueAt_idx" ON "Task"("workspaceId", "dueAt");

-- CreateIndex
CREATE INDEX "Deal_workspaceId_status_idx" ON "Deal"("workspaceId", "status");

-- CreateIndex
CREATE INDEX "Conversation_workspaceId_lastMessageAt_idx" ON "Conversation"("workspaceId", "lastMessageAt");

-- CreateIndex
CREATE INDEX "Conversation_workspaceId_externalId_idx" ON "Conversation"("workspaceId", "externalId");

-- CreateIndex
CREATE INDEX "Message_conversationId_createdAt_idx" ON "Message"("conversationId", "createdAt");

-- CreateIndex
CREATE INDEX "Message_externalId_idx" ON "Message"("externalId");

-- CreateIndex
CREATE INDEX "AutomationFlow_workspaceId_isActive_idx" ON "AutomationFlow"("workspaceId", "isActive");

-- CreateIndex
CREATE INDEX "AutomationRun_state_nextRunAt_idx" ON "AutomationRun"("state", "nextRunAt");

-- CreateIndex
CREATE INDEX "AutomationRun_leadId_idx" ON "AutomationRun"("leadId");

-- CreateIndex
CREATE INDEX "Approval_workspaceId_status_idx" ON "Approval"("workspaceId", "status");

-- CreateIndex
CREATE INDEX "Order_workspaceId_paidAt_idx" ON "Order"("workspaceId", "paidAt");

-- CreateIndex
CREATE UNIQUE INDEX "Order_workspaceId_provider_externalId_key" ON "Order"("workspaceId", "provider", "externalId");

-- CreateIndex
CREATE UNIQUE INDEX "AccessGrant_trackedToken_key" ON "AccessGrant"("trackedToken");

-- CreateIndex
CREATE INDEX "AccessGrant_workspaceId_status_idx" ON "AccessGrant"("workspaceId", "status");

-- CreateIndex
CREATE INDEX "UsageEvent_accessGrantId_createdAt_idx" ON "UsageEvent"("accessGrantId", "createdAt");

-- CreateIndex
CREATE INDEX "Expense_workspaceId_date_idx" ON "Expense"("workspaceId", "date");

-- CreateIndex
CREATE INDEX "EmailTemplate_workspaceId_purpose_idx" ON "EmailTemplate"("workspaceId", "purpose");

-- CreateIndex
CREATE INDEX "ProspectList_workspaceId_idx" ON "ProspectList"("workspaceId");

-- CreateIndex
CREATE INDEX "Prospect_listId_contacted_idx" ON "Prospect"("listId", "contacted");

-- CreateIndex
CREATE INDEX "Outreach_prospectId_status_idx" ON "Outreach"("prospectId", "status");

-- CreateIndex
CREATE INDEX "EventLog_workspaceId_createdAt_idx" ON "EventLog"("workspaceId", "createdAt");

-- CreateIndex
CREATE INDEX "EventLog_workspaceId_entity_entityId_idx" ON "EventLog"("workspaceId", "entity", "entityId");

-- CreateIndex
CREATE INDEX "EventLog_workspaceId_type_idx" ON "EventLog"("workspaceId", "type");

-- CreateIndex
CREATE UNIQUE INDEX "WebhookEndpoint_workspaceId_provider_key" ON "WebhookEndpoint"("workspaceId", "provider");

-- CreateIndex
CREATE INDEX "AiUsage_workspaceId_createdAt_idx" ON "AiUsage"("workspaceId", "createdAt");

-- AddForeignKey
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Credential" ADD CONSTRAINT "Credential_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SetupState" ADD CONSTRAINT "SetupState_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductOffer" ADD CONSTRAINT "ProductOffer_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContextFile" ADD CONSTRAINT "ContextFile_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContextFile" ADD CONSTRAINT "ContextFile_productOfferId_fkey" FOREIGN KEY ("productOfferId") REFERENCES "ProductOffer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContextFile" ADD CONSTRAINT "ContextFile_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContextChunk" ADD CONSTRAINT "ContextChunk_contextFileId_fkey" FOREIGN KEY ("contextFileId") REFERENCES "ContextFile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentPersona" ADD CONSTRAINT "AgentPersona_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentMode" ADD CONSTRAINT "AgentMode_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Campaign" ADD CONSTRAINT "Campaign_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Campaign" ADD CONSTRAINT "Campaign_productOfferId_fkey" FOREIGN KEY ("productOfferId") REFERENCES "ProductOffer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Campaign" ADD CONSTRAINT "Campaign_landingPageId_fkey" FOREIGN KEY ("landingPageId") REFERENCES "LandingPage"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ad" ADD CONSTRAINT "Ad_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ad" ADD CONSTRAINT "Ad_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LandingPage" ADD CONSTRAINT "LandingPage_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LandingPage" ADD CONSTRAINT "LandingPage_productOfferId_fkey" FOREIGN KEY ("productOfferId") REFERENCES "ProductOffer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LandingVariant" ADD CONSTRAINT "LandingVariant_landingPageId_fkey" FOREIGN KEY ("landingPageId") REFERENCES "LandingPage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LandingEvent" ADD CONSTRAINT "LandingEvent_landingPageId_fkey" FOREIGN KEY ("landingPageId") REFERENCES "LandingPage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LandingEvent" ADD CONSTRAINT "LandingEvent_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "LandingVariant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LandingEvent" ADD CONSTRAINT "LandingEvent_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Template" ADD CONSTRAINT "Template_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PipelineStage" ADD CONSTRAINT "PipelineStage_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StagePlaybook" ADD CONSTRAINT "StagePlaybook_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StagePlaybook" ADD CONSTRAINT "StagePlaybook_stageId_fkey" FOREIGN KEY ("stageId") REFERENCES "PipelineStage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_landingPageId_fkey" FOREIGN KEY ("landingPageId") REFERENCES "LandingPage"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_stageId_fkey" FOREIGN KEY ("stageId") REFERENCES "PipelineStage"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Note" ADD CONSTRAINT "Note_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Note" ADD CONSTRAINT "Note_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Note" ADD CONSTRAINT "Note_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Deal" ADD CONSTRAINT "Deal_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Deal" ADD CONSTRAINT "Deal_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Deal" ADD CONSTRAINT "Deal_productOfferId_fkey" FOREIGN KEY ("productOfferId") REFERENCES "ProductOffer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AutomationFlow" ADD CONSTRAINT "AutomationFlow_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AutomationRun" ADD CONSTRAINT "AutomationRun_flowId_fkey" FOREIGN KEY ("flowId") REFERENCES "AutomationFlow"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AutomationRun" ADD CONSTRAINT "AutomationRun_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Approval" ADD CONSTRAINT "Approval_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Approval" ADD CONSTRAINT "Approval_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Approval" ADD CONSTRAINT "Approval_decidedById_fkey" FOREIGN KEY ("decidedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_productOfferId_fkey" FOREIGN KEY ("productOfferId") REFERENCES "ProductOffer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccessGrant" ADD CONSTRAINT "AccessGrant_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccessGrant" ADD CONSTRAINT "AccessGrant_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccessGrant" ADD CONSTRAINT "AccessGrant_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UsageEvent" ADD CONSTRAINT "UsageEvent_accessGrantId_fkey" FOREIGN KEY ("accessGrantId") REFERENCES "AccessGrant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailTemplate" ADD CONSTRAINT "EmailTemplate_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProspectList" ADD CONSTRAINT "ProspectList_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Prospect" ADD CONSTRAINT "Prospect_listId_fkey" FOREIGN KEY ("listId") REFERENCES "ProspectList"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Prospect" ADD CONSTRAINT "Prospect_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Outreach" ADD CONSTRAINT "Outreach_prospectId_fkey" FOREIGN KEY ("prospectId") REFERENCES "Prospect"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventLog" ADD CONSTRAINT "EventLog_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WebhookEndpoint" ADD CONSTRAINT "WebhookEndpoint_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiUsage" ADD CONSTRAINT "AiUsage_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
