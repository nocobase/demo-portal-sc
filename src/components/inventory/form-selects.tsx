import { useList, useTranslate } from "@refinedev/core";
import { useMemo } from "react";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { OptionItem } from "@/lib/inventory/constants";
import { optionLabel } from "@/lib/inventory/constants";

export function EnumSelectField({
  options,
  value,
  onValueChange,
  placeholder,
  locale,
  disabled,
  className,
}: {
  options: OptionItem[];
  value?: string | null;
  onValueChange: (value: string) => void;
  placeholder?: string;
  locale?: string;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <Select
      value={value ?? ""}
      onValueChange={(next) => {
        if (next) onValueChange(next);
      }}
      disabled={disabled}
    >
      <SelectTrigger className={cn("w-full", className)}>
        <SelectValue>
          {(raw) => optionLabel(options, raw as string, locale) || placeholder || "-"}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {locale === "en-US" ? option.labelEn : option.labelZh}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export type RelationOption = {
  value: string;
  label: string;
};

export function useRelationOptions(
  resource: string,
  labelField: string
): { options: RelationOption[]; isLoading: boolean } {
  const translate = useTranslate();
  const { result, query } = useList<any>({
    resource,
    pagination: { mode: "server", currentPage: 1, pageSize: 200 },
    errorNotification: false,
    queryOptions: { retry: false },
  });
  const options = useMemo(() => {
    const records = result?.data ?? [];
    return records
      .filter((record: any) => record?.id)
      .map((record: any) => ({
        value: String(record.id),
        label: String(record[labelField] ?? record.id),
      }))
      .sort((a: RelationOption, b: RelationOption) =>
        a.label.localeCompare(b.label, translate("locale", "zh-CN"))
      );
  }, [result?.data, labelField, translate]);

  return { options, isLoading: query.isLoading || query.isFetching };
}

export function RelationSelectField({
  options,
  value,
  onValueChange,
  placeholder,
  disabled,
  className,
}: {
  options: RelationOption[];
  value?: string | null;
  onValueChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <Select
      value={value ?? ""}
      onValueChange={(next) => {
        if (next) onValueChange(next);
      }}
      disabled={disabled}
    >
      <SelectTrigger className={cn("w-full", className)}>
        <SelectValue>
          {(raw) =>
            options.find((option) => option.value === raw)?.label ??
            placeholder ??
            "-"
          }
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
