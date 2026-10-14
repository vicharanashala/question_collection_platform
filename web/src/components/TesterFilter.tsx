import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type TesterFilterValue = "" | "only" | "exclude";

const OPTIONS: { value: TesterFilterValue; label: string }[] = [
  { value: "", label: "All accounts" },
  { value: "only", label: "Testers only" },
  { value: "exclude", label: "Exclude testers" },
];

interface TesterFilterProps {
  value: TesterFilterValue;
  onChange: (value: TesterFilterValue) => void;
}

// Dropdown to show only tester accounts, hide them, or show everything. An empty value means all.
export function TesterFilter({ value, onChange }: TesterFilterProps) {
  return (
    <Select
      value={value || "all"}
      onValueChange={(v) => onChange(v === "all" ? "" : (v as TesterFilterValue))}
    >
      <SelectTrigger className="w-full" aria-label="Filter by tester accounts">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {OPTIONS.map(({ value: optionValue, label }) => (
          <SelectItem key={optionValue || "all"} value={optionValue || "all"}>
            {label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
