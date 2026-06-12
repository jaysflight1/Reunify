"use client";

import { useMemo, useState } from "react";
import { EXAMPLE_STUDENTS, type ExampleStudent } from "@/lib/demo/example-students";

type StudentIdentityPickerProps = {
  query: string;
  selectedStudentId?: string;
  onQueryChange: (value: string) => void;
  onSelect: (student: ExampleStudent) => void;
  placeholder?: string;
};

export function formatStudentIdentity(student: ExampleStudent): string {
  return `${student.fullName} (${student.id})`;
}

export function StudentIdentityPicker({
  query,
  selectedStudentId,
  onQueryChange,
  onSelect,
  placeholder = "Type your name or student ID",
}: StudentIdentityPickerProps) {
  const [focused, setFocused] = useState(false);
  const matches = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    const list = normalized
      ? EXAMPLE_STUDENTS.filter((student) => {
          const searchable = `${student.fullName} ${student.id}`.toLowerCase();
          return searchable.includes(normalized);
        })
      : EXAMPLE_STUDENTS;
    return list.slice(0, 8);
  }, [query]);

  return (
    <div className="relative">
      <input
        className="w-full rounded-lg border border-[#4b5563] bg-[#0c0f13] px-3 py-3 text-base text-[#f8fafc] outline-none focus:border-[#64748b]"
        value={query}
        onChange={(event) => {
          onQueryChange(event.target.value);
          setFocused(true);
        }}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        placeholder={placeholder}
        autoComplete="off"
        role="combobox"
        aria-expanded={focused}
        aria-controls="student-identity-options"
      />
      {focused ? (
        <div
          id="student-identity-options"
          className="absolute z-30 mt-1 max-h-64 w-full overflow-y-auto rounded-lg border border-[#4b5563] bg-[#111827] shadow-xl shadow-black/30"
          role="listbox"
        >
          {matches.length > 0 ? (
            matches.map((student) => (
              <button
                key={student.id}
                type="button"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => {
                  onSelect(student);
                  setFocused(false);
                }}
                className="flex w-full items-center justify-between gap-3 border-b border-[#1f2937] px-3 py-2.5 text-left last:border-b-0 hover:bg-[#1f2937]"
                role="option"
                aria-selected={selectedStudentId === student.id}
              >
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium text-[#f8fafc]">
                    {student.fullName}
                  </span>
                  <span className="block text-xs text-black">
                    {student.id} · Grade {student.grade}
                  </span>
                </span>
              </button>
            ))
          ) : (
            <p className="px-3 py-3 text-sm text-black">No matching students</p>
          )}
        </div>
      ) : null}
    </div>
  );
}
