import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type UserTypeFilterValue = "" | "anveshan" | "regular";

const OPTIONS: { value: UserTypeFilterValue; label: string }[] = [
  { value: "", label: "All Users" },
  { value: "anveshan", label: "Anveshan Users" },
  { value: "regular", label: "Regular Users" },
];

interface UserTypeFilterProps {
  value: UserTypeFilterValue;
  onChange: (value: UserTypeFilterValue) => void;
}

// Dropdown to filter questions by submitter type. An empty value means all users.
export function UserTypeFilter({ value, onChange }: UserTypeFilterProps) {
  return (
    <Select
      value={value || "all"}
      onValueChange={(v) => onChange(v === "all" ? "" : (v as UserTypeFilterValue))}
    >
      <SelectTrigger className="w-full" aria-label="Filter by user type">
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
