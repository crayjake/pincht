import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/tiptap-ui-primitive/button";
import { Input } from "@/components/tiptap-ui-primitive/input";
import {
    DropdownMenu,
    DropdownMenuTrigger,
    DropdownMenuContent,
    DropdownMenuLabel,
    DropdownMenuGroup,
    DropdownMenuItem,
} from "@/components/tiptap-ui-primitive/dropdown-menu";
import { SearchIcon } from "@/components/tiptap-icons/search-icon";
import { CloseIcon } from "@/components/tiptap-icons/close-icon";
import { ChevronDownIcon } from "@/components/tiptap-icons/chevron-down-icon";

const filterOptions = [
    { label: "Category", options: ["Climbing", "Rehab", "Training", "Sleep", "Goals"] },
    { label: "Date", options: ["Today", "This week", "This month"] },
];

export function HomeFilters() {
    const [searchOpen, setSearchOpen] = useState(false);
    const [query, setQuery] = useState("");
    const [filters, setFilters] = useState<Record<string, string>>({});
    const searchButtonRef = useRef<HTMLButtonElement>(null);
    const searchInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (searchOpen) searchInputRef.current?.focus();
    }, [searchOpen]);

    const closeSearch = () => {
        setSearchOpen(false);
        setQuery("");
        searchButtonRef.current?.focus();
    };

    return (
        <div className="filter" data-search-open={searchOpen} role="search" aria-label="Journal search and filters">
            <div
                className="filter-search"
                onBlur={event => {
                    if (!event.currentTarget.contains(event.relatedTarget) && !query.trim()) {
                        setSearchOpen(false);
                    }
                }}
            >
                <Button
                    ref={searchButtonRef}
                    variant="ghost"
                    aria-label="Search journal"
                    aria-expanded={searchOpen}
                    onClick={() => setSearchOpen(true)}
                >
                    <SearchIcon className="tiptap-button-icon" />
                </Button>
                <div className="filter-search-fields" inert={!searchOpen}>
                    <Input
                        ref={searchInputRef}
                        type="search"
                        aria-label="Search journal"
                        placeholder="Search journal…"
                        value={query}
                        onChange={event => setQuery(event.target.value)}
                        onKeyDown={event => {
                            if (event.key === "Escape") closeSearch();
                        }}
                    />
                    <Button variant="ghost" aria-label="Close search" onClick={closeSearch}>
                        <CloseIcon className="tiptap-button-icon" />
                    </Button>
                </div>
            </div>

            <div className="filter-options">
                {filterOptions.map(({ label, options }) => {
                    const value = filters[label] ?? "";
                    const selectFilter = (next: string) => {
                        setFilters(current => ({ ...current, [label]: next }));
                    };
                    return value ? (
                        <Button
                            key={label}
                            className="filter-pill"
                            variant="secondary"
                            aria-label={`Clear ${label.toLowerCase()} filter: ${value}`}
                            onClick={() => selectFilter("")}
                        >
                            <span className="tiptap-button-text">{value}</span>
                            <CloseIcon className="tiptap-button-icon" />
                        </Button>
                    ) : (
                        <DropdownMenu key={label}>
                            <DropdownMenuTrigger asChild>
                                <Button className="filter-pill" variant="outline" aria-label={`Filter by ${label.toLowerCase()}`}>
                                    <span className="tiptap-button-text">{label}</span>
                                    <ChevronDownIcon className="tiptap-button-dropdown-small" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent>
                                <DropdownMenuLabel>{label}</DropdownMenuLabel>
                                <DropdownMenuGroup>
                                    {options.map(option => (
                                        <DropdownMenuItem key={option} asChild onSelect={() => selectFilter(option)}>
                                            <Button variant="ghost" showTooltip={false}>
                                                <span className="tiptap-button-text">{option}</span>
                                            </Button>
                                        </DropdownMenuItem>
                                    ))}
                                </DropdownMenuGroup>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    );
                })}
            </div>
        </div>
    );
}
