import { Button } from "@/components/ui/button"
import { format } from "date-fns"
import { useState } from "react"
import { DateTime } from "luxon"

export const Exp = () => {

    const [value, setValue] = useState(new Date())

    const [input, setInput] = useState('')

    const handleClick = () => {
        setValue(new Date())
    }

    const handleClickInput = () => {
        setValue(new Date(input))
    }

    const localDate = '2026-01-14T00:00:00.000-02:00';

    const datesFormats = [
        {
            name: 'date-fns format YYYY-MM-DD',
            format: format(value, 'yyyy-MM-dd'),
        },
        {
            name: 'JSON.stringify date',
            format: JSON.stringify(value, null, 2),
        },
        {
            name: 'toISOString',
            format: value.toISOString(),
        },
        {
            name: 'Local Date',
            format: localDate
        },
        {
            name: 'Local Date Utc date',
            format: DateTime.fromISO(localDate).toUTC().toISODate()
        }
    ]

    return (
        <div className="conatiner flex flex-col gap-4 justify-center items-center w-full">
            {Intl.DateTimeFormat().resolvedOptions().timeZone}
            <div className="flex gap-2">
                <Button
                    onClick={handleClick}
                >
                    Now
                </Button>
                <Button
                    onClick={handleClickInput}
                >
                    Input
                </Button>
            </div>
            <input type="datetime-local" value={input} onChange={e => setInput(e.target.value)} />

            <h2>Date()</h2>
            <div className="grid grid-cols-2 ">

                {datesFormats.map(f => (
                    <>
                        <div className="p-2 border" key={f.name}>
                            {f.name}
                        </div>
                        <div className="p-2 border" key={f.name + 2}>
                            {f.format}
                        </div>
                    </>
                ))
                }
            </div>

        </div>
    )

}