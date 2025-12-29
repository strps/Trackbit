import Header from "@/components/Header";
import { useSession } from "@/lib/auth-client";
import { Outlet, NavLink, useNavigate } from "react-router-dom";

interface AppLayoutProps {
    isPublic?: boolean;
}


export default function AppLayout({ isPublic }: AppLayoutProps) {
    const navigate = useNavigate();
    const { data: session, isPending } = useSession();

    if (!session && !isPending && !isPublic) {
        navigate('/signin');
    }


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