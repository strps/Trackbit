import React from 'react';
import { Facebook, Instagram, Youtube, MapPin, Phone, Mail } from 'lucide-react';

// IMPORTANT: Importing shadcn components as requested without implementation.
// This assumes these components exist in your project structure.
import { Button } from "@/components/ui/button";

const ViveroHomePage = () => {
    // Define brand colors for easier reuse in tailwind arbitrary values
    const colors = {
        darkGreen: '#2F3E2C', // Main text color, deep green
        mediumGreen: '#3A5A40', // Headers, accents
        lightBg: '#F8F5F0', // Main background cream
        accentBg: '#F2E8D9', // Secondary background beige
        terracotta: '#C06C45', // Buttons, highlights
    };

    return (
        <div className={`min-h-screen font-sans`} style={{ backgroundColor: colors.lightBg, color: colors.darkGreen }}>
            {/* Header */}
            <header className="py-4 px-6 md:px-12 flex justify-between items-center bg-white/80 backdrop-blur-sm fixed w-full z-10 top-0 border-b border-[#EDEAE4]">
                <div className="flex items-center gap-3">
                    {/* Logo Placeholder */}
                    <div style={{ backgroundColor: colors.mediumGreen }} className="w-10 h-10 rounded-full flex items-center justify-center">
                        <span className="text-white font-bold text-xl">V</span>
                    </div>
                    <div>
                        <h1 style={{ color: colors.mediumGreen }} className="text-xl font-bold leading-none">Vivero</h1>
                        <h2 style={{ color: colors.mediumGreen }} className="text-xl font-bold leading-none">El Roble</h2>
                    </div>
                </div>

                {/* Navigation - Desktop */}
                <nav className="hidden md:flex gap-8 font-medium">
                    <a href="#inicio" className="hover:text-[#C06C45] transition-colors">Inicio</a>
                    <a href="#plantas" className="hover:text-[#C06C45] transition-colors">Nuestras Plantas</a>
                    <a href="#servicios" className="hover:text-[#C06C45] transition-colors">Servicios</a>
                    <a href="#consejos" className="hover:text-[#C06C45] transition-colors">Consejos</a>
                    <a href="#contacto" className="hover:text-[#C06C45] transition-colors">Contacto</a>
                </nav>

                {/* Social Icons */}
                <div className="flex gap-2">
                    <Button variant="ghost" size="icon" className="hover:text-[#C06C45] hover:bg-transparent">
                        <Facebook className="h-5 w-5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="hover:text-[#C06C45] hover:bg-transparent">
                        <Instagram className="h-5 w-5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="hover:text-[#C06C45] hover:bg-transparent">
                        <Youtube className="h-5 w-5" />
                    </Button>
                </div>
            </header>

            {/* Hero Section */}
            <section id="inicio" className="relative h-[80vh] mt-16">
                <img
                    src="https://images.unsplash.com/photo-1466692476868-aef1dfb1e735?q=80&w=2070&auto=format&fit=crop"
                    alt="Greenhouse interior"
                    className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-black/30 flex flex-col justify-center items-center text-center text-white p-6">
                    <h2 className="text-4xl md:text-6xl font-bold mb-4 drop-shadow-lg">Traemos la naturaleza a tu hogar.</h2>
                    <p className="text-xl md:text-2xl font-medium drop-shadow-md">Tu vivero local experto.</p>
                </div>
            </section>

            {/* Main Categories Circles */}
            <section className="py-20 px-6 md:px-12 max-w-6xl mx-auto">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-12 justify-items-center">
                    <div className="text-center flex flex-col items-center gap-4">
                        <div className="w-48 h-48 rounded-full overflow-hidden shadow-lg">
                            <img src="https://images.unsplash.com/photo-1598887142487-3c854d5fc284?q=80&w=1976&auto=format&fit=crop" alt="Plantas de interior" className="w-full h-full object-cover" />
                        </div>
                        <h3 className="text-xl font-semibold">Plantas de Interior</h3>
                    </div>
                    <div className="text-center flex flex-col items-center gap-4">
                        <div className="w-48 h-48 rounded-full overflow-hidden shadow-lg">
                            <img src="https://images.unsplash.com/photo-1558435186-d31d12517037?q=80&w=1974&auto=format&fit=crop" alt="Jardín y exterior" className="w-full h-full object-cover" />
                        </div>
                        <h3 className="text-xl font-semibold">Jardín y Exterior</h3>
                    </div>
                    <div className="text-center flex flex-col items-center gap-4">
                        <div className="w-48 h-48 rounded-full overflow-hidden shadow-lg">
                            <img src="https://images.unsplash.com/photo-1463320898484-cdee8141c787?q=80&w=2070&auto=format&fit=crop" alt="Macetas y accesorios" className="w-full h-full object-cover" />
                        </div>
                        <h3 className="text-xl font-semibold">Macetas y Accesorios</h3>
                    </div>
                </div>
            </section>

            {/* Feature Section 1 (Interior Plants Illustration) */}
            <section style={{ backgroundColor: colors.accentBg }} className="py-20 px-6 md:px-12">
                <div className="max-w-6xl mx-auto flex flex-col-reverse md:flex-row items-center gap-12">
                    <div className="flex-1">
                        {/* Placeholder for illustration */}
                        <img src="https://i.imgur.com/yd36d7s.png" alt="Interior plants illustration" className="w-full max-w-md mx-auto drop-shadow-xl" />
                    </div>
                    <div className="flex-1 space-y-6">
                        <h2 style={{ color: colors.mediumGreen }} className="text-4xl font-bold font-serif">Plantas de Interior</h2>
                        <p className="text-lg leading-relaxed opacity-90">
                            Traemos la naturaleza a tu hogar. Consectetur adipiscing elit, caemos la naturaleza a tu hogar. Tu vivero local experto.
                        </p>
                        {/* Using Shadcn Button with custom color overrides via className */}
                        <Button className="rounded-full px-8 py-6 text-md font-semibold text-white shadow-md hover:shadow-lg transition-all" style={{ backgroundColor: colors.terracotta }}>
                            Vea lo nuestro
                        </Button>
                    </div>
                </div>
            </section>

            {/* Feature Section 2 (Traemos la planta) */}
            <section className="py-20 px-6 md:px-12">
                <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center gap-16">
                    <div className="flex-1 space-y-6">
                        <h2 style={{ color: colors.mediumGreen }} className="text-4xl font-bold font-serif leading-tight">Traemos la planta <br /> a tu hogar.</h2>
                        <p className="text-lg leading-relaxed opacity-90">
                            Treeme la natureza a tu hogar. Nabartiecar adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.
                        </p>
                        <Button className="rounded-full px-8 py-6 text-md font-semibold text-white shadow-md hover:shadow-lg transition-all" style={{ backgroundColor: colors.terracotta }}>
                            Conocenos
                        </Button>
                    </div>
                    <div className="flex-1 relative">
                        {/* Using a slightly different aspect ratio image for visual variety */}
                        <div className="aspect-[4/5] rounded-3xl overflow-hidden shadow-2xl">
                            <img src="https://images.unsplash.com/photo-1617173944883-664e4a7c3345?q=80&w=2070&auto=format&fit=crop" alt="Caring for plants" className="w-full h-full object-cover" />
                        </div>
                    </div>
                </div>
            </section>

            {/* Small Categories Row */}
            <section className="py-12 px-6 md:px-12 max-w-4xl mx-auto">
                <div className="grid grid-cols-3 gap-8 justify-items-center">
                    <div className="text-center flex flex-col items-center gap-3">
                        <div className="w-24 h-24 rounded-full overflow-hidden shadow-md">
                            <img src="https://images.unsplash.com/photo-1612363228079-e4263eb92e36?q=80&w=2070&auto=format&fit=crop" alt="Mini interior" className="w-full h-full object-cover" />
                        </div>
                        <h4 className="text-sm font-semibold">Plantas de Interior</h4>
                    </div>
                    <div className="text-center flex flex-col items-center gap-3">
                        <div className="w-24 h-24 rounded-full overflow-hidden shadow-md">
                            <img src="https://images.unsplash.com/photo-1585320806297-9794b3e4eeae?q=80&w=2071&auto=format&fit=crop" alt="Mini exterior" className="w-full h-full object-cover" />
                        </div>
                        <h4 className="text-sm font-semibold">Jardín y Exterior</h4>
                    </div>
                    <div className="text-center flex flex-col items-center gap-3">
                        <div className="w-24 h-24 rounded-full overflow-hidden shadow-md">
                            <img src="https://images.unsplash.com/photo-1515594937-5299325625e6?q=80&w=2056&auto=format&fit=crop" alt="Mini macetas" className="w-full h-full object-cover" />
                        </div>
                        <h4 className="text-sm font-semibold">Macetas y Accesorios</h4>
                    </div>
                </div>
            </section>

            {/* Estrella de la Temporada Section */}
            <section style={{ backgroundColor: colors.accentBg }} className="py-20 px-6 md:px-12 mb-12">
                <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center gap-12 relative">
                    <div className="flex-1 space-y-6 z-10">
                        <h2 style={{ color: colors.mediumGreen }} className="text-4xl font-bold font-serif">La Estrella de la Temporada</h2>
                        <p className="text-lg leading-relaxed opacity-90">
                            Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore.
                        </p>
                        <Button className="rounded-full px-8 py-6 text-md font-semibold text-white shadow-md hover:shadow-lg transition-all" style={{ backgroundColor: colors.terracotta }}>
                            Vea campaña
                        </Button>
                    </div>
                    <div className="flex-1 relative flex justify-center items-center">
                        {/* The terracotta circle background */}
                        <div className="absolute w-80 h-80 md:w-96 md:h-96 rounded-full" style={{ backgroundColor: colors.terracotta }}></div>
                        {/* The plant image on top */}
                        <div className="relative z-10 w-64 h-64 md:w-80 md:h-80 rounded-full overflow-hidden border-4 border-white shadow-xl">
                            <img src="https://images.unsplash.com/photo-1519479110683-0c2b3790b531?q=80&w=2070&auto=format&fit=crop" alt="Geranium plant" className="w-full h-full object-cover" />
                        </div>
                    </div>
                </div>
            </section>


            {/* Footer */}
            <footer style={{ backgroundColor: colors.mediumGreen }} className="text-white py-16 px-6 md:px-12">
                <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-12">

                    {/* Map Card */}
                    <div className="bg-white p-2 rounded-2xl shadow-lg overflow-hidden">
                        {/* Placeholder for Google Map iframe */}
                        <div className="w-full h-64 bg-gray-200 rounded-xl relative overflow-hidden">
                            <img src="https://i.imgur.com/8Y8YQ5S.png" alt="Map placeholder" className="w-full h-full object-cover opacity-80" />
                            <div className="absolute inset-0 flex items-center justify-center">
                                <Button style={{ backgroundColor: colors.terracotta }} className="text-white font-semibold shadow-md">
                                    Ver en Google Maps
                                </Button>
                            </div>
                        </div>
                    </div>

                    {/* Contact Info Links */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">
                        <div className="space-y-4">
                            <h4 className="font-bold text-lg mb-4">Home</h4>
                            <ul className="space-y-3 opacity-90">
                                <li className="hover:underline cursor-pointer flex items-center gap-2"><MapPin size={16} /> Direccion 11 base</li>
                                <li className="hover:underline cursor-pointer flex items-center gap-2"><Phone size={16} /> +01 234 567 890</li>
                                <li className="hover:underline cursor-pointer flex items-center gap-2"><Mail size={16} /> info@vivero.com</li>
                            </ul>
                        </div>
                        <div className="space-y-4">
                            <h4 className="font-bold text-lg mb-4">Contact</h4>
                            <ul className="space-y-3 opacity-90">
                                <li className="hover:underline cursor-pointer">Preguntas frecuentes</li>
                                <li className="hover:underline cursor-pointer">Envios y devoluciones</li>
                                <li className="hover:underline cursor-pointer">Terminos y condiciones</li>
                            </ul>
                        </div>
                        <div className="space-y-4">
                            <h4 className="font-bold text-lg mb-4">Social</h4>
                            <div className="flex gap-2">
                                <Button variant="ghost" size="icon" className="text-white hover:text-white hover:bg-white/20">
                                    <Facebook className="h-5 w-5" />
                                </Button>
                                <Button variant="ghost" size="icon" className="text-white hover:text-white hover:bg-white/20">
                                    <Instagram className="h-5 w-5" />
                                </Button>
                                <Button variant="ghost" size="icon" className="text-white hover:text-white hover:bg-white/20">
                                    <Youtube className="h-5 w-5" />
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>
                {/* Bottom bar */}
                <div style={{ backgroundColor: colors.terracotta }} className="mt-12 py-4 text-center text-sm font-medium opacity-90">
                    <p>Diseñado para Vivero El Roble © {new Date().getFullYear()}</p>
                </div>
            </footer>

        </div>
    );
};

export default ViveroHomePage;