import { Outlet } from "react-router-dom";



export default function AuthLayout() {
    return (
        <div className="app-container">
            <main >
                <Outlet />
            </main>
        </div>
    );
}