import { dateCellBaseClassName, Heatmap } from "@/components/Heatmap";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { mapValueToCSSrgba } from "@/lib/colorUtils";
import { ArrowRight, BarChart3, Dumbbell, Flame, Palette, Zap, CheckCircle2, Calendar, Settings } from "lucide-react";
import { Link } from "react-router-dom";

export default function Landing() {
    return (
        <div className="min-h-screen flex flex-col bg-background text-foreground">
            {/* Hero Section */}
            <section className="relative  bg-gradient-to-br from-primary/5 via-background to-secondary/5 py-24 md:py-32">
                <div className="container mx-auto px-6 text-center">
                    <h1 className="text-5xl md:text-6xl font-bold tracking-tight mb-6">
                        Build Unbreakable Habits.<br />Track Smarter Workouts.
                    </h1>
                    <p className="text-xl md:text-2xl text-muted-foreground max-w-3xl mx-auto mb-10">
                        Trackbit combines intuitive habit tracking with professional-grade workout logging in one modern, visually motivating app. See your consistency grow with GitHub-style heatmaps and dynamic gradient progress.
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
                    <div className="">

                        <FeatureShowcaseCard
                            icon={<Calendar className="h-12 w-12 text-primary mb-4" />}
                            title="GitHub-Style Heatmaps"
                            description="Visualize over a year of consistency with interactive, color-coded heatmaps that motivate you to maintain streaks."
                            altText={""}
                            backgroundComponent={
                                <div className="absolute inset-0 flex justify-center items-center perspective-normal ">
                                    <Heatmap className="relative  right-24  z-200 fade-left-1/2 -rotate-y-10 shadow-black shadow-2xl" />
                                </div>
                            }
                        />

                        <FeatureShowcaseCard
                            icon={<Palette className="h-12 w-12 text-primary mb-4" />}
                            textPosition="right"
                            title="Dynamic Gradient Progress"
                            description="Watch colors intensify as you approach goals, transforming daily effort into visible momentum and energy."
                            backgroundComponent={<GradientProgresBackground />}
                            altText={""}
                        />

                        <FeatureShowcaseCard
                            icon={<Palette className="h-12 w-12 text-primary mb-4" />}
                            title="Hybrid Habit & Workout Tracking"
                            description="Log simple check-ins, counts, or detailed sessions with sets, reps, weights, timers, and RPE—all in one unified dashboard."
                            backgroundImageUrl=""
                            altText={""}
                        />

                        <FeatureShowcaseCard
                            icon={<Palette className="h-12 w-12 text-primary mb-4" />}
                            title="Streak & Stats Dashboar"
                            description="Monitor current streaks, total completions, and long-term consistency with clear, motivating metrics."
                            backgroundImageUrl=""
                            altText={""}
                        />

                        <FeatureShowcaseCard
                            icon={<Palette className="h-12 w-12 text-primary mb-4" />}
                            title="Optimistic, Instant UI"
                            description="Real-time updates and smooth animations provide immediate feedback, even on slower connections."
                            backgroundImageUrl=""
                            altText={""}
                        />


                        <FeatureShowcaseCard
                            icon={<Palette className="h-12 w-12 text-primary mb-4" />}
                            title="Full Customization"
                            description="Choose icons, preset or custom gradients, and exercise categories. Built-in library with support for your own exercises."
                            backgroundImageUrl=""
                            altText={""}
                        />

                    </div>
                </div>
            </section>


            {/* Final CTA */}
            <section className="py-20 bg-primary text-primary-foreground">
                <div className="container mx-auto px-6 text-center">
                    <h2 className="text-4xl font-bold mb-6">Ready to Build Momentum?</h2>
                    <p className="text-xl mb-10 max-w-2xl mx-auto">
                        Join the beta now and transform your habits and workouts with visual motivation and seamless tracking.
                    </p>
                    <Button asChild size="lg" variant="secondary" className="group">
                        <Link to="/auth">
                            Start Tracking Free
                            <ArrowRight className="ml-2 h-5 w-5 transition-transform group-hover:translate-x-1" />
                        </Link>
                    </Button>
                </div>
            </section>

            {/* Footer */}
            <footer className="py-10 border-t border-border">
                <div className="container mx-auto px-6 text-center text-sm text-muted-foreground">
                    <p>© 2026 Trackbit. Distributed under the MIT License.</p>
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






interface FeatureShowcaseCardProps {
    icon: React.ReactNode;
    title: string;
    description: string;
    textPosition?: "left" | "right";
    backgroundImageUrl?: string; // URL to the screenshot or placeholder image
    backgroundComponent?: React.ReactNode; // Custom background component
    altText: string;
}

const FeatureShowcaseCard = ({
    icon,
    title,
    description,
    textPosition = "left",
    backgroundImageUrl,
    altText,
    backgroundComponent: background,
}: FeatureShowcaseCardProps) => {


    return (
        <div className="relative  h-96 group cursor-pointer transition-all duration-500 hover:shadow-2xl">
            {/* Background Image with subtle zoom on hover */}
            <div className="absolute inset-0 transition-transform duration-700 group-hover:scale-110">
                {
                    background ?
                        background
                        : backgroundImageUrl ?
                            <img
                                src={backgroundImageUrl}
                                alt={altText}
                                className="w-full h-full object-cover"
                            />
                            :
                            null
                }
                {/* Dark overlay for better text readability */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
            </div>

            {/* Content Overlay */}
            <div

                className={`${textPosition === "left" ? "justify-self-start" : "justify-self-end"} relative h-full flex flex-col justify-end p-8 text-left text-white transition-all duration-500`}
            >
                <div className="space-y-4 transform transition-transform duration-500 group-hover:translate-y-0 translate-y-4">
                    <div className="flex items-center gap-4">
                        {icon}
                        <div className="text-2xl font-bold">{title}</div>
                    </div>
                    <div className="text-base text-white/90 max-w-md leading-relaxed">
                        {description}
                    </div>
                </div>
            </div>


        </div>
    );
};



const GradientProgresBackground = () => {

    const minValue = 0;
    const maxValue = 1;

    const colorStops = [
        { position: 0, color: [200, 185, 2, 0] },
        { position: 1, color: [200, 200, 0, 1] },
    ];





    return (
        <div className="relative perspective-normal flex justify-center items-center h-full w-full">
            <div className="rotate-y-25 flex gap-2 text-xs text-muted-foreground">
                <span>Less</span>
                {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
                    const val = minValue + ratio * (maxValue - minValue);
                    return (
                        <div key={ratio} className="w-5 h-5 rounded-[25%] border border-border shadow-sm bg-muted/25">
                            <div
                                className="w-full h-full rounded-[25%]"
                                style={{ backgroundColor: mapValueToCSSrgba(ratio, 0, 1, colorStops) }}
                            />
                        </div>
                    );
                })}
                <span>More</span>
            </div>
        </div>
    )
}