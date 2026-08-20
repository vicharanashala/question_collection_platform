/**
 * Complete-profile wizard (self-contained).
 *
 * Extracted from the legacy `PublicRegisterPage` so it can be hosted
 * inside a Dialog modal on the `/home` dashboard instead of being a
 * standalone full-screen page. The wizard has 4 steps:
 *   1. Category (Farmer / FPO / Student / Volunteer / NGO)
 *   2. Location (State → District → Block → Village → KVK)
 *   3. About-you (Name / Username / Gender / Age / category-specific fields)
 *   4. Language + consent (final submission)
 *
 * The wizard is responsible for:
 *   • managing its own form state + LGD cascading loaders
 *   • calling `authApi.register(payload)`
 *   • `login(...)` so the public user is authenticated immediately
 *   • navigating to `/home/verification-pending` on success
 */
import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { authApi, lgdApi, getErrorMessage } from "@/api/client";
import type {
  LgdDistrict,
  LgdKvk,
  LgdSubDistrict,
  LgdVillage,
} from "@/api/client";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SearchableSelect } from '@/components/ui/searchable-select'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from "@/lib/utils";
import {
  CheckCircle2,
  Leaf,
  Users,
  GraduationCap,
  HandHeart,
  Building2,
  Loader2,
  ArrowLeft,
  ArrowRight,
  User as UserIcon,
  Check,
  Languages,
  Sparkles,
  Clock,
  Gift,
  Bell,
} from "lucide-react";
import { toast } from "sonner";
import { BrandLogo } from "@/components/BrandLogo";
import { CropImage } from "@/components/CropImage";
import { CropPickerModal } from "@/components/ui/crop-picker-modal";
import { LegalDocumentModal } from "@/components/ui/legal-document-modal";
import {
  LANGUAGES,
  USER_CATEGORIES,
  GENDER_OPTIONS,
  SUPPORTED_STATES,
  CROPS,
  COURSE_OPTIONS,
  ORG_TYPE_OPTIONS,
  SEASONS,
} from "@/constants/public";
import type { UserCategory } from "@/types";
import { LogOut } from "lucide-react";
import { SignOutDialog } from "@/components/SignOutDialog";

const TOTAL_STEPS = 4;
const STEP_KEYS = [
  "Tell us about yourself",
  "Where are you from?",
  "About you",
  "Language & Consent",
];
const OTHER_VALUE = "__other__";

interface WizardFormState {
  category: UserCategory | "";
  state: string;
  district: string;
  districtCode: string;
  block: string;
  village: string;
  kvk: string;
  name: string;
  username: string;
  gender: "" | "male" | "female" | "other";
  age: string;
  farmSize: string;
  cropType: string[];
  courseName: string;
  courseNameOther: string;
  collegeName: string;
  universityName: string;
  organisationType: string;
  organisationTypeOther: string;
  organizationName: string;
  organizationRole: string;
  numberOfFarmers: string;
  organizationState: string;
  organizationDistrict: string;
  organizationDistrictCode: string;
  organizationBlock: string;
  organizationVillage: string;
  season: string;
  volunteerCropType: string;
  languagePreference: string;
  consentGiven: boolean;
}

const INITIAL_FORM: WizardFormState = {
  category: "",
  state: "",
  district: "",
  districtCode: "",
  block: "",
  village: "",
  kvk: "",
  name: "",
  username: "",
  gender: "",
  age: "",
  farmSize: "",
  cropType: [],
  courseName: "",
  courseNameOther: "",
  collegeName: "",
  universityName: "",
  organisationType: "",
  organisationTypeOther: "",
  organizationName: "",
  organizationRole: "",
  numberOfFarmers: "",
  organizationState: "",
  organizationDistrict: "",
  organizationDistrictCode: "",
  organizationBlock: "",
  organizationVillage: "",
  season: "",
  volunteerCropType: "",
  languagePreference: "en",
  consentGiven: false,
};

type SetField = <K extends keyof WizardFormState>(
  k: K,
  v: WizardFormState[K],
) => void;

function CategoryIcon({
  value,
  className,
}: {
  value: UserCategory;
  className?: string;
}) {
  const map: Record<UserCategory, JSX.Element> = {
    farmer: <Leaf className={className} />,
    fpo: <Users className={className} />,
    student: <GraduationCap className={className} />,
    volunteer: <HandHeart className={className} />,
    ngo: <Building2 className={className} />,
  };
  return map[value] ?? <UserIcon className={className} />;
}

interface WizardFormStateProps {
  form: WizardFormState;
  errors: Record<string, string>;
  usernameStatus: "idle" | "checking" | "available" | "taken";
  usernameSuggestions: string[];
  districts: LgdDistrict[];
  blocks: LgdSubDistrict[];
  villages: LgdVillage[];
  kvks: LgdKvk[];
  loadingDistricts: boolean;
  loadingBlocks: boolean;
  loadingVillages: boolean;
  loadingKvks: boolean;
  organizationDistricts: LgdDistrict[];
  loadingOrganizationDistricts: boolean;
  loadOrganizationDistricts: (stateName: string) => Promise<void>;
  setField: SetField;
  loadDistricts: (stateName: string) => Promise<void>;
  loadBlocks: (districtCode: string) => Promise<void>;
  loadVillages: (blockCode: string) => Promise<void>;
  loadKvks: (districtCode: string) => Promise<void>;
  cropPickerOpen: boolean;
  setCropPickerOpen: (open: boolean) => void;
  setLegalModal: (type: "terms" | "privacy" | null) => void;
  districtFreeText: boolean;
  setDistrictFreeText: (v: boolean) => void;
  blockFreeText: boolean;
  setBlockFreeText: (v: boolean) => void;
  villageFreeText: boolean;
  setVillageFreeText: (v: boolean) => void;
  kvkFreeText: boolean;
  setKvkFreeText: (v: boolean) => void;
}

function Step1({ form, errors, setField }: WizardFormStateProps) {
  return (
    <div className="space-y-4">
      <p className="text-xs sm:text-xs sm:text-sm text-muted-foreground">
        Pick the option that best describes you.
      </p>
      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 sm:gap-3">
        {USER_CATEGORIES.map((c) => {
          const active = form.category === c.value;
          return (
            <button
              key={c.value}
              type="button"
              onClick={() => setField("category", c.value)}
              className={cn(
                "flex items-center gap-2.5 sm:gap-3 rounded-xl border-2 px-3 py-2.5 sm:px-4 sm:py-3.5 text-left transition-all",
                active
                  ? `${c.ring} border-emerald-300 bg-emerald-50/60 dark:border-emerald-700 dark:bg-emerald-950/20 shadow-sm`
                  : "border-border hover:border-emerald-200 hover:shadow-sm",
              )}
            >
              <div
                className={cn(
                  "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg sm:h-11 sm:w-11 sm:rounded-xl",
                  active ? c.iconBg.replace("text-", "bg-") : c.iconBg,
                  active ? c.iconColor : c.iconColor,
                )}
              >
                <CategoryIcon value={c.value} className="h-4 w-4 sm:h-5 sm:w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs sm:text-xs sm:text-sm font-semibold text-foreground leading-tight">{c.label}</p>
                <p className="hidden xs:block mt-0.5 text-[11px] sm:text-[11px] sm:text-xs text-muted-foreground leading-snug">{c.description}</p>
              </div>
              {active && (
                <CheckCircle2 className="h-4 w-4 sm:h-5 sm:w-5 text-emerald-600 shrink-0" />
              )}
            </button>
          );
        })}
      </div>
      {errors.category && (
        <p className="text-xs sm:text-xs sm:text-sm text-destructive">{errors.category}</p>
      )}
    </div>
  );
}

function Step2({
  form,
  errors,
  districts,
  blocks,
  villages,
  kvks,
  loadingDistricts,
  loadingBlocks,
  loadingVillages,
  loadingKvks,
  setField,
  loadDistricts,
  loadBlocks,
  loadVillages,
  loadKvks,
  districtFreeText,
  setDistrictFreeText,
  blockFreeText,
  setBlockFreeText,
  villageFreeText,
  setVillageFreeText,
  kvkFreeText,
  setKvkFreeText,
}: WizardFormStateProps) {
  return (
    <div className="space-y-4">
      <p className="text-xs sm:text-xs sm:text-sm text-muted-foreground">
        We&apos;ll use this to match your questions with local experts.
      </p>

      {/* State */}
      <div className="space-y-1.5">
        <Label>
          State <span className="text-destructive">*</span>
        </Label>
        <SearchableSelect
          items={SUPPORTED_STATES.map((s) => ({ value: s.value, label: s.label }))}
          value={form.state}
          onValueChange={(v) => {
            setField("state", v)
            setField("district", "")
            setField("districtCode", "")
            loadDistricts(v)
          }}
          placeholder="Search state…"
          disabled={loadingDistricts}
          loading={loadingDistricts}
        />
        {errors.state && (
          <p className="text-xs sm:text-xs sm:text-sm text-destructive">{errors.state}</p>
        )}
      </div>

      {/* District */}
      <div className="space-y-1.5">
        <Label>
          District <span className="text-destructive">*</span>
        </Label>
        <SearchableSelect
          items={districts.map((d) => ({ value: d.name, label: d.name }))}
          value={form.district}
          onValueChange={(v) => {
            const d = districts.find((x) => x.name === v)
            setField("district", v)
            setField("districtCode", d?.code ?? "")
            loadBlocks(d?.code ?? "")
          }}
          placeholder={
            !form.state ? "Choose state first" : "Search district…"
          }
          disabled={!form.state || loadingDistricts}
          loading={loadingDistricts}
          allowFreeText={!districtFreeText && districts.length === 0 && !loadingDistricts && !!form.state}
          onFreeTextEntry={() => {
            setDistrictFreeText(true)
            setField("district", "")
          }}
        />
        {/* Free-text input when backend returned no data */}
        {districtFreeText && (
          <Input
            value={form.district}
            onChange={(e) => setField("district", e.target.value)}
            placeholder="Type district name"
            className="mt-1.5"
          />
        )}
        {errors.district && (
          <p className="text-xs sm:text-xs sm:text-sm text-destructive">{errors.district}</p>
        )}
      </div>

      {/* Block — farmers only */}
      {form.category === "farmer" && (
        <div className="space-y-1.5">
          <Label>
            Block <span className="text-destructive">*</span>
          </Label>
          <SearchableSelect
            items={blocks.map((b) => ({ value: b.name, label: b.name }))}
            value={form.block}
            onValueChange={(v) => {
              const block = blocks.find((b) => b.name === v)
              setField("block", v)
              loadVillages(block?.code ?? "")
              loadKvks(form.districtCode)
            }}
            placeholder={
              !form.district ? "Choose district first" : "Search block…"
            }
            disabled={!form.district || loadingBlocks}
            loading={loadingBlocks}
            allowFreeText={!blockFreeText && blocks.length === 0 && !loadingBlocks && !!form.district}
            onFreeTextEntry={() => {
              setBlockFreeText(true)
              setField("block", "")
            }}
          />
          {/* Free-text input when backend returned no data */}
          {blockFreeText && (
            <Input
              value={form.block}
              onChange={(e) => setField("block", e.target.value)}
              placeholder="Type block name"
              className="mt-1.5"
            />
          )}
          {errors.block && (
            <p className="text-xs sm:text-xs sm:text-sm text-destructive">{errors.block}</p>
          )}
        </div>
      )}

      {/* Village + KVK — farmers with block selected */}
      {form.category === "farmer" && form.block && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Village <span className="text-destructive">*</span></Label>
            <SearchableSelect
              items={villages.map((v) => ({ value: v.name, label: v.name }))}
              value={form.village}
              onValueChange={(v) => setField("village", v)}
              placeholder="Search village…"
              disabled={loadingVillages}
              loading={loadingVillages}
              allowFreeText={!villageFreeText && villages.length === 0 && !loadingVillages && !!form.block}
              onFreeTextEntry={() => {
                setVillageFreeText(true)
                setField("village", "")
              }}
            />
            {/* Free-text input when backend returned no data */}
            {villageFreeText && (
              <Input
                value={form.village}
                onChange={(e) => setField("village", e.target.value)}
                placeholder="Type village name"
                className="mt-1.5"
              />
            )}
            {errors.village && (
              <p className="text-xs sm:text-xs sm:text-sm text-destructive">{errors.village}</p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label>Nearest KVK <span className="text-destructive">*</span></Label>
            <SearchableSelect
              items={kvks.map((k) => ({ value: k.a, label: k.address }))}
              value={form.kvk}
              onValueChange={(v) => setField("kvk", v)}
              placeholder="Search KVK…"
              disabled={loadingKvks}
              loading={loadingKvks}
              allowFreeText={!kvkFreeText && kvks.length === 0 && !loadingKvks && !!form.districtCode}
              onFreeTextEntry={() => {
                setKvkFreeText(true)
                setField("kvk", "")
              }}
            />
            {/* Free-text input when backend returned no data */}
            {kvkFreeText && (
              <Input
                value={form.kvk}
                onChange={(e) => setField("kvk", e.target.value)}
                placeholder="Type KVK name"
                className="mt-1.5"
              />
            )}
            {errors.kvk && (
              <p className="text-xs sm:text-xs sm:text-sm text-destructive">{errors.kvk}</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Step3({
  form,
  errors,
  usernameStatus,
  usernameSuggestions,
  organizationDistricts,
  loadingOrganizationDistricts,
  loadOrganizationDistricts,
  setField,
  cropPickerOpen,
  setCropPickerOpen,
}: WizardFormStateProps) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label>
            Full name <span className="text-rose-600">*</span>
          </Label>
          <Input
            value={form.name}
            onChange={(e) => setField("name", e.target.value)}
            maxLength={80}
            placeholder="Your name"
          />
          {errors.name && (
            <p className="text-[11px] sm:text-[11px] sm:text-xs text-rose-600">{errors.name}</p>
          )}
        </div>
        <div className="space-y-1.5">
          <Label>
            Username <span className="text-rose-600">*</span>
          </Label>
          <div className="relative">
            <Input
              value={form.username}
              onChange={(e) =>
                setField(
                  "username",
                  e.target.value.replace(/[^a-zA-Z0-9_]/g, "").toLowerCase(),
                )
              }
              maxLength={20}
              placeholder="e.g. ram_kr"
              className={cn(
                "pr-8",
                usernameStatus === "available" && "border-emerald-400 bg-emerald-50/50",
              )}
            />
            {usernameStatus === "available" && (
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-emerald-500">
                <svg className="h-4 w-4" viewBox="0 0 12 12" fill="none">
                  <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
            )}
          </div>
          {errors.username && (
            <p className="text-[11px] sm:text-[11px] sm:text-xs text-rose-600">{errors.username}</p>
          )}
          {usernameStatus === "taken" && (
            <div className="space-y-1">
              <p className="text-[11px] sm:text-[11px] sm:text-xs text-rose-600">Taken. Try one of these:</p>
              <div className="flex flex-wrap gap-1.5">
                {usernameSuggestions.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setField("username", s)}
                    className="rounded-full border border-emerald-200 px-2 py-0.5 text-[11px] sm:text-[11px] sm:text-xs text-emerald-700 hover:bg-emerald-50"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label>
            Gender <span className="text-rose-600">*</span>
          </Label>
          <Select
            value={form.gender}
            onValueChange={(v) => setField("gender", v as any)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Choose" />
            </SelectTrigger>
            <SelectContent>
              {GENDER_OPTIONS.map((g) => (
                <SelectItem key={g.value} value={g.value}>
                  {g.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {errors.gender && (
            <p className="text-[11px] sm:text-[11px] sm:text-xs text-rose-600">{errors.gender}</p>
          )}
        </div>
        <div className="space-y-1.5">
          <Label>Age</Label>
          <Input
            type="number"
            min={1}
            max={120}
            value={form.age}
            onChange={(e) => setField("age", e.target.value)}
            placeholder="Optional"
          />
          {errors.age && <p className="text-[11px] sm:text-[11px] sm:text-xs text-rose-600">{errors.age}</p>}
        </div>
      </div>
      {form.category === "farmer" && (
        <>
          <div className="space-y-1.5">
            <Label>Farm size (acres) <span className="text-rose-600">*</span></Label>
            <Input
              inputMode="decimal"
              value={form.farmSize}
              onChange={(e) => {
                const v = e.target.value.replace(/[^0-9.]/g, '')
                const parts = v.split('.')
                setField('farmSize', parts.length > 2 ? `${parts[0]}.${parts.slice(1).join('')}` : v)
              }}
              placeholder="e.g. 2.5"
            />
            {errors.farmSize && <p className="text-[11px] sm:text-[11px] sm:text-xs text-rose-600">{errors.farmSize}</p>}
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>
                Primary crops <span className="text-rose-600">*</span>
              </Label>
              {form.cropType.length > 0 && (
                <span className="text-[11px] sm:text-[11px] sm:text-xs text-emerald-600 font-medium">
                  {form.cropType.length} selected
                </span>
              )}
            </div>

            {/* Always-visible grid of 10 crop images */}
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
              {CROPS.slice(0, 9).map((crop) => {
                const selected = form.cropType.includes(crop)
                return (
                  <button
                    key={crop}
                    type="button"
                    onClick={() =>
                      setField(
                        "cropType",
                        selected
                          ? form.cropType.filter((x) => x !== crop)
                          : [...form.cropType, crop],
                      )
                    }
                    className={cn(
                      "relative flex flex-col items-center gap-1 rounded-lg border-2 p-1.5 transition-all",
                      selected
                        ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30"
                        : "border-transparent hover:border-emerald-200",
                    )}
                    aria-pressed={selected}
                  >
                    <div className="relative h-14 w-14 overflow-hidden rounded-full">
                      <CropImage
                        name={crop}
                        className="h-full w-full rounded-full object-cover"
                      />
                      {selected && (
                        <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/20">
                          <CheckCircle2 className="h-5 w-5 text-white" />
                        </div>
                      )}
                    </div>
                    <span className={cn(
                      "line-clamp-2 text-center text-[10px] leading-tight",
                      selected ? "font-semibold text-emerald-700 dark:text-emerald-300" : "text-muted-foreground",
                    )}>
                      {crop}
                    </span>
                  </button>
                )
              })}
            </div>

            {/* Selected crops summary + modal trigger */}
            {form.cropType.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {form.cropType.map((c) => (
                  <span
                    key={c}
                    className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] sm:text-[11px] sm:text-xs font-medium text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300"
                  >
                    {c}
                    <button
                      type="button"
                      onClick={() => setField("cropType", form.cropType.filter((x) => x !== c))}
                      className="ml-0.5 leading-none hover:text-rose-500"
                      aria-label={`Remove ${c}`}
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}

            {/* See all crops */}
            <button
              type="button"
              onClick={() => setCropPickerOpen(true)}
              className="flex w-full items-center justify-center rounded-md border border-border-subtle py-2 text-[11px] sm:text-[11px] sm:text-xs font-medium text-muted-foreground hover:border-emerald-400 hover:text-emerald-600"
            >
              See all {CROPS.length} crops
            </button>

            <CropPickerModal
              open={cropPickerOpen}
              onOpenChange={setCropPickerOpen}
              selected={form.cropType}
              onSelectionChange={(crops) => setField("cropType", crops)}
            />

            {errors.cropType && (
              <p className="text-[11px] sm:text-[11px] sm:text-xs text-rose-600">{errors.cropType}</p>
            )}
          </div>
        </>
      )}
      {form.category === "student" && (
        <>
          <div className="space-y-1.5">
            <Label>
              Course <span className="text-rose-600">*</span>
            </Label>
            <Select
              value={form.courseName}
              onValueChange={(v) => setField("courseName", v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Choose course" />
              </SelectTrigger>
              <SelectContent>
                {COURSE_OPTIONS.map((c) => (
                  <SelectItem key={c.value} value={c.value}>
                    {c.label}
                  </SelectItem>
                ))}
                <SelectItem value={OTHER_VALUE}>Other…</SelectItem>
              </SelectContent>
            </Select>
            {errors.courseName && (
              <p className="text-[11px] sm:text-[11px] sm:text-xs text-rose-600">{errors.courseName}</p>
            )}
            {form.courseName === OTHER_VALUE && (
              <Input
                className="mt-2"
                value={form.courseNameOther}
                onChange={(e) => setField("courseNameOther", e.target.value)}
                placeholder="Enter course name"
              />
            )}
            {errors.courseNameOther && (
              <p className="text-[11px] sm:text-[11px] sm:text-xs text-rose-600">{errors.courseNameOther}</p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label>
              College name <span className="text-rose-600">*</span>
            </Label>
            <Input
              value={form.collegeName}
              onChange={(e) => setField("collegeName", e.target.value)}
              placeholder="College / institution"
            />
            {errors.collegeName && (
              <p className="text-[11px] sm:text-[11px] sm:text-xs text-rose-600">{errors.collegeName}</p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label>University</Label>
            <Input
              value={form.universityName}
              onChange={(e) => setField("universityName", e.target.value)}
              placeholder="Optional"
            />
          </div>
        </>
      )}
      {(form.category === "fpo" ||
        form.category === "ngo" ||
        form.category === "volunteer") && (
        <>
          <div className="space-y-1.5">
            <Label>
              Organisation type <span className="text-rose-600">*</span>
            </Label>
            <Select
              value={form.organisationType}
              onValueChange={(v) => setField("organisationType", v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Choose type" />
              </SelectTrigger>
              <SelectContent>
                {ORG_TYPE_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
                <SelectItem value={OTHER_VALUE}>Other…</SelectItem>
              </SelectContent>
            </Select>
            {errors.organisationType && (
              <p className="text-[11px] sm:text-[11px] sm:text-xs text-rose-600">{errors.organisationType}</p>
            )}
            {form.organisationType === OTHER_VALUE && (
              <Input
                className="mt-2"
                value={form.organisationTypeOther}
                onChange={(e) =>
                  setField("organisationTypeOther", e.target.value)
                }
                placeholder="Specify organisation type"
              />
            )}
            {errors.organisationTypeOther && (
              <p className="text-[11px] sm:text-[11px] sm:text-xs text-rose-600">
                {errors.organisationTypeOther}
              </p>
            )}
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>
                Organisation name <span className="text-rose-600">*</span>
              </Label>
              <Input
                value={form.organizationName}
                onChange={(e) => setField("organizationName", e.target.value)}
                placeholder="Registered name"
              />
              {errors.organizationName && (
                <p className="text-[11px] sm:text-[11px] sm:text-xs text-rose-600">
                  {errors.organizationName}
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label>
                Your role <span className="text-rose-600">*</span>
              </Label>
              <Input
                value={form.organizationRole}
                onChange={(e) => setField("organizationRole", e.target.value)}
                placeholder="e.g. CEO, Field Officer"
              />
              {errors.organizationRole && (
                <p className="text-[11px] sm:text-[11px] sm:text-xs text-rose-600">
                  {errors.organizationRole}
                </p>
              )}
            </div>
          </div>
          {(form.category === "fpo" || form.category === "ngo") && (
            <div className="space-y-1.5">
              <Label>
                Number of farmers served{" "}
                <span className="text-rose-600">*</span>
              </Label>
              <Input
                type="number"
                min={0}
                value={form.numberOfFarmers}
                onChange={(e) => setField("numberOfFarmers", e.target.value)}
                placeholder="Approx."
              />
              {errors.numberOfFarmers && (
                <p className="text-[11px] sm:text-[11px] sm:text-xs text-rose-600">
                  {errors.numberOfFarmers}
                </p>
              )}
            </div>
          )}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>
                Operating state <span className="text-rose-600">*</span>
              </Label>
              <Select
                value={form.organizationState}
                onValueChange={(v) => {
                  setField("organizationState", v)
                  setField("organizationDistrict", "")
                  setField("organizationDistrictCode", "")
                  loadOrganizationDistricts(v)
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Choose state" />
                </SelectTrigger>
                <SelectContent>
                  {SUPPORTED_STATES.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.organizationState && (
                <p className="text-[11px] sm:text-[11px] sm:text-xs text-rose-600">
                  {errors.organizationState}
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label>
                District <span className="text-rose-600">*</span>
              </Label>
              <SearchableSelect
                items={organizationDistricts.map((d) => ({ value: d.name, label: d.name }))}
                value={form.organizationDistrict}
                onValueChange={(v) => {
                  const d = organizationDistricts.find((x) => x.name === v)
                  setField("organizationDistrict", v)
                  setField("organizationDistrictCode", d?.code ?? "")
                }}
                placeholder={
                  !form.organizationState ? "Choose state first" : "Search district…"
                }
                disabled={!form.organizationState || loadingOrganizationDistricts}
                loading={loadingOrganizationDistricts}
              />
              {errors.organizationDistrict && (
                <p className="text-[11px] sm:text-[11px] sm:text-xs text-rose-600">
                  {errors.organizationDistrict}
                </p>
              )}
            </div>
          </div>
          {form.category === "volunteer" && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Season</Label>
                <Select
                  value={form.season}
                  onValueChange={(v) => setField("season", v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Optional" />
                  </SelectTrigger>
                  <SelectContent>
                    {SEASONS.map((s) => (
                      <SelectItem key={s.value} value={s.value}>
                        {s.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Crop focus</Label>
                <Input
                  value={form.volunteerCropType}
                  onChange={(e) =>
                    setField("volunteerCropType", e.target.value)
                  }
                  placeholder="Optional"
                />
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function Step4({ form, errors, setField, setLegalModal }: WizardFormStateProps) {
  return (
    <div className="space-y-2 sm:space-y-3">
      {/* ── Language card ── */}
      <div className="rounded-xl border border-border bg-surface p-3 sm:p-4">
        <div className="flex items-center gap-2 mb-2 sm:mb-3">
          <div className="flex h-6 w-6 sm:h-7 sm:w-7 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-900 dark:text-emerald-300">
            <Languages className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
          </div>
          <p className="text-xs sm:text-xs sm:text-sm font-semibold text-foreground">Preferred language</p>
        </div>
        <Select
          value={form.languagePreference}
          onValueChange={(v) => setField("languagePreference", v)}
        >
          <SelectTrigger>
            <SelectValue placeholder="Choose language" />
          </SelectTrigger>
          <SelectContent>
            {LANGUAGES.map((l) => (
              <SelectItem key={l.code} value={l.code}>
                {l.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {errors.languagePreference && (
          <p className="mt-1.5 text-[11px] sm:text-[11px] sm:text-xs text-rose-600">{errors.languagePreference}</p>
        )}
      </div>

      {/* ── Consent card ── */}
      <div
        className={cn(
          "rounded-xl border p-3 sm:p-4 transition-colors",
          form.consentGiven
            ? "border-emerald-300 bg-emerald-50/40"
            : "border-border bg-surface",
        )}
      >
        <div className="flex items-start gap-3">
          {/* Custom checkbox */}
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setField("consentGiven", !form.consentGiven) }}
            className={cn(
              "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border-2 transition-all",
              form.consentGiven
                ? "border-emerald-500 bg-emerald-500"
                : "border-border-subtle bg-surface hover:border-emerald-400",
            )}
          >
            {form.consentGiven && (
              <Check className="h-3 w-3 text-white" />
            )}
          </button>

          <div className="flex-1 space-y-1.5 sm:space-y-2">
            <p className="text-xs sm:text-xs sm:text-sm font-medium text-foreground leading-snug">
              I have read and agree to the{" "}
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); setLegalModal("terms") }}
                className="text-emerald-600 underline underline-offset-2 hover:text-emerald-700"
              >
                Terms of Service
              </button>{" "}
              and{" "}
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); setLegalModal("privacy") }}
                className="text-emerald-600 underline underline-offset-2 hover:text-emerald-700"
              >
                Privacy Policy
              </button>
            </p>
            <p className="text-[11px] sm:text-[11px] sm:text-xs text-muted-foreground leading-relaxed">
              I agree that the information I provide will be used to answer my
              agriculture questions and improve services, and I understand my
              mobile number will receive SMS notifications.
            </p>
          </div>
        </div>
        {errors.consentGiven && (
          <p className="mt-1.5 text-[11px] sm:text-[11px] sm:text-xs text-rose-600">{errors.consentGiven}</p>
        )}
      </div>

      {/* ── What happens next card ── */}
      <div className="rounded-xl border border-border bg-surface p-3 sm:p-4">
        <div className="flex items-center gap-2 mb-2 sm:mb-3">
          <div className="flex h-6 w-6 sm:h-7 sm:w-7 items-center justify-center rounded-full bg-blue-100 text-blue-600 dark:bg-blue-900 dark:text-blue-300">
            <Sparkles className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
          </div>
          <p className="text-xs sm:text-xs sm:text-sm font-semibold text-foreground">What happens next?</p>
        </div>
        <ul className="space-y-2 sm:space-y-2.5">
          {[
            {
              icon: <Clock className="h-3 w-3 sm:h-3.5 sm:w-3.5" />,
              text: "Your account will go through a quick verification (usually within 24 hours).",
            },
            {
              icon: <Gift className="h-3 w-3 sm:h-3.5 sm:w-3.5" />,
              text: "Once verified you can ask questions, earn rewards, and access expert answers.",
            },
            {
              icon: <Bell className="h-3 w-3 sm:h-3.5 sm:w-3.5" />,
              text: "You&apos;ll get a notification when verification completes.",
            },
          ].map((item, i) => (
            <li key={i} className="flex items-start gap-2">
              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue-50 text-blue-500 dark:bg-blue-950 dark:text-blue-400">
                {item.icon}
              </span>
              <span className="text-[11px] sm:text-[11px] sm:text-xs text-muted-foreground leading-relaxed">{item.text}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function StepIndicator({ step }: { step: 1 | 2 | 3 | 4 }) {
  return (
    <div className="relative flex items-start justify-center px-2">
      {/* Full-width track behind everything */}
      <div className="absolute top-3 left-4 right-4 h-0.5 bg-border" />
      <div
        className="absolute top-3 left-4 h-0.5 bg-emerald-400 transition-all"
        style={{
          width: `calc(${((step - 1) / (STEP_KEYS.length - 1)) * 100}% - 1.5rem)`,
        }}
      />
      {STEP_KEYS.map((label, idx) => {
        const n = idx + 1;
        const isDone = n < step;
        const isActive = n === step;
        return (
          <div key={label} className="relative z-10 flex flex-1 flex-col items-center">
            <div
              className={cn(
                "flex h-7 w-7 items-center justify-center rounded-full text-[11px] sm:text-[11px] sm:text-xs font-bold ring-2 ring-transparent",
                isDone
                  ? "bg-emerald-500 text-white ring-emerald-100 dark:ring-emerald-950"
                  : isActive
                    ? "bg-emerald-600 text-white ring-emerald-200 dark:ring-emerald-800"
                    : "bg-muted text-muted-foreground",
              )}
            >
              {isDone ? <CheckCircle2 className="h-4 w-4" /> : n}
            </div>
            <span
              className={cn(
                "mt-1.5 whitespace-nowrap text-[11px] leading-tight hidden sm:block text-center",
                isActive
                  ? "font-semibold text-foreground"
                  : "text-muted-foreground",
              )}
            >
              {label}
            </span>
          </div>
        );
      })}
    </div>
  );
}

interface CompleteProfileWizardProps {
  /** Mobile number being registered (required by `authApi.register`). */
  mobileNumber: string;
  /**
   * Back-button handler. When omitted, the Back button is hidden on step 1
   * (i.e. when the wizard is the only thing the user can see).
   */
  onBack?: () => void;
}

export function CompleteProfileWizard({
  mobileNumber,
  onBack,
}: CompleteProfileWizardProps) {
  const { login } = useAuth();

  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [cropPickerOpen, setCropPickerOpen] = useState(false);
  const [legalModal, setLegalModal] = useState<"terms" | "privacy" | null>(null);
  const directionRef = useRef<1 | -1>(1);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState<WizardFormState>(INITIAL_FORM);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false);
  const [usernameStatus, setUsernameStatus] = useState<
    "idle" | "checking" | "available" | "taken"
  >("idle");
  const [usernameSuggestions, setUsernameSuggestions] = useState<string[]>([]);
  const usernameTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [districts, setDistricts] = useState<LgdDistrict[]>([]);
  const [blocks, setBlocks] = useState<LgdSubDistrict[]>([]);
  const [villages, setVillages] = useState<LgdVillage[]>([]);
  const [kvks, setKvks] = useState<LgdKvk[]>([]);
  const [organizationDistricts, setOrganizationDistricts] = useState<LgdDistrict[]>([]);
  const [loadingOrganizationDistricts, setLoadingOrganizationDistricts] = useState(false);

  // Loading flags for cascading LGD lookups — used by Step2 to disable
  // dependent dropdowns and render an inline spinner while data is in-flight.
  const [loadingDistricts, setLoadingDistricts] = useState(false);
  const [loadingBlocks, setLoadingBlocks] = useState(false);
  const [loadingVillages, setLoadingVillages] = useState(false);
  const [loadingKvks, setLoadingKvks] = useState(false);

  // Free-text mode — true when LGD backend returned no data for that field
  const [districtFreeText, setDistrictFreeText] = useState(false);
  const [blockFreeText, setBlockFreeText] = useState(false);
  const [villageFreeText, setVillageFreeText] = useState(false);
  const [kvkFreeText, setKvkFreeText] = useState(false);

  useEffect(() => {
    const u = form.username.trim();
    if (u.length < 3) {
      setUsernameStatus("idle");
      setUsernameSuggestions([]);
      return;
    }
    if (!/^[a-zA-Z0-9_]+$/.test(u)) {
      setUsernameStatus("idle");
      return;
    }
    setUsernameStatus("checking");
    if (usernameTimer.current) clearTimeout(usernameTimer.current);
    usernameTimer.current = setTimeout(async () => {
      try {
        const res = await authApi.checkUsername(u);
        if (res.available) {
          setUsernameStatus("available");
          setUsernameSuggestions([]);
        } else {
          setUsernameStatus("taken");
          setUsernameSuggestions(res.suggestions ?? []);
        }
      } catch {
        setUsernameStatus("idle");
      }
    }, 500);
    return () => {
      if (usernameTimer.current) clearTimeout(usernameTimer.current);
    };
  }, [form.username]);

  function setField<K extends keyof WizardFormState>(
    k: K,
    v: WizardFormState[K],
  ) {
    setForm((p) => ({ ...p, [k]: v }));
    setErrors((e) => {
      if (!e[k as string]) return e;
      const { [k as string]: _drop, ...rest } = e;
      return rest;
    });
  }

  function handleLogout() {
    setLogoutConfirmOpen(true)
  }

  function validateStep(s: 1 | 2 | 3 | 4): boolean {
    const e: Record<string, string> = {};
    if (s === 1) {
      if (!form.category) e.category = "Please choose a category";
    }
    if (s === 2) {
      if (!form.state) e.state = "Please choose a state";
      if (!form.district) e.district = "Please choose a district";
      if (form.category === "farmer") {
        if (!form.block) e.block = "Block is required for farmers";
        if (!form.village) e.village = "Village is required for farmers";
        if (!form.kvk) e.kvk = "KVK is required for farmers";
      }
    }
    if (s === 3) {
      if (!form.name.trim() || form.name.trim().length < 2)
        e.name = "Please enter your full name";
      if (!form.username.trim()) e.username = "Please choose a username";
      else if (form.username.trim().length < 3)
        e.username = "Username must be at least 3 characters";
      else if (usernameStatus === "taken")
        e.username =
          "That username is taken. Pick or click a suggestion below.";
      if (!form.gender) e.gender = "Please choose a gender";
      if (form.age && (Number(form.age) < 16 || Number(form.age) > 100))
        e.age = "Age must be between 16 and 100";
      if (form.category === "farmer") {
        if (!form.farmSize.trim()) e.farmSize = "Farm size is required";
        if (form.cropType.length === 0) e.cropType = "Pick at least one crop";
      }
      if (form.category === "student") {
        if (!form.courseName) e.courseName = "Course is required";
        if (form.courseName === OTHER_VALUE && !form.courseNameOther.trim())
          e.courseNameOther = "Please enter course name";
        if (!form.collegeName.trim())
          e.collegeName = "College name is required";
      }
      if (
        form.category === "fpo" ||
        form.category === "ngo" ||
        form.category === "volunteer"
      ) {
        if (!form.organisationType)
          e.organisationType = "Organisation type is required";
        if (
          form.organisationType === OTHER_VALUE &&
          !form.organisationTypeOther.trim()
        )
          e.organisationTypeOther = "Please specify";
        if (!form.organizationName.trim())
          e.organizationName = "Organisation name is required";
        if (!form.organizationRole.trim())
          e.organizationRole = "Your role is required";
        if (
          (form.category === "fpo" || form.category === "ngo") &&
          !form.numberOfFarmers.trim()
        )
          e.numberOfFarmers = "Number of farmers is required";
        if (!form.organizationState)
          e.organizationState = "Organisation state is required";
        if (!form.organizationDistrict.trim())
          e.organizationDistrict = "District is required";
      }
    }
    if (s === 4) {
      if (!form.languagePreference)
        e.languagePreference = "Please choose a language";
      if (!form.consentGiven)
        e.consentGiven = "You must accept the consent to register";
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function next() {
    if (validateStep(step)) {
      directionRef.current = 1;
      setStep((s) => Math.min(4, s + 1) as 1 | 2 | 3 | 4);
    }
  }
  function back() {
    if (step > 1) {
      directionRef.current = -1;
      setStep((s) => Math.max(1, s - 1) as 1 | 2 | 3 | 4);
    } else if (onBack) {
      onBack();
    }
  }

  async function loadDistricts(stateName: string) {
    setDistricts([]);
    setBlocks([]);
    setVillages([]);
    if (!stateName) return;
    setLoadingDistricts(true);
    try {
      const res = await lgdApi.getStates();
      const target = stateName.trim().toLowerCase();
      const match = res.states.find(
        (s) => (s.name ?? "").trim().toLowerCase() === target,
      );
      if (!match) {
        console.warn(`[loadDistricts] No state matched "${stateName}".`);
        return;
      }
      const d = await lgdApi.getDistricts(match.code);
      setDistricts(d.districts);
    } catch (err) {
      console.error("[loadDistricts] Failed to fetch districts:", err);
    } finally {
      setLoadingDistricts(false);
    }
  }

  async function loadOrganizationDistricts(stateName: string) {
    setOrganizationDistricts([]);
    if (!stateName) return;
    setLoadingOrganizationDistricts(true);
    try {
      const res = await lgdApi.getStates();
      const target = stateName.trim().toLowerCase();
      const match = res.states.find(
        (s) => (s.name ?? "").trim().toLowerCase() === target,
      );
      if (!match) return;
      const d = await lgdApi.getDistricts(match.code);
      setOrganizationDistricts(d.districts);
    } catch {
      /* ignore */
    } finally {
      setLoadingOrganizationDistricts(false);
    }
  }

  async function loadBlocks(districtCode: string) {
    setBlocks([]);
    setVillages([]);
    if (!districtCode) return;
    setLoadingBlocks(true);
    try {
      const d = await lgdApi.getSubDistricts(districtCode);
      setBlocks(d.subdistricts);
    } catch {
      /* ignore */
    } finally {
      setLoadingBlocks(false);
    }
  }

  async function loadVillages(blockCode: string) {
    setVillages([]);
    if (!blockCode) return;
    setLoadingVillages(true);
    try {
      const v = await lgdApi.getVillages(blockCode);
      setVillages(v.villages);
    } catch {
      /* ignore */
    } finally {
      setLoadingVillages(false);
    }
  }

  async function loadKvks(districtCode: string) {
    setKvks([]);
    if (!districtCode) return;
    setLoadingKvks(true);
    try {
      const k = await lgdApi.getKvks(districtCode);
      setKvks(k.kvks);
    } catch {
      /* ignore */
    } finally {
      setLoadingKvks(false);
    }
  }

  async function submit() {
    if (!validateStep(4)) return;
    setLoading(true);
    try {
      const payload: any = {
        mobileNumber,
        name: form.name.trim(),
        username: form.username.trim(),
        category: form.category,
        state: form.state,
        district: form.district,
        block: form.block || undefined,
        village: form.village || undefined,
        kvk: form.kvk || undefined,
        age: form.age ? Number(form.age) : undefined,
        gender: form.gender || undefined,
        languagePreference: form.languagePreference,
        consentGiven: true,
      };
      if (form.category === "farmer") {
        payload.farmSize = form.farmSize.trim();
        payload.cropType = form.cropType.join(", ");
      }
      if (form.category === "student") {
        payload.courseName =
          form.courseName === OTHER_VALUE
            ? form.courseNameOther.trim()
            : form.courseName;
        payload.collegeName = form.collegeName.trim();
        payload.universityName = form.universityName.trim() || undefined;
      }
      if (
        form.category === "fpo" ||
        form.category === "ngo" ||
        form.category === "volunteer"
      ) {
        payload.organisationType =
          form.organisationType === OTHER_VALUE
            ? form.organisationTypeOther.trim()
            : form.organisationType;
        payload.organizationName = form.organizationName.trim();
        payload.organizationRole = form.organizationRole.trim();
        payload.numberOfFarmers = form.numberOfFarmers.trim()
          ? parseInt(form.numberOfFarmers.trim(), 10)
          : undefined;
        payload.organizationState = form.organizationState;
        payload.organizationDistrict = form.organizationDistrict.trim();
        payload.organizationBlock = form.organizationBlock.trim() || undefined;
        payload.organizationVillage =
          form.organizationVillage.trim() || undefined;
      }
      if (form.category === "volunteer") {
        payload.season = form.season || undefined;
        payload.volunteerCropType = form.volunteerCropType.trim() || undefined;
      }
      const res = await authApi.register(payload);
      login(res.tokens, res.user);
      window.location.href = '/home/verification-pending';
    } catch (err) {
      toast.error(
        getErrorMessage(err, "Registration failed. Please try again."),
      );
    } finally {
      setLoading(false);
    }
  }

  const stepProps: WizardFormStateProps = {
    form,
    errors,
    usernameStatus,
    usernameSuggestions,
    districts,
    blocks,
    villages,
    kvks,
    loadingDistricts,
    loadingBlocks,
    loadingVillages,
    loadingKvks,
    setField,
    loadDistricts,
    loadBlocks,
    loadVillages,
    loadKvks,
    organizationDistricts,
    loadingOrganizationDistricts,
    loadOrganizationDistricts,
    cropPickerOpen,
    setCropPickerOpen,
    setLegalModal,
    districtFreeText,
    setDistrictFreeText,
    blockFreeText,
    setBlockFreeText,
    villageFreeText,
    setVillageFreeText,
    kvkFreeText,
    setKvkFreeText,
  };

  return (
    <div className="flex h-[80vh] w-full flex-col">
      {/* ── Header ── */}
      <div className="flex items-center justify-between gap-3 border-b border-border bg-surface px-4 sm:px-6 pt-4 pb-3 sm:pt-5 sm:pb-4 shrink-0">
        <div className="flex items-center gap-3">
          <BrandLogo className="h-9 w-9" />
          <div>
            <h1 className="text-sm sm:text-sm sm:text-base font-extrabold text-emerald-600 dark:text-emerald-400 leading-none">
              AnnaDatha
            </h1>
            <p className="mt-0.5 text-[11px] sm:text-[11px] sm:text-xs text-muted-foreground">Complete your profile</p>
          </div>
        </div>
        <Button
          onClick={handleLogout}
          variant="ghost"
          size="sm"
          className="gap-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/5"
        >
          <LogOut className="h-3.5 w-3.5" />
          Logout
        </Button>
      </div>

      {/* ── Step indicator ── */}
      <div className="px-4 sm:px-6 pt-4 pb-2 sm:pt-5 shrink-0">
        <StepIndicator step={step} />
      </div>

      {/* ── Scrollable form area ── */}
      <div className="flex-1 overflow-y-auto px-4 sm:px-6 pb-4 min-h-0">
        <AnimatePresence mode="wait" custom={directionRef.current}>
          <motion.div
            key={step}
            custom={directionRef.current}
            variants={{
              enter: (dir: number) => ({ x: dir > 0 ? 56 : -56, opacity: 0 }),
              center: { x: 0, opacity: 1 },
              exit: (dir: number) => ({ x: dir > 0 ? -56 : 56, opacity: 0 }),
            }}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
            className="h-full"
          >
            {step === 1 && <Step1 {...stepProps} />}
            {step === 2 && <Step2 {...stepProps} />}
            {step === 3 && <Step3 {...stepProps} />}
            {step === 4 && <Step4 {...stepProps} />}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* ── Sticky footer ── */}
      <div className="border-t border-border bg-surface px-4 sm:px-6 py-3 sm:py-4 shrink-0">
        <div className="flex items-center justify-between gap-3">
          {onBack || step > 1 ? (
            <Button
              variant="outline"
              onClick={back}
              disabled={loading}
              size="sm"
              className="gap-1.5 text-xs sm:text-xs sm:text-sm"
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>
          ) : (
            <span />
          )}
          {step < TOTAL_STEPS ? (
            <Button
              onClick={next}
              size="sm"
              className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-xs sm:text-xs sm:text-sm"
            >
              <span>Continue</span>
              <ArrowRight className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            </Button>
          ) : (
            <Button
              onClick={submit}
              disabled={loading}
              size="sm"
              className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-xs sm:text-xs sm:text-sm"
            >
              {loading ? (
                <Loader2 className="h-3.5 w-3.5 sm:h-4 sm:w-4 animate-spin" />
              ) : (
                <CheckCircle2 className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              )}
              <span>Submit registration</span>
            </Button>
          )}
        </div>
      </div>

      {/* ── Modals ── */}
      <CropPickerModal
        open={cropPickerOpen}
        onOpenChange={setCropPickerOpen}
        selected={form.cropType}
        onSelectionChange={(crops) => setField("cropType", crops)}
      />
      <LegalDocumentModal
        type={legalModal ?? "terms"}
        open={legalModal !== null}
        onOpenChange={(open) => !open && setLegalModal(null)}
      />
      <SignOutDialog
        open={logoutConfirmOpen}
        onOpenChange={setLogoutConfirmOpen}
      />
    </div>
  );
}
