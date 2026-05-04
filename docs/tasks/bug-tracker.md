This implementation plan focuses on turning **Trakbit's** technical friction into a streamlined communication channel. By integrating a bug tracker directly into your React/Node.js stack, you move away from manual bug hunting and toward a data-driven approach where the app reports its own issues. This setup ensures that whether a user notices a small UI glitch or encounters a full application crash, the relevant context is captured and delivered to you instantly.

---

## **Technical Implementation Plan**

### **Phase 1: The Data Layer (Backend)**

First, define how the data will be stored. Since you are using **Drizzle ORM**, add a new table to your schema.

* **Schema Definition:** Create an `issues` table.  
  * `id`: Primary key.  
  * `type`: Enum ('bug', 'feedback').  
  * `path`: The URL where the error occurred.  
  * `stack_trace`: Text field to store the React error (for the error page).  
  * `description`: User-provided text.  
  * `status`: Default to 'open'.  
* **API Endpoint:** Create a `POST /api/issues` route in your **Hono** backend to receive the payload.

### **Phase 2: The Global "Bug" Button**

Since you want this in the menu, it should be a lightweight trigger for a modal.

* **UI Component:** Use a **Shadcn UI** `Button` with a `Bug` icon from **Lucide React**.  
* **Global Modal:** Place a `FeedbackModal` at the root of your layout. Use a simple state (or a small store) to open it from the menu button.  
* **Context Capture:** When the modal opens, it should automatically grab `window.location.pathname` so you know exactly which habit or settings page the user was on.

### **Phase 3: The React Router Error Boundary**

This is the most critical part for "auto-filling" reports during a total crash.

* **Custom Error Element:** Create a `RootErrorBoundary` component.  
* **React Router Integration:** Use the `useRouteError()` hook to catch the exception details.  
* **The Logic:**  
  1. If a crash occurs, the user is redirected to this page.  
  2. Display a friendly "Something went wrong" message.  
  3. **Auto-fill:** Pass the `error.stack` or `error.message` directly into the "Technical Details" field of your feedback form.  
  4. **Submission:** Allow the user to click one button to send both their comments and the technical crash report to your backend.

### **Phase 4: Developer Alerts**

Automate the notification so you don't have to manually monitor the database.

* **Webhook Notification:** In your Hono route, after a successful Drizzle insert, trigger a **Discord** or **Slack** webhook.  
* **The Payload:** Send a formatted message containing the user, the affected page, and the error snippet for immediate visibility.

---

## **Suggested Task List**

1. [ ] **Database:** Run a migration to add the `issues` table.  
2. [ ] **Backend:** Build the `POST` endpoint with Hono.  
3. [ ] **Frontend:** Create the `FeedbackModal` using a standard form.  
4. [ ] **UX:** Add the bug icon to your sidebar/menu component.  
5. [ ] **Robustness:** Implement `useRouteError` in your main router file to catch and report crashes.
