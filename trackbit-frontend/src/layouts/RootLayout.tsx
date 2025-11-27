import Header from "@/components/Header";
import { Outlet, NavLink } from "react-router-dom";

export default function RootLayout() {
    return (
        <div className="app-container">
            {/* 1. The Navigation Bar */}
            <Header />

            {/* 2. The Main Content Area */}
            <main style={styles.main}>
                {/* The <Outlet /> is the most important part. 
            This is where the child route (Home, About, Dashboard) 
            will actually be rendered. 
        */}
                <Outlet />
            </main>

            {/* 3. The Footer */}
            <footer className="">
                <p>&copy; 2025 My Application</p>
            </footer>
        </div>
    );
}

// Simple inline styles for demonstration purposes
// You would typically use CSS Modules, Tailwind, or Styled Components here.
const styles = {
    header: {
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "1rem 2rem",
        backgroundColor: "#f4f4f4",
        borderBottom: "1px solid #ddd",
    },
    nav: {
        display: "flex",
        gap: "1rem",
    },
    link: {
        textDecoration: "none",
        color: "#333",
        fontWeight: "500",
    },
    activeLink: {
        textDecoration: "none",
        color: "#007bff", // Blue color for active state
        fontWeight: "bold",
    },
    main: {
        padding: "2rem",
        minHeight: "80vh", // Ensures footer stays at bottom on short pages
    },
    footer: {
        textAlign: "center",
        padding: "1rem",
        backgroundColor: "#333",
        color: "#fff",
    }
};