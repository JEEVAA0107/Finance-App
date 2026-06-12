# Finance-App (LoanFlowPro)

A comprehensive Mobile and Web Finance Management System designed for tracking customers, managing loan disbursements, collecting installments, and auditing transactions. Built using a modern full-stack architecture with a React & Vite frontend (packaged with Capacitor for Android deployment) and an Express backend using Prisma with SQLite.

---

## 🚀 Key Features

- **User Management**: Multi-role system supporting Admin, Agent, and Customer roles with secure JWT authentication and refresh tokens.
- **Customer Directory**: Store comprehensive customer information including identity details (Aadhar, PAN, Voter ID), addresses, and contact info.
- **Loan Tracking**: 
  - Dynamic interest calculation (Flat rate & Reducing balance).
  - Flexible repayment schedules (Days, Weeks, Months).
  - Tracking of outstanding principal, total interest, and installment progress.
- **Repayments & Collection**: 
  - Log agent collections in real-time.
  - Supports multiple payment modes: Cash, UPI, Bank Transfer, and Cheques.
  - Distinguishes between Interest collections and Principal lump-sum payments.
- **Auditing & Reporting**:
  - Automatically records actions in system-wide Audit Logs for compliance.
  - Export reports in PDF format (using `jspdf` & `jspdf-autotable`) and Excel spreadsheets (using `xlsx` & `exceljs`).
- **Capacitor Mobile Integration**: Prepared for native Android compile target (Vite client wrapped in Capacitor).

---

## 🛠️ Technology Stack

### Frontend
- **Framework**: React 19 (via Vite)
- **Routing**: React Router Dom
- **Database**: Capacitor SQLite
- **Styling & Icons**: Lucide React, Custom CSS
- **Features**: Recharts (for dashboards), React Signature Canvas (for signing agreements), React Hot Toast (notifications)
- **Mobile Wrapper**: Capacitor CLI & Capacitor Android

### Backend
- **Framework**: Node.js & Express
- **Database ORM**: Prisma (configured with SQLite for development)
- **Security**: Helmet, CORS, Express Rate Limit, bcryptjs
- **Logging**: Morgan & Winston

---

## 📦 Database Schema (Prisma)

The application database is structured around the following models:
- **User**: System accounts (Admin/Agent/Customer).
- **Customer**: Profile records associated with a User.
- **Loan**: Loan agreements (principal, rates, dates, tenure).
- **Repayment**: Scheduled installment items mapped to a loan.
- **Payment**: Individual transactions collected by agents for repayments.
- **AuditLog**: Chronological logs tracking all critical activities.

---

## 🚀 Getting Started

### Prerequisites
- Node.js (v18 or higher recommended)
- Android Studio (for native Android builds via Capacitor)

### Backend Setup
1. Navigate to the backend folder:
   ```bash
   cd backend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Initialize the Prisma database:
   ```bash
   npx prisma migrate dev --name init
   ```
4. Run the development server:
   ```bash
   npm run dev
   ```

### Frontend Setup
1. Navigate to the frontend folder:
   ```bash
   cd frontend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Run the development server:
   ```bash
   npm run dev
   ```
4. Build for mobile output:
   ```bash
   npm run build
   npx cap sync
   ```

---

*Developed by **Jeevaa**.*