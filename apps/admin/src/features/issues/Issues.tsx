import * as React from "react";
import { Bug, MessageSquare, CircleDot } from "lucide-react";
import {
    Tabs,
    TabsList,
    TabsTrigger,
    TabsContent,
    Badge,
    AdminPage,
} from "@trackbit/ui";
import { Loader2 } from "lucide-react";

import { useAdminIssues, AdminIssue } from "./use-admin-issues";
import { IssueTable } from "./components/IssueTable";

type TabKey = "all" | "open" | "resolved" | "closed";

const TABS: { value: TabKey; label: string; icon: React.ReactNode }[] = [
    { value: "all", label: "All", icon: <CircleDot className="w-4 h-4" /> },
    { value: "open", label: "Open", icon: <Bug className="w-4 h-4" /> },
    { value: "resolved", label: "Resolved", icon: <MessageSquare className="w-4 h-4" /> },
    { value: "closed", label: "Closed", icon: <MessageSquare className="w-4 h-4" /> },
];

function filterByTab(issues: AdminIssue[], tab: TabKey): AdminIssue[] {
    if (tab === "all") return issues;
    return issues.filter((i) => i.status === tab);
}

export default function IssuesPage() {
    const { issues, isLoading, updateStatus } = useAdminIssues();
    const [activeTab, setActiveTab] = React.useState<TabKey>("all");

    const handleStatusChange = React.useCallback(
        (id: number, status: AdminIssue["status"]) => updateStatus({ id, status }),
        [updateStatus]
    );

    const counts = React.useMemo(
        () => ({
            all: issues.length,
            open: issues.filter((i) => i.status === "open").length,
            resolved: issues.filter((i) => i.status === "resolved").length,
            closed: issues.filter((i) => i.status === "closed").length,
        }),
        [issues]
    );

    return (
        <AdminPage
            title="Issues"
            description="Track and triage bugs and feedback submitted by users."
        >
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TabKey)}>
                <TabsList>
                    {TABS.map(({ value, label, icon }) => (
                        <TabsTrigger key={value} value={value} className="flex items-center gap-2">
                            {icon}
                            {label}
                            {!isLoading && (
                                <Badge variant="secondary" className="ml-1 text-xs">
                                    {counts[value]}
                                </Badge>
                            )}
                        </TabsTrigger>
                    ))}
                </TabsList>

                <div className="mt-4">
                    {isLoading ? (
                        <div className="flex items-center justify-center py-16 text-muted-foreground">
                            <Loader2 className="w-6 h-6 animate-spin mr-2" /> Loading issues...
                        </div>
                    ) : (
                        TABS.map(({ value }) => (
                            <TabsContent key={value} value={value}>
                                <IssueTable
                                    data={filterByTab(issues, value)}
                                    onStatusChange={handleStatusChange}
                                />
                            </TabsContent>
                        ))
                    )}
                </div>
            </Tabs>
        </AdminPage>
    );
}
