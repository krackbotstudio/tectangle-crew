import { useMemo, useState } from "react";
import { AUTO } from "./aiModelUtils";
import type { AiSettingsResponse } from "../../lib/api";
import { cn } from "../../lib/utils";

const inputClass =
  "w-full rounded-xl border border-border bg-panel-elevated px-3 py-2 text-sm text-text outline-none focus:border-neutral-500";

export function ModelPicker({
  providerRef,
  value,
  onChange,
  settings,
  label = "Model",
  hint,
  compact = false,
}: {
  providerRef: string;
  value: string;
  onChange: (model: string) => void;
  settings?: AiSettingsResponse;
  label?: string;
  hint?: string;
  /** Hide label/hint — for table rows */
  compact?: boolean;
}) {
  const [customMode, setCustomMode] = useState(() => {
    if (!value || value === AUTO) return false;
    return !isKnownModel(settings, providerRef, value);
  });

  const suggestions = useMemo(() => {
    if (!settings) return [{ id: AUTO, label: "Auto (provider default)" }];
    if (providerRef === AUTO) return [{ id: AUTO, label: "Auto (best available)" }];
    if (providerRef === "anthropic" || providerRef === "openai" || providerRef === "google") {
      return [
        { id: AUTO, label: "Auto (provider default)" },
        ...settings.catalog[providerRef].models,
      ];
    }
    const custom = settings.customProviders.find((p) => p.ref === providerRef);
    const discovered = (custom?.discoveredModels ?? []).map((id) => ({ id, label: id }));
    return [{ id: AUTO, label: "Auto (provider default)" }, ...discovered];
  }, [settings, providerRef]);

  const selectValue = customMode ? "__custom__" : value || AUTO;

  return (
    <div>
      {!compact && (
        <>
          <label className="mb-1 block text-sm font-medium text-text-muted">{label}</label>
          {hint && <p className="mb-1 text-xs text-text-faint">{hint}</p>}
        </>
      )}
      <select
        value={selectValue}
        onChange={(e) => {
          if (e.target.value === "__custom__") {
            setCustomMode(true);
            onChange(value && value !== AUTO ? value : "");
            return;
          }
          setCustomMode(false);
          onChange(e.target.value);
        }}
        className={compact ? `${inputClass} min-w-[140px] text-xs` : inputClass}
        aria-label={compact ? label : undefined}
      >
        {suggestions.map((m) => (
          <option key={m.id} value={m.id}>
            {m.label}
          </option>
        ))}
        <option value="__custom__">Custom model ID…</option>
      </select>
      {customMode && (
        <input
          type="text"
          value={value === AUTO ? "" : value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Enter any model ID from your provider"
          className={cn(
            inputClass,
            compact ? "mt-1 font-mono text-xs" : "mt-2 font-mono text-xs"
          )}
        />
      )}
    </div>
  );
}

function isKnownModel(settings: AiSettingsResponse | undefined, providerRef: string, model: string) {
  if (!settings || !model || model === AUTO) return true;
  if (providerRef === "anthropic" || providerRef === "openai" || providerRef === "google") {
    return settings.catalog[providerRef].models.some((m) => m.id === model);
  }
  const custom = settings.customProviders.find((p) => p.ref === providerRef);
  return (custom?.discoveredModels ?? []).includes(model);
}

export function ProviderPicker({
  value,
  onChange,
  settings,
  includeWorkspaceDefault = false,
  label = "Provider",
  hint,
}: {
  value: string;
  onChange: (provider: string) => void;
  settings?: AiSettingsResponse;
  includeWorkspaceDefault?: boolean;
  label?: string;
  hint?: string;
}) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-text-muted">{label}</label>
      {hint && <p className="mb-1 text-xs text-text-faint">{hint}</p>}
      <select value={value} onChange={(e) => onChange(e.target.value)} className={inputClass}>
        {includeWorkspaceDefault && (
          <option value="">
            Workspace default ({settings?.defaultProvider === AUTO ? "Auto" : settings?.defaultProvider})
          </option>
        )}
        <option value={AUTO}>Auto (pick best configured provider)</option>
        <option value="anthropic">Anthropic</option>
        <option value="openai">OpenAI</option>
        <option value="google">Google AI (Gemini)</option>
        {settings?.customProviders.map((p) => (
          <option key={p.id} value={p.ref}>
            {p.name}
          </option>
        ))}
      </select>
    </div>
  );
}
