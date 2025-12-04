import Header from "@/components/Header/Header";
import { Outlet, NavLink } from "react-router-dom";

export default function RootLayout() {
    return (
        <div className="app-container min-h-svh">
            <Header />

            <main >

                <Outlet />
            </main>

            {/* <footer className="p-4 text-center border-t mt-auto">
                <p>&copy; 2025 My Application</p>
            </footer> */}
        </div>
    );
}