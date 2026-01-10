import { EmptyState } from "@/components/EmptyState";
import { baseCellClassName, GradientPreview, Heatmap } from "@/components/Heatmap";
import { ProgressCounter } from "@/components/ProgressCounter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { mapValueToCSSrgba } from "@/lib/colorUtils";
import { ArrowRight, BarChart3, Dumbbell, Flame, Palette, Zap, CheckCircle2, Calendar, Settings, Trophy, Play } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { PerformanceCard } from "./tracker/StructuredHabitPanel";
import { StatCard } from "./tracker/Stats";
import { ICONS } from "./habits-configuration/IconField";
import { GRADIENT_PRESETS } from "./habits-configuration/ColorThemeField";
import { ColorStop } from "@trackbit/types";
import { cn } from "@/lib/utils";

export default function Landing() {
    return (
        <div className="min-h-screen flex flex-col bg-background text-foreground">
            {/* Hero Section */}
            <section className="relative  bg-linear-to-br from-primary/5 via-background to-secondary/5 py-24 md:py-32">
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
                            className="mt-40"
                            backgroundComponent={
                                <div className="w-full flex justify-center items-center perspective-normal ">
                                    <Heatmap className="relative  right-24  z-200 fade-left-1/2 -rotate-y-10 shadow-black shadow-2xl" />
                                </div>
                            }
                        />

                        <FeatureShowcaseCard
                            icon={<Palette className="h-12 w-12 text-primary mb-4" />}
                            textPosition="right"
                            className="mt-24"
                            title="Dynamic Gradient Progress"
                            description="Watch colors intensify as you approach goals, transforming daily effort into visible momentum and energy."
                            backgroundComponent={<GradientProgresBackground />}
                        />

                        <FeatureShowcaseCard
                            icon={<Palette className="h-12 w-12 text-primary mb-4" />}
                            title="Hybrid Habit & Workout Tracking"
                            description="Log simple check-ins, counts, or detailed sessions with sets, reps, weights, timers, and RPE—all in one unified dashboard."
                            backgroundComponent={<HybridTrackingBackground />}
                            className="mt-24"
                        />

                        <FeatureShowcaseCard
                            icon={<Palette className="h-12 w-12 text-primary mb-4" />}
                            title="Streak & Stats Dashboar"
                            description="Monitor current streaks, total completions, and long-term consistency with clear, motivating metrics."
                            backgroundComponent={<StatsBackground />}
                            textPosition="right"
                            className="mt-32"
                        />
                        {/* 
                        <FeatureShowcaseCard
                            icon={<Palette className="h-12 w-12 text-primary mb-4" />}
                            title="Optimistic, Instant UI"
                            description="Real-time updates and smooth animations provide immediate feedback, even on slower connections."
                            backgroundImageUrl=""
                            altText={""}
                        /> */}


                        <FeatureShowcaseCard
                            icon={<Palette className="h-12 w-12 text-primary mb-4" />}
                            title="Full Customization"
                            description="Choose icons, preset or custom gradients, and exercise categories. Built-in library with support for your own exercises."
                            backgroundComponent={<CustomizationBackground />}
                            altText={""} className="mt-24"
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
    altText?: string;
    className?: string;
}

const FeatureShowcaseCard = ({
    icon,
    title,
    description,
    textPosition = "left",
    backgroundImageUrl,
    altText,
    backgroundComponent: background,
    className,
}: FeatureShowcaseCardProps) => {


    return (
        <div className={cn("relative min-h-96 group transition-all duration-5000", className)}>
            {/* Background Image with subtle zoom on hover */}
            <div className="relative transition-transform duration-1000 group-hover:scale-102">
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

            </div>

            {/* Content Overlay */}
            <div

                className={`absolute ${textPosition === "left" ? "justify-self-start" : "justify-self-end"} bottom-1/2 translate-y-1/2 flex flex-col justify-end p-8 text-left  transition-all duration-500`}
            >
                <div className="space-y-4 transform transition-transform duration-1000 group-hover:translate-y-0 translate-y-4 text-shadow-[0px_0px_2em_var(--background)]">
                    <div className="flex items-center gap-4">
                        {icon}
                        <div className="text-2xl font-bold">{title}</div>
                    </div>
                    <div className="text-base text-foreground/90 max-w-md leading-relaxed">
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

    const colorStops: ColorStop[] = [
        { position: 0, color: [200, 185, 2, 0.05] },
        { position: 1, color: [200, 200, 0, 1] },
    ];

    const [counterVal, setCounterVal] = useState(1);

    useEffect(() => {
        const interval = setInterval(() => {
            setCounterVal((prev) => (prev + 1) % (5 + 1));
        }, 3000);

        return () => clearInterval(interval); // cleanup
    }, []);



    return (
        <div className="relative perspective-normal flex justify-center items-center h-full w-full fade-right-1/3 right-24 bottom-4 scale-110">
            <div className="rotate-y-25 flex flex-col gap-2">
                <ProgressCounter
                    value={counterVal}
                    goal={5}
                    colorString={mapValueToCSSrgba(counterVal, 0, 5, colorStops)}
                    onDecrement={() => setCounterVal(counterVal - 1)}
                    onIncrement={() => setCounterVal(counterVal + 1)}
                />
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
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
        </div>
    )
}

const HybridTrackingBackground = () => {

    const colorStops: ColorStop[] = [
        { position: 0, color: [100, 100, 100, 0.05] },
        { position: 1, color: [100, 100, 100, 1] },
    ];

    const performanceData = {
        createdAt: '',
        distance: '100',
        duration: 3600,
        exerciseLogId: 1,
        id: 1,
        number: 1,
        reps: 12,
        rpe: 7,
        weight: 25,
    }

    return (
        <div className="perspective-normal h-full w-full flex justify-end items-center">
            <div className="-rotate-y-10 fade-left w-124 m-l-auto">

                {/* Erxercise Habit */}
                <div className="flex overflow-x-auto gap-2 p-2">
                    <PerformanceCard
                        category="strength"
                        performance={performanceData}
                        index={0}
                        onUpdate={(e) => { }}
                        isSelected={false}
                        onHeaderClick={() => { }}
                    />
                    <PerformanceCard
                        category="strength"
                        performance={performanceData}
                        index={1}
                        onUpdate={(e) => { }}
                        isSelected={false}
                        onHeaderClick={() => { }}
                    />
                    <PerformanceCard
                        category="strength"
                        performance={performanceData}
                        index={2}
                        onUpdate={(e) => { }}
                        isSelected={false}
                        onHeaderClick={() => { }}
                    />
                    <EmptyState
                        description="New Set"
                        onClick={() => { }}
                        className="w-26 py-0"
                        icon={Play}
                    />
                </div>

                {/* Simple Habit */}
                <div className="p-6 border-t border-border bg-card text-card-foreground rounded-b-xl animate-in fade-in slide-in-from-top-2 duration-300">
                    <div className="flex items-center justify-between gap-6">

                        {/* Left: Context Info */}
                        <div className="flex-1">
                            <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
                                Wednesday

                                <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400 animate-in zoom-in">
                                    <Trophy className="w-3 h-3 mr-1" /> Goal Met
                                </span>

                            </h3>
                            <p className="text-sm text-muted-foreground mt-1">
                                {3} / {3}  completed
                            </p>
                        </div>

                        {/* Center: The Progress Ring Controls */}

                        <ProgressCounter
                            value={3}
                            goal={3}
                            colorString={mapValueToCSSrgba(3, 0, 3, colorStops)}
                            onDecrement={() => { }}
                            onIncrement={() => { }}
                        />



                    </div>
                </div>


                <div className="flex  gap-2 p-2">
                    <PerformanceCard
                        category="cardio"
                        performance={performanceData}
                        index={0}
                        onUpdate={(e) => { }}
                        isSelected={false}
                        onHeaderClick={() => { }}
                    />
                    <PerformanceCard
                        category="cardio"
                        performance={performanceData}
                        index={1}
                        onUpdate={(e) => { }}
                        isSelected={false}
                        onHeaderClick={() => { }}
                    />
                    <PerformanceCard
                        category="cardio"
                        performance={performanceData}
                        index={2}
                        onUpdate={(e) => { }}
                        isSelected={false}
                        onHeaderClick={() => { }}
                    />
                    <PerformanceCard
                        category="cardio"
                        performance={performanceData}
                        index={3}
                        onUpdate={(e) => { }}
                        isSelected={false}
                        onHeaderClick={() => { }}
                    />

                </div>

            </div>
        </div>
    )
}

const StatsBackground = () => {
    return (
        <div className="perspective-normal">
            <div className="grid grid-cols-1 grid-row[1fr_1fr_1fr] items-stretch gap-4 p-6 rotate-y-10 fade-right">
                <StatCard
                    title="Total Completions"
                    value={242}
                    icon={<CheckCircle2 className="w-5 h-5 text-emerald-500" />}
                />
                <StatCard
                    title="Current Streak"
                    value={17}
                    icon={<Flame className="w-5 h-5 text-orange-500" />}
                    trend={"Keep the fire burning!"}
                />
                <StatCard
                    title="Goal Frequency"
                    value={20}
                    icon={<BarChart3 className="w-5 h-5 text-blue-500" />}
                    trend="Consistency over time"
                />
            </div>
        </div>
    )
}

const CustomizationBackground = () => {

    const jumpAt = 3

    return (
        <div className="perspective-normal flex justify-end items-center">
            <div className="grid scale-150 gap-2 -rotate-y-10 fade-left relative right-4" style={{ gridTemplateColumns: `repeat(${jumpAt + 1}, min-content)` }}>
                {ICONS.map(({ id, icon: Icon }, i) => {


                    const jump = (i + 1) % jumpAt === 0


                    const gradientPreviews = Object.values(GRADIENT_PRESETS).map((e, i) => {
                        return (
                            <GradientPreview
                                key={i}
                                stops={e.stops}
                                cellSize="md"
                            />
                        )
                    })

                    return (
                        <>
                            <Button
                                key={id}
                                // onClick={() => {}}
                                type="button"
                                variant="outline"
                                size="icon-sm"
                                title={id}
                            >
                                {Icon && <Icon className="w-5 h-5" />}
                            </Button>
                            {jump && gradientPreviews[((i + 1) / jumpAt) - 1]}
                        </>
                    )
                })}
            </div>
        </div>
    )
}