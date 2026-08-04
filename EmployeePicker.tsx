/**
 * EmployeePicker – searchable dropdown to pick one employee from the user directory.
 * Returns the selected user's _id, name, jobTitle.
 */
import { useState, useRef, useEffect } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import type { Id } from "@/convex/_generated/dataModel.d.ts";
import { Input } from "@/components/ui/input.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Avatar, AvatarFallback } from "@/components/ui/avatar.tsx";
import { Search, X, User } from "lucide-react";
import { useDebounce } from "@/hooks/use-debounce.ts";
import { cn } from "@/lib/utils.ts";

export type PickedEmployee = {
  _id: Id<"users">;
  name: string;
  jobTitle?: string;
  department?: string;
};

type Props = {
  value: PickedEmployee | null;
  onChange: (emp: PickedEmployee | null) => void;
  placeholder?: string;
  className?: string;
};

export default function EmployeePicker({ value, onChange, placeholder = "Cari karyawan...", className }: Props) {
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [debouncedSearch] = useDebounce(search, 300);
  const containerRef = useRef<HTMLDivElement>(null);

  const employees = useQuery(api.users.listEmployees, { search: debouncedSearch, department: "" });

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const select = (emp: PickedEmployee) => {
    onChange(emp);
    setSearch("");
    // Jangan tutup dropdown — biarkan tetap terbuka agar user bisa langsung
    // tambah orang berikutnya tanpa klik ulang (misalnya untuk daftar pemeriksa).
    // Untuk single-select (penyetuju), setelah dipilih input hilang diganti nama,
    // sehingga open=true tidak berpengaruh.
  };

  const clear = () => {
    onChange(null);
    setSearch("");
  };

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      {value ? (
        <div className="flex items-center gap-2 rounded-md border bg-muted/40 px-3 py-2">
          <Avatar className="h-6 w-6 shrink-0">
            <AvatarFallback className="text-[10px]">
              {value.name.charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium leading-tight">{value.name}</p>
            {value.jobTitle && (
              <p className="truncate text-xs text-muted-foreground leading-tight">{value.jobTitle}</p>
            )}
          </div>
          <Button type="button" size="icon" variant="ghost" className="h-6 w-6 shrink-0" onClick={clear}>
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      ) : (
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-8"
            placeholder={placeholder}
            value={search}
            onChange={(e) => { setSearch(e.target.value); setOpen(true); }}
            onFocus={() => setOpen(true)}
            onClick={() => setOpen(true)}
          />
        </div>
      )}

      {/* Dropdown */}
      {open && !value && (
        <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover shadow-md max-h-60 overflow-y-auto">
          {employees === undefined ? (
            <div className="p-3 text-xs text-muted-foreground text-center">Memuat...</div>
          ) : employees.length === 0 ? (
            <div className="p-3 text-xs text-muted-foreground text-center">Tidak ada hasil</div>
          ) : (
            employees.map((emp) => (
              <button
                key={emp._id}
                type="button"
                className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-muted transition-colors"
                onMouseDown={(e) => { e.preventDefault(); select({ _id: emp._id, name: emp.name ?? "", jobTitle: emp.jobTitle, department: emp.department }); }}
              >
                <Avatar className="h-7 w-7 shrink-0">
                  <AvatarFallback className="text-xs">
                    {(emp.name ?? "?").charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{emp.name}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {[emp.jobTitle, emp.department].filter(Boolean).join(" · ")}
                  </p>
                </div>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

// Multi-select version for CC
type MultiProps = {
  value: PickedEmployee[];
  onChange: (emps: PickedEmployee[]) => void;
  placeholder?: string;
  className?: string;
};

export function EmployeeMultiPicker({ value, onChange, placeholder = "Tambah penerima tembusan...", className }: MultiProps) {
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [debouncedSearch] = useDebounce(search, 300);
  const containerRef = useRef<HTMLDivElement>(null);

  const employees = useQuery(api.users.listEmployees, { search: debouncedSearch, department: "" });

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const add = (emp: PickedEmployee) => {
    if (!value.find((v) => v._id === emp._id)) {
      onChange([...value, emp]);
    }
    setSearch("");
    setOpen(false);
  };

  const remove = (id: Id<"users">) => onChange(value.filter((e) => e._id !== id));

  return (
    <div ref={containerRef} className={cn("space-y-2", className)}>
      {/* Selected tags */}
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {value.map((emp) => (
            <span
              key={emp._id}
              className="flex items-center gap-1.5 rounded-full border bg-muted/50 pl-2 pr-1 py-0.5 text-xs"
            >
              <User className="h-3 w-3 shrink-0 text-muted-foreground" />
              <span className="font-medium">{emp.name}</span>
              {emp.jobTitle && <span className="text-muted-foreground">({emp.jobTitle})</span>}
              <button
                type="button"
                onClick={() => remove(emp._id)}
                className="ml-0.5 rounded-full p-0.5 hover:bg-muted text-muted-foreground hover:text-foreground"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Input */}
      <div className="relative">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          className="pl-8"
          placeholder={placeholder}
          value={search}
          onChange={(e) => { setSearch(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
        />
      </div>

      {/* Dropdown */}
      {open && (
        <div className="absolute z-50 w-full rounded-md border bg-popover shadow-md max-h-52 overflow-y-auto">
          {employees === undefined ? (
            <div className="p-3 text-xs text-muted-foreground text-center">Memuat...</div>
          ) : employees.filter((e) => !value.find((v) => v._id === e._id)).length === 0 ? (
            <div className="p-3 text-xs text-muted-foreground text-center">Tidak ada hasil</div>
          ) : (
            employees
              .filter((e) => !value.find((v) => v._id === e._id))
              .map((emp) => (
                <button
                  key={emp._id}
                  type="button"
                  className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-muted transition-colors"
                  onMouseDown={(e) => { e.preventDefault(); add({ _id: emp._id, name: emp.name ?? "", jobTitle: emp.jobTitle, department: emp.department }); }}
                >
                  <Avatar className="h-7 w-7 shrink-0">
                    <AvatarFallback className="text-xs">{(emp.name ?? "?").charAt(0).toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{emp.name}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {[emp.jobTitle, emp.department].filter(Boolean).join(" · ")}
                    </p>
                  </div>
                </button>
              ))
          )}
        </div>
      )}
    </div>
  );
}
