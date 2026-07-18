-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'CUSTOMER',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RefreshToken" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RefreshToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Customer" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT,
    "address" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "idType" TEXT NOT NULL,
    "idNumber" TEXT NOT NULL,
    "idProofUrl" TEXT,
    "photoUrl" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Customer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Loan" (
    "id" TEXT NOT NULL,
    "loanNumber" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "agentId" TEXT,
    "principalAmount" DOUBLE PRECISION NOT NULL,
    "interestRate" DOUBLE PRECISION NOT NULL,
    "interestType" TEXT NOT NULL,
    "tenure" INTEGER NOT NULL,
    "tenureUnit" TEXT NOT NULL,
    "processingFee" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalInterest" DOUBLE PRECISION NOT NULL,
    "totalPayable" DOUBLE PRECISION NOT NULL,
    "installmentAmount" DOUBLE PRECISION NOT NULL,
    "interestCollected" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "outstandingPrincipal" DOUBLE PRECISION,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "disbursedAt" TIMESTAMP(3),
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Loan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Repayment" (
    "id" TEXT NOT NULL,
    "loanId" TEXT NOT NULL,
    "installmentNo" INTEGER NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "dueAmount" DOUBLE PRECISION NOT NULL,
    "principal" DOUBLE PRECISION NOT NULL,
    "interest" DOUBLE PRECISION NOT NULL,
    "paidAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "paidAt" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'PENDING',

    CONSTRAINT "Repayment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL,
    "repaymentId" TEXT NOT NULL,
    "collectedById" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "paymentMode" TEXT NOT NULL DEFAULT 'CASH',
    "paymentType" TEXT NOT NULL DEFAULT 'INTEREST',
    "reference" TEXT,
    "notes" TEXT,
    "collectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT,
    "details" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "User_email_idx" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_phone_idx" ON "User"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "RefreshToken_token_key" ON "RefreshToken"("token");

-- CreateIndex
CREATE INDEX "Customer_phone_idx" ON "Customer"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "Loan_loanNumber_key" ON "Loan"("loanNumber");

-- CreateIndex
CREATE INDEX "Loan_customerId_idx" ON "Loan"("customerId");

-- CreateIndex
CREATE INDEX "Loan_status_idx" ON "Loan"("status");

-- CreateIndex
CREATE INDEX "Loan_loanNumber_idx" ON "Loan"("loanNumber");

-- CreateIndex
CREATE INDEX "Repayment_loanId_idx" ON "Repayment"("loanId");

-- CreateIndex
CREATE INDEX "Repayment_dueDate_idx" ON "Repayment"("dueDate");

-- CreateIndex
CREATE INDEX "Repayment_status_idx" ON "Repayment"("status");

-- CreateIndex
CREATE INDEX "Payment_repaymentId_idx" ON "Payment"("repaymentId");

-- CreateIndex
CREATE INDEX "Payment_collectedAt_idx" ON "Payment"("collectedAt");

-- CreateIndex
CREATE INDEX "AuditLog_userId_idx" ON "AuditLog"("userId");

-- CreateIndex
CREATE INDEX "AuditLog_entity_idx" ON "AuditLog"("entity");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- AddForeignKey
ALTER TABLE "RefreshToken" ADD CONSTRAINT "RefreshToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Customer" ADD CONSTRAINT "Customer_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Loan" ADD CONSTRAINT "Loan_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Loan" ADD CONSTRAINT "Loan_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Repayment" ADD CONSTRAINT "Repayment_loanId_fkey" FOREIGN KEY ("loanId") REFERENCES "Loan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_repaymentId_fkey" FOREIGN KEY ("repaymentId") REFERENCES "Repayment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_collectedById_fkey" FOREIGN KEY ("collectedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
