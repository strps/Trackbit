import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { DateTime } from 'luxon';

interface AppointmentFormData {
    date: Date | undefined;
    time: string;
    name: string;
    email: string;
    notes: string;
}

export function AppointmentWizard() {
    const [step, setStep] = useState(1);
    const [formData, setFormData] = useState<AppointmentFormData>({
        date: undefined,
        time: '',
        name: '',
        email: '',
        notes: '',
    });

    const updateFormData = (key: keyof AppointmentFormData, value: any) => {
        setFormData((prev) => ({ ...prev, [key]: value }));
    };

    const handleNext = () => setStep((prev) => prev + 1);
    const handleBack = () => {
        if (step === 2) updateFormData('time', '');
        setStep((prev) => prev - 1);
    };

    const formatDisplayDate = (date: Date) =>
        DateTime.fromJSDate(date).toLocaleString(DateTime.DATE_MED_WITH_WEEKDAY);

    const getAvailableTimes = (): string[] => {
        if (!formData.date) return [];

        const dt = DateTime.fromJSDate(formData.date).setZone('America/Costa_Rica');

        // No appointments on weekends or past dates
        if (dt.weekday > 5 || dt < DateTime.now().startOf('day')) return [];

        return [
            '09:00 AM',
            '10:30 AM',
            '02:00 PM',
            '03:30 PM',
            '04:30 PM',
        ];
    };

    const times = getAvailableTimes();

    const renderStep = () => {
        switch (step) {
            case 1:
                return (
                    <div className="space-y-4">
                        <Label>Select Appointment Date</Label>
                        <Popover>
                            <PopoverTrigger asChild>
                                <Button
                                    variant="outline"
                                    className={cn(
                                        'w-full justify-start text-left font-normal',
                                        !formData.date && 'text-muted-foreground'
                                    )}
                                >
                                    {formData.date ? formatDisplayDate(formData.date) : <span>Pick a date</span>}
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0">
                                <Calendar
                                    mode="single"
                                    selected={formData.date}
                                    onSelect={(date) => {
                                        updateFormData('date', date);
                                        updateFormData('time', '');
                                    }}
                                    disabled={(date) => {
                                        const dt = DateTime.fromJSDate(date).setZone('America/Costa_Rica');
                                        return dt.weekday > 5 || dt < DateTime.now().startOf('day');
                                    }}
                                    initialFocus
                                />
                            </PopoverContent>
                        </Popover>
                        <Button onClick={handleNext} disabled={!formData.date}>
                            Next
                        </Button>
                    </div>
                );

            case 2:
                return (
                    <div className="space-y-4">
                        <Label>Select Available Time Slot</Label>
                        {times.length > 0 ? (
                            <Select value={formData.time} onValueChange={(v) => updateFormData('time', v)}>
                                <SelectTrigger className="w-full">
                                    <SelectValue placeholder="Choose a time" />
                                </SelectTrigger>
                                <SelectContent>
                                    {times.map((time) => (
                                        <SelectItem key={time} value={time}>
                                            {time}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        ) : (
                            <p className="text-muted-foreground text-sm">
                                No available time slots for this date.
                            </p>
                        )}
                        <div className="flex justify-between">
                            <Button variant="outline" onClick={handleBack}>
                                Back
                            </Button>
                            <Button onClick={handleNext} disabled={!formData.time}>
                                Next
                            </Button>
                        </div>
                    </div>
                );

            // ... (steps 3 and 4 unchanged except date formatting)
            case 3:
                return (
                    <div className="space-y-4">
                        <div>
                            <Label htmlFor="name">Full Name</Label>
                            <Input id="name" value={formData.name} onChange={(e) => updateFormData('name', e.target.value)} />
                        </div>
                        <div>
                            <Label htmlFor="email">Email Address</Label>
                            <Input id="email" type="email" value={formData.email} onChange={(e) => updateFormData('email', e.target.value)} />
                        </div>
                        <div>
                            <Label htmlFor="notes">Additional Notes</Label>
                            <Input id="notes" value={formData.notes} onChange={(e) => updateFormData('notes', e.target.value)} />
                        </div>
                        <div className="flex justify-between">
                            <Button variant="outline" onClick={handleBack}>Back</Button>
                            <Button onClick={handleNext} disabled={!formData.name || !formData.email}>
                                Next
                            </Button>
                        </div>
                    </div>
                );

            case 4:
                return (
                    <div className="space-y-4">
                        <p><strong>Date:</strong> {formData.date ? formatDisplayDate(formData.date) : 'N/A'}</p>
                        <p><strong>Time:</strong> {formData.time || 'N/A'}</p>
                        <p><strong>Name:</strong> {formData.name}</p>
                        <p><strong>Email:</strong> {formData.email}</p>
                        <p><strong>Notes:</strong> {formData.notes || 'None'}</p>
                        <div className="flex justify-between">
                            <Button variant="outline" onClick={handleBack}>Back</Button>
                            <Button onClick={() => {
                                console.log('Appointment submitted:', formData);
                                alert('Appointment confirmed!');
                            }}>
                                Confirm Appointment
                            </Button>
                        </div>
                    </div>
                );

            default: return null;
        }
    };

    return (
        <Card className="w-full max-w-md mx-auto">
            <CardHeader>
                <CardTitle>Appointment Wizard — Step {step} of 4</CardTitle>
            </CardHeader>
            <CardContent>{renderStep()}</CardContent>
        </Card>
    );
}