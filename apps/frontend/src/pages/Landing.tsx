import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowRight, BarChart3, Dumbbell, Flame, Palette, Zap } from "lucide-react";
import { Link } from "react-router-dom";

export default function Landing() {
    return (
        <div className="min-h-screen flex flex-col bg-background text-foreground">
            {/* Hero Section */}
            <section className="relative overflow-hidden bg-gradient-to-br from-primary/5 via-background to-secondary/5 py-24 md:py-32">
                <div className="container mx-auto px-6 text-center">
                    <h1 className="text-5xl md:text-6xl font-bold tracking-tight mb-6">
                        Build Stronger Habits.<br />Track Smarter Workouts.
                    </h1>
                    <p className="text-xl md:text-2xl text-muted-foreground max-w-3xl mx-auto mb-10">
                        Trackbit bridges simple habit tracking and detailed workout logging in one intelligent, modern app. Visualize your consistency with GitHub-style heatmaps and gradient progress.
                    </p>
                    <div className="flex flex-col sm:flex-row gap-4 justify-center">
                        <Button asChild size="lg" className="group">
                            <Link to="/auth">
                                Get Started Free
                                <ArrowRight className="ml-2 h-5 w-5 transition-transform group-hover:translate-x-1" />
                            </Link>
                        </Button>
                        <Button asChild size="lg" variant="outline">
                            <a href="https://github.com/yourusername/trackbit" target="_blank" rel="noopener noreferrer">
                                View on GitHub
                            </a>
                        </Button>
                    </div>
                </div>
            </section>

            {/* Feature Highlights */}
            <section className="py-20 bg-muted/50">
                <div className="container mx-auto px-6">
                    <h2 className="text-4xl font-bold text-center mb-12">Powerful Features for Real Progress</h2>
                    <div className="grid md:grid-cols-3 gap-8">
                        <Card>
                            <CardHeader>
                                <BarChart3 className="h-12 w-12 text-primary mb-4" />
                                <CardTitle>Interactive Heatmaps</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <CardDescription>
                                    Visualize your consistency with dynamic, GitHub-style heatmaps that motivate you to stay on track.
                                </CardDescription>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <Palette className="h-12 w-12 text-primary mb-4" />
                                <CardTitle>Gradient Progress</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <CardDescription>
                                    Watch colors intensify as you approach daily goals—turning progress into visual energy.
                                </CardDescription>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <Dumbbell className="h-12 w-12 text-primary mb-4" />
                                <CardTitle>Hybrid Tracking</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <CardDescription>
                                    Seamlessly log simple habits or detailed workouts with sets, reps, and weights in one unified dashboard.
                                </CardDescription>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <Zap className="h-12 w-12 text-primary mb-4" />
                                <CardTitle>Optimistic UI</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <CardDescription>
                                    Instant feedback with real-time updates—feel the speed even on slower connections.
                                </CardDescription>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <Flame className="h-12 w-12 text-primary mb-4" />
                                <CardTitle>Exercise Library</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <CardDescription>
                                    Access a built-in database of exercises, with full support for custom creations.
                                </CardDescription>
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </section>

            {/* Visual Showcase */}
            <section className="py-20">
                <div className="container mx-auto px-6">
                    <h2 className="text-4xl font-bold text-center mb-12">See Trackbit in Action</h2>
                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
                        {/* Placeholder Images – Replace with actual screenshots */}
                        <img src="https://preview.redd.it/track-your-study-time-like-github-style-heatmap-v0-1hsjf5yg8ylf1.png?auto=webp&s=244851854facc48cf8f0d1116fcda13ca61ab9b0" alt="GitHub-style heatmap example" className="rounded-lg shadow-lg object-cover w-full h-auto" />
                        <img src="https://i.redd.it/i-rebuilt-my-habit-tracker-and-added-a-real-github-style-v0-cg5lry2ctd6g1.png?width=2560&format=png&auto=webp&s=bb89aaa77c9d9e17762c7261b35466209a7ad6de" alt="Habit tracker heatmap" className="rounded-lg shadow-lg object-cover w-full h-auto" />
                        <img src="https://media1.popsugar-assets.com/files/thumbor/RHzm9EWowgJmXmgyGhnzWhOcyeE=/fit-in/1996x1010/top/filters:format_auto():extract_cover():upscale()/2022/04/21/247/n/47737404/d27d321157df83d5_Screenshot_229_.png" alt="Workout logging interface" className="rounded-lg shadow-lg object-cover w-full h-auto" />
                        <img src="https://s3-alpha.figma.com/hub/file/2243900476047944441/7649432c-2bcc-4be2-af75-8b5ff5f0aab7-cover.png" alt="Modern fitness dashboard" className="rounded-lg shadow-lg object-cover w-full h-auto" />
                        <img src="https://getfitoapp.com/wp-content/uploads/2025/08/IMG_0130-1024x723.jpg" alt="Gym log example" className="rounded-lg shadow-lg object-cover w-full h-auto" />
                        <img src="https://cdn.dribbble.com/userupload/43659146/file/original-c89a290310afe27d7edf71c4a6ebf863.png?format=webp&resize=400x300&vertical=center" alt="Gradient progress visualization" className="rounded-lg shadow-lg object-cover w-full h-auto" />
                    </div>
                    <p className="text-center text-muted-foreground mt-8">Beta version—actual screenshots coming soon.</p>
                </div>
            </section>

            {/* Final CTA */}
            <section className="py-20 bg-primary text-primary-foreground">
                <div className="container mx-auto px-6 text-center">
                    <h2 className="text-4xl font-bold mb-6">Ready to Level Up Your Tracking?</h2>
                    <p className="text-xl mb-10 max-w-2xl mx-auto">
                        Join the beta and start building unbreakable habits and stronger workouts today.
                    </p>
                    <Button asChild size="lg" variant="secondary" className="group">
                        <Link to="/auth">
                            Start Tracking Now
                            <ArrowRight className="ml-2 h-5 w-5 transition-transform group-hover:translate-x-1" />
                        </Link>
                    </Button>
                </div>
            </section>

            {/* Footer */}
            <footer className="py-10 border-t border-border">
                <div className="container mx-auto px-6 text-center text-sm text-muted-foreground">
                    <p>© 2025 Trackbit. Distributed under the MIT License.</p>
                    <p className="mt-2">
                        <a href="https://github.com/yourusername/trackbit" target="_blank" rel="noopener noreferrer" className="underline hover:text-foreground">
                            GitHub Repository
                        </a>
                    </p>
                </div>
            </footer>
        </div>
    );
}