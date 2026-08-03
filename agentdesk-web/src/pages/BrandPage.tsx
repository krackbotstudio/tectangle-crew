import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CheckCircle2,
  ImageIcon,
  Loader2,
  Palette,
  Trash2,
  Upload,
} from "lucide-react";
import { api, getToken, type BrandGuidelines } from "../lib/api";
import { cn } from "../lib/utils";
import { PageHeader } from "../components/workspace/DashboardUI";

const IMAGE_STYLES = [
  { id: "photorealistic", label: "Photorealistic" },
  { id: "cinematic", label: "Cinematic" },
  { id: "illustration", label: "Illustration" },
  { id: "flat", label: "Flat graphic" },
  { id: "3d", label: "3D render" },
  { id: "minimal", label: "Minimal" },
  { id: "product_shot", label: "Product shot" },
] as const;

const LOGO_PLACEMENTS = [
  { id: "none", label: "No logo on image" },
  { id: "subtle_corner", label: "Subtle corner" },
  { id: "top_center", label: "Top center" },
  { id: "bottom_center", label: "Bottom center" },
  { id: "prominent", label: "Prominent" },
] as const;

export function BrandPage() {
  const queryClient = useQueryClient();
  const [banner, setBanner] = useState<string | null>(null);
  const [bannerError, setBannerError] = useState(false);
  const [form, setForm] = useState({
    companyName: "",
    tagline: "",
    logoAltText: "",
    primaryColor: "#863BFF",
    secondaryColor: "#262626",
    accentColor: "#FFFFFF",
    fontPrimary: "",
    fontSecondary: "",
    imageStyle: "photorealistic",
    visualKeywords: "",
    logoPlacement: "subtle_corner",
    doNotes: "",
    dontNotes: "",
    extraRules: "",
  });

  const { data, isLoading, isError, error: loadError } = useQuery({
    queryKey: ["brand-guidelines"],
    queryFn: () => api.getBrandGuidelines(),
  });

  const brand = data?.brand ?? null;

  useEffect(() => {
    if (!brand) return;
    setForm({
      companyName: brand.companyName ?? "",
      tagline: brand.tagline ?? "",
      logoAltText: brand.logoAltText ?? "",
      primaryColor: brand.primaryColor || "#863BFF",
      secondaryColor: brand.secondaryColor || "#262626",
      accentColor: brand.accentColor || "#FFFFFF",
      fontPrimary: brand.fontPrimary ?? "",
      fontSecondary: brand.fontSecondary ?? "",
      imageStyle: brand.imageStyle || "photorealistic",
      visualKeywords: (brand.visualKeywords ?? []).join(", "),
      logoPlacement: brand.logoPlacement || "subtle_corner",
      doNotes: brand.doNotes ?? "",
      dontNotes: brand.dontNotes ?? "",
      extraRules: brand.extraRules ?? "",
    });
  }, [brand]);

  const save = useMutation({
    mutationFn: () =>
      api.saveBrandGuidelines({
        companyName: form.companyName,
        tagline: form.tagline,
        logoAltText: form.logoAltText,
        primaryColor: form.primaryColor,
        secondaryColor: form.secondaryColor,
        accentColor: form.accentColor,
        fontPrimary: form.fontPrimary,
        fontSecondary: form.fontSecondary,
        imageStyle: form.imageStyle,
        visualKeywords: form.visualKeywords
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
        logoPlacement: form.logoPlacement,
        doNotes: form.doNotes,
        dontNotes: form.dontNotes,
        extraRules: form.extraRules,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["brand-guidelines"] });
      setBannerError(false);
      setBanner("Brand guidelines saved. New image generations will follow this guide.");
    },
    onError: (e) => {
      setBannerError(true);
      setBanner((e as Error).message);
    },
  });

  function handleSave() {
    if (!form.companyName.trim()) {
      setBannerError(true);
      setBanner("Add a company / brand name in the Identity section at the top, then save.");
      document.getElementById("brand-identity")?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    save.mutate();
  }

  const uploadLogo = useMutation({
    mutationFn: (file: File) => api.uploadBrandLogo(file),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["brand-guidelines"] });
      setBannerError(false);
      setBanner("Logo uploaded.");
    },
    onError: (e) => {
      setBannerError(true);
      setBanner((e as Error).message);
    },
  });

  const clearLogo = useMutation({
    mutationFn: () =>
      api.saveBrandGuidelines({
        companyName: form.companyName,
        tagline: form.tagline,
        logoAltText: form.logoAltText,
        primaryColor: form.primaryColor,
        secondaryColor: form.secondaryColor,
        accentColor: form.accentColor,
        fontPrimary: form.fontPrimary,
        fontSecondary: form.fontSecondary,
        imageStyle: form.imageStyle,
        visualKeywords: form.visualKeywords
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
        logoPlacement: form.logoPlacement,
        doNotes: form.doNotes,
        dontNotes: form.dontNotes,
        extraRules: form.extraRules,
        clearLogo: true,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["brand-guidelines"] });
      setBannerError(false);
      setBanner("Logo removed.");
    },
    onError: (e) => {
      setBannerError(true);
      setBanner((e as Error).message);
    },
  });

  return (
    <div className="h-full overflow-y-auto p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-4xl">
        <PageHeader
          title="Brand"
          subtitle="Set logo, fonts, colors, and image style so Networks and Design creatives stay on-brand."
          action={
            <Link
              to="/networks"
              className="inline-flex items-center gap-2 rounded-xl border border-border px-3 py-2 text-sm text-text-muted hover:bg-panel-hover"
            >
              <ImageIcon className="h-4 w-4" /> Networks
            </Link>
          }
        />

        {banner && (
          <div
            className={cn(
              "mb-4 rounded-xl border px-4 py-3 text-sm",
              bannerError
                ? "border-red-500/30 bg-red-500/10 text-red-200"
                : "border-border bg-panel text-text"
            )}
          >
            {banner}
          </div>
        )}

        {isError && (
          <div className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
            Could not load brand guidelines: {(loadError as Error)?.message || "Unknown error"}.
            Restart the API so migration 026_brand_guidelines.sql can apply.
          </div>
        )}

        {isLoading ? (
          <div className="flex items-center gap-2 text-sm text-text-muted">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading brand guidelines…
          </div>
        ) : (
          <div className="space-y-4">
            <section id="brand-identity" className="rounded-2xl border border-border bg-panel p-5">
              <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-text-strong">
                <Palette className="h-4 w-4" /> Identity
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field
                  label="Company / brand name"
                  value={form.companyName}
                  onChange={(v) => setForm((f) => ({ ...f, companyName: v }))}
                  placeholder="banaoo"
                  required
                  autoFocus
                />
                <Field
                  label="Tagline"
                  value={form.tagline}
                  onChange={(v) => setForm((f) => ({ ...f, tagline: v }))}
                  placeholder="Optional short line"
                />
              </div>
              {!form.companyName.trim() && (
                <p className="mt-3 text-xs text-amber-200/90">
                  Company / brand name is required before you can save.
                </p>
              )}
            </section>

            <section className="rounded-2xl border border-border bg-panel p-5">
              <div className="mb-1 text-sm font-semibold text-text-strong">Logo</div>
              <p className="mb-4 text-xs text-text-muted">
                Upload your real logo file — it is composited onto generated creatives (exact mark). Keep “Logo description” short and visual only (shape/colors of the mark), not a product pitch.
              </p>
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
                <LogoPreview brand={brand} />
                <div className="min-w-0 flex-1 space-y-3">
                  <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-border px-3 py-2 text-sm text-text-muted hover:bg-panel-hover">
                    {uploadLogo.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Upload className="h-4 w-4" />
                    )}
                    Upload logo
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp,image/svg+xml"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) uploadLogo.mutate(file);
                        e.target.value = "";
                      }}
                    />
                  </label>
                  {brand?.logoFileName && (
                    <button
                      type="button"
                      disabled={clearLogo.isPending}
                      onClick={() => clearLogo.mutate()}
                      className="inline-flex items-center gap-2 rounded-xl border border-border px-3 py-2 text-sm text-text-muted hover:bg-panel-hover"
                    >
                      <Trash2 className="h-4 w-4" /> Remove logo
                    </button>
                  )}
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-text-muted">
                      Logo description (fallback if no file)
                    </label>
                    <textarea
                      value={form.logoAltText}
                      onChange={(e) => setForm((f) => ({ ...f, logoAltText: e.target.value }))}
                      rows={3}
                      placeholder='e.g. lowercase "banaoo" wordmark, orange #fe8b00, Open Sans, no icon'
                      className="w-full rounded-xl border border-border bg-panel-elevated px-3 py-2 text-sm text-text outline-none placeholder:text-text-faint focus:border-neutral-500"
                    />
                  </div>
                </div>
              </div>
            </section>

            <section className="rounded-2xl border border-border bg-panel p-5">
              <div className="mb-4 text-sm font-semibold text-text-strong">Colors</div>
              <div className="grid gap-4 sm:grid-cols-3">
                <ColorField
                  label="Primary"
                  value={form.primaryColor}
                  onChange={(v) => setForm((f) => ({ ...f, primaryColor: v }))}
                />
                <ColorField
                  label="Secondary"
                  value={form.secondaryColor}
                  onChange={(v) => setForm((f) => ({ ...f, secondaryColor: v }))}
                />
                <ColorField
                  label="Accent"
                  value={form.accentColor}
                  onChange={(v) => setForm((f) => ({ ...f, accentColor: v }))}
                />
              </div>
            </section>

            <section className="rounded-2xl border border-border bg-panel p-5">
              <div className="mb-4 text-sm font-semibold text-text-strong">Typography</div>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field
                  label="Display / logo font"
                  value={form.fontPrimary}
                  onChange={(v) => setForm((f) => ({ ...f, fontPrimary: v }))}
                  placeholder="Inter, Satoshi, geometric sans…"
                />
                <Field
                  label="Supporting font"
                  value={form.fontSecondary}
                  onChange={(v) => setForm((f) => ({ ...f, fontSecondary: v }))}
                  placeholder="Optional body style"
                />
              </div>
            </section>

            <section className="rounded-2xl border border-border bg-panel p-5">
              <div className="mb-4 text-sm font-semibold text-text-strong">Image type & placement</div>
              <div className="mb-3 text-xs font-medium text-text-muted">Image style</div>
              <div className="mb-5 flex flex-wrap gap-2">
                {IMAGE_STYLES.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, imageStyle: s.id }))}
                    className={cn(
                      "rounded-xl border px-3 py-1.5 text-sm",
                      form.imageStyle === s.id
                        ? "border-accent/50 bg-accent-light/20 text-text-strong"
                        : "border-border text-text-muted hover:bg-panel-hover"
                    )}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
              <div className="mb-3 text-xs font-medium text-text-muted">Logo on creatives</div>
              <div className="mb-5 flex flex-wrap gap-2">
                {LOGO_PLACEMENTS.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, logoPlacement: p.id }))}
                    className={cn(
                      "rounded-xl border px-3 py-1.5 text-sm",
                      form.logoPlacement === p.id
                        ? "border-accent/50 bg-accent-light/20 text-text-strong"
                        : "border-border text-text-muted hover:bg-panel-hover"
                    )}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
              <Field
                label="Visual keywords (comma-separated)"
                value={form.visualKeywords}
                onChange={(v) => setForm((f) => ({ ...f, visualKeywords: v }))}
                placeholder="warm kitchen, India, tablet UI, dusk light"
              />
            </section>

            <section className="rounded-2xl border border-border bg-panel p-5">
              <div className="mb-4 text-sm font-semibold text-text-strong">Do / don’t</div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-text-muted">Do</label>
                  <textarea
                    value={form.doNotes}
                    onChange={(e) => setForm((f) => ({ ...f, doNotes: e.target.value }))}
                    rows={3}
                    className="w-full rounded-xl border border-border bg-panel-elevated px-3 py-2 text-sm text-text outline-none focus:border-neutral-500"
                    placeholder="Show real restaurant ops, warm lighting…"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-text-muted">Don’t</label>
                  <textarea
                    value={form.dontNotes}
                    onChange={(e) => setForm((f) => ({ ...f, dontNotes: e.target.value }))}
                    rows={3}
                    className="w-full rounded-xl border border-border bg-panel-elevated px-3 py-2 text-sm text-text outline-none focus:border-neutral-500"
                    placeholder="No clipart food, no purple gradients, no fake metrics…"
                  />
                </div>
              </div>
              <div className="mt-4">
                <label className="mb-1.5 block text-xs font-medium text-text-muted">Extra rules</label>
                <textarea
                  value={form.extraRules}
                  onChange={(e) => setForm((f) => ({ ...f, extraRules: e.target.value }))}
                  rows={2}
                  className="w-full rounded-xl border border-border bg-panel-elevated px-3 py-2 text-sm text-text outline-none focus:border-neutral-500"
                />
              </div>
            </section>

            <div className="sticky bottom-0 z-10 -mx-1 flex flex-wrap items-center justify-end gap-3 border-t border-border bg-sidebar/95 px-1 py-4 backdrop-blur pb-8">
              {!form.companyName.trim() && (
                <span className="text-xs text-amber-200/90">Enter company name above to enable save</span>
              )}
              <button
                type="button"
                disabled={save.isPending}
                onClick={handleSave}
                className="inline-flex items-center gap-2 rounded-xl bg-accent px-4 py-2 text-sm font-medium text-accent-muted-fg hover:bg-accent-hover disabled:opacity-50"
              >
                {save.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="h-4 w-4" />
                )}
                Save brand guidelines
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function LogoPreview({ brand }: { brand: BrandGuidelines | null }) {
  const { url, error } = useAuthImage(brand?.logoUrl ?? null);
  return (
    <div className="flex h-36 w-36 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-dashed border-border bg-panel-elevated">
      {url && !error ? (
        <img src={url} alt="Brand logo" className="max-h-full max-w-full object-contain p-3" />
      ) : (
        <span className="px-3 text-center text-[11px] text-text-faint">No logo yet</span>
      )}
    </div>
  );
}

function useAuthImage(downloadPath: string | null) {
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let objectUrl: string | null = null;
    let cancelled = false;
    if (!downloadPath) {
      setUrl(null);
      setError(false);
      return;
    }

    async function load() {
      try {
        const token = getToken();
        const path = downloadPath!.startsWith("/api/")
          ? downloadPath!
          : `/api${downloadPath!.startsWith("/") ? downloadPath : `/${downloadPath}`}`;
        const res = await fetch(path, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (!res.ok) throw new Error("fail");
        const blob = await res.blob();
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setUrl(objectUrl);
        setError(false);
      } catch {
        if (!cancelled) setError(true);
      }
    }

    void load();
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [downloadPath]);

  return { url, error };
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  required,
  autoFocus,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  required?: boolean;
  autoFocus?: boolean;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-medium text-text-muted">
        {label}
        {required ? " *" : ""}
      </label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoFocus={autoFocus}
        className="w-full rounded-xl border border-border bg-panel-elevated px-3 py-2 text-sm text-text outline-none placeholder:text-text-faint focus:border-neutral-500"
      />
    </div>
  );
}

function ColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-medium text-text-muted">{label}</label>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={/^#[0-9A-Fa-f]{6}$/.test(value) ? value : "#863BFF"}
          onChange={(e) => onChange(e.target.value)}
          className="h-10 w-10 cursor-pointer rounded-lg border border-border bg-transparent"
        />
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="min-w-0 flex-1 rounded-xl border border-border bg-panel-elevated px-3 py-2 text-sm text-text outline-none focus:border-neutral-500"
        />
      </div>
    </div>
  );
}
