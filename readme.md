# **trackbit**

A hybrid habit tracker and workout logger for the modern web.

**trackbit** is an intelligent tracking application that bridges the gap between simple habit checkboxes (like "Did I read today?") and complex activity logging (like "Bench Press: 3 sets of 10 @ 80kg"). It features a seamless dashboard with GitHub-style heatmaps, real-time optimistic UI updates, and deep analytics.

## **✨ Key Features**

* **Hybrid Data Model:** Track simple binary habits alongside complex, data-rich activities (workouts, reading sessions, hydration) in a single unified interface.  
* **Interactive Heatmaps:** Visualize consistency with dynamic, gradient-based activity logs.  
* **Optimistic UI:** Instant feedback on interactions using TanStack Query, ensuring a snappy feel even on slow networks.  
* **Exercise Library:** A built-in database of exercises with support for custom user creations.  
* **Gradient Progress:** Visual intensity tracking based on daily goals (e.g., color intensity increases as you approach your target).  
* **Secure Authentication:** Powered by **Better-Auth** with support for email/password and session management.

## **🛠️ Tech Stack**

### **Frontend**

* **Framework:** React 18 \+ Vite  
* **Language:** TypeScript  
* **State/Data Fetching:** TanStack Query (React Query)  
* **Styling:** Tailwind CSS \+ Shadcn UI  
* **Icons:** Lucide React

### **Backend**

* **Runtime:** Node.js  
* **Framework:** Fastify  
* **Database ORM:** Drizzle ORM  
* **Database:** PostgreSQL  
* **Validation:** Zod  
* **Authentication:** Better-Auth

## **🚀 Getting Started**

### **Prerequisites**

* Node.js (v18+)  
* pnpm (recommended) or npm  
* PostgreSQL database (Local or Cloud)

### **Installation**

1. **Clone the repository**  
   git clone \[https://github.com/yourusername/trackbit.git\](https://github.com/yourusername/trackbit.git)  
   cd trackbit

2. Install Dependencies  
   Since this is a monorepo-style structure (or separated folders), install dependencies for both.  
   \# Root (if using workspaces) or separate folders  
   cd frontend && pnpm install  
   cd ../backend && pnpm install

3. Environment Setup  
   Create a .env file in the backend directory:  
   DATABASE\_URL="postgresql://user:password@localhost:5432/trackbit\_db"  
   BETTER\_AUTH\_SECRET="your\_generated\_secret\_here"  
   PORT=3000

4. Database Migration  
   Initialize your database schema using Drizzle Kit.  
   cd backend  
   pnpm db:generate  
   pnpm db:migrate

### **Running the Project**

**1\. Start the Backend API**

cd backend  
pnpm dev  
\# Server running at http://localhost:3000

**2\. Start the Frontend Client**

cd frontend  
pnpm dev  
\# App running at http://localhost:5173

## **📂 Project Structure**

trackbit/  
├── backend/  
│   ├── src/  
│   │   ├── db/              \# Drizzle schema & connection  
│   │   ├── modules/         \# Feature-based API routes (habits, logs, auth)  
│   │   ├── plugins/         \# Fastify plugins (CORS, JWT)  
│   │   └── app.ts           \# App entry point  
│   └── drizzle/             \# SQL migrations  
├── frontend/  
│   ├── src/  
│   │   ├── components/      \# Reusable UI components  
│   │   ├── hooks/           \# Custom React hooks (useHabits, useLogs)  
│   │   ├── pages/           \# Main route views (Tracker, Library, Settings)  
│   │   └── types/           \# Shared TypeScript interfaces  
│   └── index.html  
└── README.md

## **🗺️ Roadmap**

We are currently in the **Beta Phase**. Upcoming milestones include:

* \[ \] **Data Analysis:** Correlation engines to find patterns between habits.  
* \[ \] **Mobile Polish:** Enhanced touch support for mobile browsers.  
* \[ \] **Social Features:** Optional leaderboards for accountability.  
* \[ \] **Export:** JSON/CSV export for user data sovereignty.

